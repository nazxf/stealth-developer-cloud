package functionrunner

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"hash"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/stealth-cloud/stealth/services/api/internal/domain"
	"github.com/stealth-cloud/stealth/services/api/internal/functionsecret"
	"github.com/stealth-cloud/stealth/services/api/internal/functionstore"
	"github.com/stealth-cloud/stealth/services/api/internal/observability"
	"github.com/stealth-cloud/stealth/services/api/internal/repository"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

const (
	defaultWorkerPoll     = 500 * time.Millisecond
	defaultLeaseAge       = 20 * time.Minute
	defaultBuildTimeout   = 15 * time.Minute
	defaultStagingRoot    = "/var/lib/stealth/runner-staging"
	defaultSourceDirMode  = 0o700
	maxFailureMessageSize = 4000
)

// RuntimeExecutor is intentionally narrower than DockerExecutor. Tests can
// provide a deterministic fake while production uses Docker with the
// restrictions in docker.go.
type RuntimeExecutor interface {
	Execute(context.Context, repository.FunctionExecutionJob, string, []repository.FunctionRuntimeVariable) (ExecutionResult, error)
}

// BuildExecutor is implemented by the production Docker executor. Keeping it
// separate from RuntimeExecutor lets tests and alternate runners continue to
// execute already-built artifacts without needing a container builder.
type BuildExecutor interface {
	Build(context.Context, repository.FunctionBuildJob, string, []repository.FunctionRuntimeVariable, io.Writer) error
}

type Worker struct {
	Repository   *repository.Repository
	Store        *functionstore.Store
	Cipher       *functionsecret.Cipher
	Executor     RuntimeExecutor
	Builder      BuildExecutor
	WorkerID     string
	StagingRoot  string
	ArchiveLimit ArchiveLimits
	PollInterval time.Duration
	LeaseAge     time.Duration
	BuildTimeout time.Duration
	Logger       *slog.Logger
	Metrics      *observability.WorkerMetrics
}

func NewWorker(repo *repository.Repository, store *functionstore.Store, cipher *functionsecret.Cipher, executor RuntimeExecutor, workerID, stagingRoot string, logger *slog.Logger) (*Worker, error) {
	if repo == nil || store == nil || cipher == nil || executor == nil || !validWorkerID(workerID) {
		return nil, fmt.Errorf("invalid function worker dependencies")
	}
	if strings.TrimSpace(stagingRoot) == "" {
		stagingRoot = defaultStagingRoot
	}
	stagingRoot, err := filepath.Abs(stagingRoot)
	if err != nil {
		return nil, fmt.Errorf("resolve function worker staging root: %w", err)
	}
	if err := os.MkdirAll(filepath.Join(stagingRoot, "jobs"), defaultSourceDirMode); err != nil {
		return nil, fmt.Errorf("create function worker staging root: %w", err)
	}
	if logger == nil {
		logger = slog.Default()
	}
	builder, _ := executor.(BuildExecutor)
	return &Worker{Repository: repo, Store: store, Cipher: cipher, Executor: executor, Builder: builder, WorkerID: workerID, StagingRoot: filepath.Clean(stagingRoot), ArchiveLimit: ArchiveLimits{}, PollInterval: defaultWorkerPoll, LeaseAge: defaultLeaseAge, BuildTimeout: defaultBuildTimeout, Logger: logger, Metrics: observability.NewWorkerMetrics()}, nil
}

// Run polls until ctx is cancelled. RequeueStaleFunctionExecutions is called
// before each poll so a crashed worker does not leave accepted work blocked.
func (w *Worker) Run(ctx context.Context) error {
	if w == nil || w.Repository == nil {
		return errors.New("function worker is not configured")
	}
	poll := w.PollInterval
	if poll <= 0 {
		poll = defaultWorkerPoll
	}
	leaseAge := w.LeaseAge
	if leaseAge <= 0 {
		leaseAge = defaultLeaseAge
	}
	ticker := time.NewTicker(poll)
	defer ticker.Stop()
	for {
		if metrics := w.Metrics; metrics != nil {
			metrics.Polls.Inc()
		}
		if requeued, err := w.Repository.RequeueStaleFunctionDeployments(ctx, leaseAge); err != nil && !errors.Is(err, context.Canceled) {
			if metrics := w.Metrics; metrics != nil {
				metrics.Errors.WithLabelValues("requeue_build").Inc()
			}
			w.Logger.Error("requeue stale function builds failed", "error", err)
		} else if requeued > 0 {
			if metrics := w.Metrics; metrics != nil {
				metrics.BuildRequeued.Add(float64(requeued))
			}
		}
		if requeued, err := w.Repository.RequeueStaleFunctionExecutions(ctx, leaseAge); err != nil && !errors.Is(err, context.Canceled) {
			if metrics := w.Metrics; metrics != nil {
				metrics.Errors.WithLabelValues("requeue").Inc()
			}
			w.Logger.Error("requeue stale function executions failed", "error", err)
		} else if requeued > 0 {
			if metrics := w.Metrics; metrics != nil {
				metrics.Requeued.Add(float64(requeued))
			}
		}
		built, buildErr := w.RunBuildOnce(ctx)
		if buildErr != nil {
			if errors.Is(buildErr, context.Canceled) || errors.Is(buildErr, context.DeadlineExceeded) {
				return nil
			}
			w.Logger.Error("function build failed", "error", buildErr)
		}
		if built {
			continue
		}
		processed, err := w.RunOnce(ctx)
		if err != nil {
			if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
				return nil
			}
			w.Logger.Error("function execution failed", "error", err)
		}
		if processed {
			continue
		}
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
		}
	}
}

// RunBuildOnce claims and builds at most one deployment. A deployment remains
// in ready/active status while its immutable artifact is being prepared, so an
// API upload can return immediately and invocations can queue safely behind
// the build lease.
func (w *Worker) RunBuildOnce(ctx context.Context) (bool, error) {
	if w == nil || w.Repository == nil || w.Builder == nil {
		return false, nil
	}
	job, err := w.Repository.ClaimNextFunctionDeployment(ctx, w.WorkerID)
	if errors.Is(err, repository.ErrNoDeploymentJob) {
		return false, nil
	}
	if err != nil {
		if metrics := w.Metrics; metrics != nil {
			metrics.Errors.WithLabelValues("build_claim").Inc()
		}
		return false, err
	}
	metrics := w.Metrics
	started := time.Now()
	if metrics != nil {
		metrics.BuildsClaimed.Inc()
		metrics.BuildInFlight.Inc()
	}
	spanContext, span := observability.StartWorkerSpan(ctx, "functions.build", attribute.String("stealth.function.runtime", job.Function.Runtime))
	result, buildErr := w.buildDeployment(spanContext, job)
	span.SetAttributes(attribute.String("stealth.operation.result", result))
	if buildErr != nil {
		// Build errors may contain compiler output or user-provided secret
		// values. Keep the trace status bounded and let the redacted build log
		// carry the operator-facing detail.
		span.RecordError(errors.New("function build failed"))
		span.SetStatus(codes.Error, "function build failed")
	} else {
		span.SetStatus(codes.Ok, "")
	}
	span.End()
	if metrics != nil {
		metrics.BuildInFlight.Dec()
		if result == "" {
			result = "error"
		}
		metrics.BuildDuration.WithLabelValues(result).Observe(time.Since(started).Seconds())
		if result == "succeeded" || result == "failed" {
			metrics.BuildsCompleted.WithLabelValues(result).Inc()
		}
		if buildErr != nil {
			metrics.Errors.WithLabelValues("build").Inc()
		}
	}
	return true, buildErr
}

func (w *Worker) buildDeployment(parent context.Context, job repository.FunctionBuildJob) (string, error) {
	projectID, err := uuid.Parse(job.Deployment.ProjectID)
	if err != nil {
		return "error", fmt.Errorf("invalid build project id: %w", err)
	}
	functionID, err := uuid.Parse(job.Deployment.FunctionID)
	if err != nil {
		return "error", fmt.Errorf("invalid build function id: %w", err)
	}
	deploymentID, err := uuid.Parse(job.Deployment.ID)
	if err != nil {
		return "error", fmt.Errorf("invalid build deployment id: %w", err)
	}
	stagingSubpath := filepath.ToSlash(filepath.Join("builds", deploymentID.String()))
	if !safeVolumeSubpath(stagingSubpath) {
		return w.failBuild(parent, projectID, functionID, deploymentID, "build workspace path is invalid", nil)
	}
	workspace := filepath.Join(w.StagingRoot, filepath.FromSlash(stagingSubpath))
	if err := ensureWithin(w.StagingRoot, workspace); err != nil {
		return w.failBuild(parent, projectID, functionID, deploymentID, "build workspace path is invalid", nil)
	}
	if err := os.RemoveAll(workspace); err != nil {
		return w.failBuild(parent, projectID, functionID, deploymentID, "build workspace could not be reset", nil)
	}
	if err := os.MkdirAll(workspace, defaultSourceDirMode); err != nil {
		return w.failBuild(parent, projectID, functionID, deploymentID, "build workspace could not be created", nil)
	}
	defer func() { _ = os.RemoveAll(workspace) }()

	archive, err := w.Store.OpenRelative(job.SourcePath)
	if err != nil {
		return w.failBuild(parent, projectID, functionID, deploymentID, "function source artifact is unavailable", nil)
	}
	checkedArchive := newChecksumReader(archive)
	stats, extractErr := Extract(parent, checkedArchive, valueOr(job.Deployment.SourceName, ""), workspace, w.ArchiveLimit)
	_ = archive.Close()
	if extractErr != nil {
		return w.failBuild(parent, projectID, functionID, deploymentID, redactFailure(extractErr.Error(), nil), nil)
	}
	if expected := strings.TrimSpace(job.Deployment.ChecksumSHA256); expected == "" || !strings.EqualFold(expected, checkedArchive.SumHex()) {
		return w.failBuild(parent, projectID, functionID, deploymentID, "function source artifact checksum mismatch", nil)
	}
	if stats.Files == 0 {
		return w.failBuild(parent, projectID, functionID, deploymentID, "function source archive contains no files", nil)
	}
	if err := validateEntrypointFile(workspace, job.Function.Entrypoint); err != nil {
		return w.failBuild(parent, projectID, functionID, deploymentID, "function entrypoint is unavailable", nil)
	}
	variables, err := w.Repository.FunctionRuntimeVariablesForDeployment(parent, projectID, functionID, deploymentID, w.Cipher)
	if err != nil {
		return w.failBuild(parent, projectID, functionID, deploymentID, "function runtime variables are unavailable", nil)
	}
	secrets := make([]string, 0, len(variables))
	for _, variable := range variables {
		if variable.IsSecret {
			secrets = append(secrets, variable.Value)
		}
	}

	buildTimeout := w.BuildTimeout
	if buildTimeout <= 0 {
		buildTimeout = defaultBuildTimeout
	}
	buildCtx, cancel := context.WithTimeout(parent, buildTimeout)
	defer cancel()
	artifactID := uuid.Must(uuid.NewV7())
	pipeReader, pipeWriter := io.Pipe()
	buildErrors := make(chan error, 1)
	go func() {
		buildErr := w.Builder.Build(buildCtx, job, stagingSubpath, variables, pipeWriter)
		_ = pipeWriter.CloseWithError(buildErr)
		buildErrors <- buildErr
	}()
	prepared, uploadErr := w.Store.BeginUpload(buildCtx, projectID, functionID, artifactID, pipeReader)
	if uploadErr != nil {
		_ = pipeReader.CloseWithError(uploadErr)
		cancel()
		buildErr := <-buildErrors
		if errors.Is(parent.Err(), context.Canceled) {
			return "error", parent.Err()
		}
		message := uploadErr.Error()
		if errors.Is(buildCtx.Err(), context.DeadlineExceeded) {
			message = "function build timed out"
		} else if buildErr != nil && !errors.Is(buildErr, context.Canceled) {
			message = buildErr.Error()
		}
		return w.failBuild(parent, projectID, functionID, deploymentID, redactFailure(message, secrets), nil)
	}
	cancel()
	buildErr := <-buildErrors
	if buildErr != nil {
		if errors.Is(parent.Err(), context.Canceled) {
			w.Store.Cleanup(&prepared)
			return "error", parent.Err()
		}
		message := buildErr.Error()
		if errors.Is(buildCtx.Err(), context.DeadlineExceeded) {
			message = "function build timed out"
		}
		w.Store.Cleanup(&prepared)
		return w.failBuild(parent, projectID, functionID, deploymentID, redactFailure(message, secrets), nil)
	}
	validationErr := validateBuiltArtifact(parent, prepared.TempPath, w.StagingRoot, deploymentID.String(), job.Function.Entrypoint, w.ArchiveLimit)
	if validationErr != nil {
		w.Store.Cleanup(&prepared)
		return w.failBuild(parent, projectID, functionID, deploymentID, redactFailure(validationErr.Error(), secrets), nil)
	}
	if err := w.Store.Commit(&prepared); err != nil {
		w.Store.Cleanup(&prepared)
		return w.failBuild(parent, projectID, functionID, deploymentID, "function build artifact could not be committed", nil)
	}
	if _, err := w.Repository.CompleteFunctionDeploymentBuild(parent, projectID, functionID, deploymentID, w.WorkerID, prepared.RelativePath, prepared.Size, prepared.Checksum); err != nil {
		_ = w.Store.RemoveRelative(prepared.RelativePath)
		if errors.Is(err, repository.ErrFunctionQuotaExceeded) {
			return w.failBuild(parent, projectID, functionID, deploymentID, "function build artifact exceeds the remaining quota", secrets)
		}
		return "error", err
	}
	if err := w.appendBuildLog(parent, job, "info", "build completed"); err != nil {
		w.Logger.Error("append function build log failed", "deployment_id", deploymentID, "error", err)
	}
	return "succeeded", nil
}

func (w *Worker) failBuild(ctx context.Context, projectID, functionID, deploymentID uuid.UUID, message string, secrets []string) (string, error) {
	if errors.Is(ctx.Err(), context.Canceled) || errors.Is(ctx.Err(), context.DeadlineExceeded) {
		return "error", ctx.Err()
	}
	message = redactFailure(message, secrets)
	if _, err := w.Repository.FailFunctionDeploymentBuild(ctx, projectID, functionID, deploymentID, w.WorkerID, message); err != nil {
		return "error", err
	}
	job := repository.FunctionBuildJob{Deployment: domain.FunctionDeployment{ID: deploymentID.String(), FunctionID: functionID.String(), ProjectID: projectID.String()}}
	if err := w.appendBuildLog(ctx, job, "error", message); err != nil {
		w.Logger.Error("append function build failure log failed", "deployment_id", deploymentID, "error", err)
	}
	return "failed", nil
}

func validateBuiltArtifact(ctx context.Context, tempPath, stagingRoot, deploymentID, entrypoint string, limits ArchiveLimits) error {
	if strings.TrimSpace(tempPath) == "" || !safeVolumeSubpath(filepath.ToSlash(filepath.Join("build-validation", deploymentID))) {
		return ErrArchiveTraversal
	}
	validationSubpath := filepath.ToSlash(filepath.Join("build-validation", deploymentID))
	destination := filepath.Join(stagingRoot, filepath.FromSlash(validationSubpath))
	if err := ensureWithin(stagingRoot, destination); err != nil {
		return err
	}
	if err := os.RemoveAll(destination); err != nil {
		return err
	}
	if err := os.MkdirAll(destination, defaultSourceDirMode); err != nil {
		return err
	}
	defer func() { _ = os.RemoveAll(destination) }()
	artifact, err := os.Open(tempPath)
	if err != nil {
		return err
	}
	stats, extractErr := ExtractTrusted(ctx, artifact, "build.tar", destination, limits)
	closeErr := artifact.Close()
	if extractErr != nil {
		return extractErr
	}
	if closeErr != nil {
		return closeErr
	}
	if stats.Files == 0 {
		return errors.New("function build artifact contains no files")
	}
	return validateEntrypointFile(destination, entrypoint)
}

// RunOnce claims and handles at most one execution. The bool indicates
// whether a job was claimed; ErrNoExecutionJob is normalized to (false,nil)
// for simple polling loops.
func (w *Worker) RunOnce(ctx context.Context) (bool, error) {
	job, err := w.Repository.ClaimNextFunctionExecution(ctx, w.WorkerID)
	if errors.Is(err, repository.ErrNoExecutionJob) {
		return false, nil
	}
	if err != nil {
		if metrics := w.Metrics; metrics != nil {
			metrics.Errors.WithLabelValues("claim").Inc()
		}
		return false, err
	}
	metrics := w.Metrics
	started := time.Now()
	if metrics != nil {
		metrics.JobsClaimed.Inc()
		metrics.InFlight.Inc()
	}
	spanContext, span := observability.StartWorkerSpan(ctx, "functions.execute", attribute.String("stealth.function.runtime", job.Function.Runtime))
	err = w.handle(spanContext, job)
	if err != nil {
		span.RecordError(errors.New("function execution failed"))
		span.SetStatus(codes.Error, "function execution failed")
	} else {
		span.SetStatus(codes.Ok, "")
	}
	span.End()
	if metrics != nil {
		metrics.InFlight.Dec()
		result := "finished"
		if err != nil {
			result = "error"
			metrics.Errors.WithLabelValues("process").Inc()
		}
		metrics.JobDuration.WithLabelValues(result).Observe(time.Since(started).Seconds())
	}
	return true, err
}

func (w *Worker) handle(parent context.Context, job repository.FunctionExecutionJob) error {
	if !job.Function.Enabled || job.Function.Status != "active" {
		return w.fail(parent, job, "function is disabled")
	}
	if job.Deployment.BuildStatus != "succeeded" {
		return w.fail(parent, job, "function build is not ready")
	}
	jobID := job.Execution.ID
	if _, err := uuid.Parse(jobID); err != nil {
		return w.fail(parent, job, "execution id is invalid")
	}
	stagingSubpath := filepath.ToSlash(filepath.Join("jobs", jobID))
	if !safeVolumeSubpath(stagingSubpath) {
		return w.fail(parent, job, "execution workspace path is invalid")
	}
	workspace := filepath.Join(w.StagingRoot, filepath.FromSlash(stagingSubpath))
	if err := ensureWithin(w.StagingRoot, workspace); err != nil {
		return w.fail(parent, job, "execution workspace path is invalid")
	}
	// A stale directory can only belong to this UUID and the worker-owned
	// staging root. Remove it before extraction so no previous archive entry is
	// accidentally reused after a retry.
	if err := os.RemoveAll(workspace); err != nil {
		return w.fail(parent, job, "execution workspace could not be reset")
	}
	if err := os.MkdirAll(workspace, defaultSourceDirMode); err != nil {
		return w.fail(parent, job, "execution workspace could not be created")
	}
	defer func() { _ = os.RemoveAll(workspace) }()

	artifactPath := strings.TrimSpace(job.BuildPath)
	artifactChecksum := strings.TrimSpace(job.BuildChecksumSHA256)
	if artifactPath == "" || artifactChecksum == "" {
		return w.fail(parent, job, "function build artifact is unavailable")
	}
	archive, err := w.Store.OpenRelative(artifactPath)
	if err != nil {
		return w.fail(parent, job, "function build artifact is unavailable")
	}
	// The database checksum is the integrity boundary between the API upload
	// path and the worker. Hash the exact opaque bytes while Extract parses the
	// archive so a locally tampered artifact can never be executed silently.
	checkedArchive := newChecksumReader(archive)
	stats, extractErr := ExtractTrusted(parent, checkedArchive, "build.tar", workspace, w.ArchiveLimit)
	_ = archive.Close()
	if extractErr != nil {
		return w.fail(parent, job, redactFailure(extractErr.Error(), nil))
	}
	if !strings.EqualFold(artifactChecksum, checkedArchive.SumHex()) {
		return w.fail(parent, job, "function build artifact checksum mismatch")
	}
	if stats.Files == 0 {
		return w.fail(parent, job, "function source archive contains no files")
	}
	if err := validateEntrypointFile(workspace, job.Function.Entrypoint); err != nil {
		return w.fail(parent, job, "function entrypoint is unavailable")
	}
	variables, err := w.Repository.FunctionRuntimeVariablesForDeployment(parent, mustUUID(job.Execution.ProjectID), mustUUID(job.Execution.FunctionID), mustUUID(job.Execution.DeploymentID), w.Cipher)
	if err != nil {
		return w.fail(parent, job, "function runtime variables are unavailable")
	}
	secrets := make([]string, 0, len(variables))
	for _, variable := range variables {
		if variable.IsSecret {
			secrets = append(secrets, variable.Value)
		}
	}
	timeout := time.Duration(job.Function.TimeoutSeconds) * time.Second
	if timeout <= 0 {
		return w.fail(parent, job, "function timeout is invalid")
	}
	ctx, cancel := context.WithTimeout(parent, timeout)
	runtimeJob := job
	// Build commands already ran while producing the immutable artifact. The
	// invocation receives a read-only copy and must never repeat installation
	// or arbitrary build steps on every request.
	runtimeJob.Function.Commands = ""
	result, runErr := w.Executor.Execute(ctx, runtimeJob, stagingSubpath, variables)
	cancel()
	redactedStdout := Redact(result.Stdout, secrets)
	redactedStderr := Redact(result.Stderr, secrets)
	if job.Function.Logging {
		if strings.TrimSpace(redactedStderr) != "" {
			if err := w.appendLog(parent, job, "error", redactedStderr); err != nil {
				w.Logger.Error("append function execution log failed", "execution_id", jobID, "error", err)
			}
		}
	}
	if runErr != nil {
		message := redactedStderr
		if errors.Is(runErr, context.DeadlineExceeded) || errors.Is(ctx.Err(), context.DeadlineExceeded) {
			message = "function execution timed out"
		} else if strings.TrimSpace(message) == "" {
			message = runErr.Error()
		}
		return w.fail(parent, job, message, secrets...)
	}
	if result.Truncated {
		return w.fail(parent, job, ErrOutputTooLarge.Error(), secrets...)
	}
	output, contentType := normalizeOutput(redactedStdout)
	status := 200
	_, err = w.Repository.TransitionFunctionExecutionResultForWorker(parent, mustUUID(job.Execution.ProjectID), mustUUID(job.Execution.FunctionID), mustUUID(jobID), w.WorkerID, "succeeded", "", &status, output, &contentType)
	if metrics := w.Metrics; metrics != nil {
		if err != nil {
			metrics.Errors.WithLabelValues("transition").Inc()
		} else {
			metrics.JobsCompleted.WithLabelValues("succeeded").Inc()
		}
	}
	return err
}

// checksumReader hashes a stream without changing its read semantics. The
// worker wraps the opaque source archive with it before extraction so the
// stored deployment digest covers the exact bytes that were executed.
type checksumReader struct {
	reader io.Reader
	hash   hash.Hash
}

func newChecksumReader(reader io.Reader) *checksumReader {
	return &checksumReader{reader: reader, hash: sha256.New()}
}

func (r *checksumReader) Read(p []byte) (int, error) {
	if r == nil || r.reader == nil || r.hash == nil {
		return 0, io.EOF
	}
	n, err := r.reader.Read(p)
	if n > 0 {
		_, _ = r.hash.Write(p[:n])
	}
	return n, err
}

func (r *checksumReader) SumHex() string {
	if r == nil || r.hash == nil {
		return ""
	}
	return hex.EncodeToString(r.hash.Sum(nil))
}

func (w *Worker) fail(ctx context.Context, job repository.FunctionExecutionJob, message string, secrets ...string) error {
	message = Redact(message, secrets)
	message, _ = executionErrorText(message)
	_, err := w.Repository.TransitionFunctionExecutionResultForWorker(ctx, mustUUID(job.Execution.ProjectID), mustUUID(job.Execution.FunctionID), mustUUID(job.Execution.ID), w.WorkerID, "failed", message, nil, nil, nil)
	if metrics := w.Metrics; metrics != nil {
		if err != nil {
			metrics.Errors.WithLabelValues("transition").Inc()
		} else {
			metrics.JobsCompleted.WithLabelValues("failed").Inc()
		}
	}
	return err
}

// MetricsHandler exposes only process-level, tenant-neutral counters. It is
// intended for the worker's private Prometheus listener, never for an
// invocation route.
func (w *Worker) MetricsHandler() http.Handler {
	if w == nil || w.Metrics == nil {
		return http.NotFoundHandler()
	}
	return w.Metrics.Handler()
}

func (w *Worker) appendLog(ctx context.Context, job repository.FunctionExecutionJob, level, message string) error {
	message, _ = executionLogText(message)
	if strings.TrimSpace(message) == "" {
		return nil
	}
	_, err := w.Repository.AppendFunctionExecutionLog(ctx, mustUUID(job.Execution.ProjectID), mustUUID(job.Execution.FunctionID), mustUUID(job.Execution.ID), uuid.Must(uuid.NewV7()), 0, level, message)
	return err
}

func (w *Worker) appendBuildLog(ctx context.Context, job repository.FunctionBuildJob, level, message string) error {
	message = normalizeBuildLogMessage(message)
	if message == "" {
		return nil
	}
	_, err := w.Repository.AppendFunctionBuildLog(ctx, mustUUID(job.Deployment.ProjectID), mustUUID(job.Deployment.FunctionID), mustUUID(job.Deployment.ID), uuid.Must(uuid.NewV7()), 0, level, message)
	return err
}

func normalizeBuildLogMessage(message string) string {
	message = strings.TrimSpace(message)
	if len(message) > maxFailureMessageSize {
		message = message[:maxFailureMessageSize]
	}
	return message
}

func normalizeOutput(value string) (json.RawMessage, string) {
	value = strings.TrimSpace(value)
	if value == "" {
		return json.RawMessage(`{}`), "application/json"
	}
	if json.Valid([]byte(value)) {
		return json.RawMessage(value), "application/json"
	}
	encoded, _ := json.Marshal(value)
	return json.RawMessage(encoded), "text/plain; charset=utf-8"
}

func validateEntrypointFile(workspace, entrypoint string) error {
	if !safeRuntimeEntrypoint(entrypoint) {
		return ErrRuntimeUnavailable
	}
	target := filepath.Join(workspace, filepath.FromSlash(entrypoint))
	if err := ensureWithin(workspace, target); err != nil {
		return err
	}
	parts := strings.Split(entrypoint, "/")
	current := workspace
	for index, part := range parts {
		current = filepath.Join(current, part)
		info, err := os.Lstat(current)
		if err != nil {
			return err
		}
		if info.Mode()&os.ModeSymlink != 0 {
			return ErrArchiveEntry
		}
		if index < len(parts)-1 && !info.IsDir() {
			return ErrArchiveEntry
		}
		if index == len(parts)-1 && !info.Mode().IsRegular() {
			return ErrArchiveEntry
		}
	}
	return nil
}

func ensureWithin(root, candidate string) error {
	root, err := filepath.Abs(root)
	if err != nil {
		return err
	}
	candidate, err = filepath.Abs(candidate)
	if err != nil {
		return err
	}
	relative, err := filepath.Rel(root, candidate)
	if err != nil || relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) || filepath.IsAbs(relative) {
		return ErrArchiveTraversal
	}
	return nil
}

func valueOr(value *string, fallback string) string {
	if value == nil || strings.TrimSpace(*value) == "" {
		return fallback
	}
	return *value
}

func mustUUID(value string) uuid.UUID {
	parsed, _ := uuid.Parse(value)
	return parsed
}

func validWorkerID(value string) bool {
	if value == "" || len(value) > 128 {
		return false
	}
	for _, character := range value {
		if (character >= 'A' && character <= 'Z') || (character >= 'a' && character <= 'z') || (character >= '0' && character <= '9') || character == '.' || character == '_' || character == '-' {
			continue
		}
		return false
	}
	return true
}

func redactFailure(message string, secrets []string) string {
	message = Redact(message, secrets)
	message, _ = executionErrorText(message)
	if strings.TrimSpace(message) == "" {
		return "function execution failed"
	}
	return message
}
