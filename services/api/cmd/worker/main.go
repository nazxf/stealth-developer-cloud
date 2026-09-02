// Command worker is the isolated Functions execution worker. It owns the
// Docker socket and must run as a separately hardened service; the API never
// starts user processes.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stealth-cloud/stealth/services/api/internal/config"
	"github.com/stealth-cloud/stealth/services/api/internal/functionrunner"
	"github.com/stealth-cloud/stealth/services/api/internal/functionsecret"
	"github.com/stealth-cloud/stealth/services/api/internal/functionstore"
	"github.com/stealth-cloud/stealth/services/api/internal/migrate"
	"github.com/stealth-cloud/stealth/services/api/internal/observability"
	"github.com/stealth-cloud/stealth/services/api/internal/repository"
	"github.com/stealth-cloud/stealth/services/api/internal/sitestore"
	"github.com/stealth-cloud/stealth/services/api/internal/webhookrunner"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	cfg, err := config.Load()
	if err != nil {
		logger.Error("configuration error", "error", err)
		os.Exit(1)
	}
	if err := cfg.ValidateFunctions(); err != nil {
		logger.Error("functions configuration error", "error", err)
		os.Exit(1)
	}
	if err := cfg.ValidateSites(); err != nil {
		logger.Error("sites configuration error", "error", err)
		os.Exit(1)
	}
	telemetryShutdown, err := observability.Setup(context.Background(), observability.TracerConfig{
		Endpoint:    cfg.TelemetryOTLPEndpoint,
		ServiceName: firstNonEmpty(cfg.TelemetryServiceName, "stealth-worker"),
		SampleRatio: cfg.TelemetrySampleRatio,
	})
	if err != nil {
		logger.Error("telemetry configuration error", "error", err)
		os.Exit(1)
	}
	defer func() {
		shutdownContext, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer shutdownCancel()
		if err := telemetryShutdown(shutdownContext); err != nil {
			logger.Error("telemetry shutdown error", "error", err)
		}
	}()
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Error("database connection error", "error", err)
		os.Exit(1)
	}
	defer pool.Close()
	if err := migrate.Apply(ctx, pool); err != nil {
		logger.Error("migration error", "error", err)
		os.Exit(1)
	}
	store, err := functionstore.New(filepath.Join(cfg.StorageRoot, "functions"), cfg.FunctionsMaxArtifactSize)
	if err != nil {
		logger.Error("function artifact storage error", "error", err)
		os.Exit(1)
	}
	siteSourceStore, err := functionstore.New(filepath.Join(cfg.StorageRoot, "site-archives"), cfg.SitesMaxArtifactSize)
	if err != nil {
		logger.Error("site source artifact storage error", "error", err)
		os.Exit(1)
	}
	sitePublicStore, err := sitestore.New(filepath.Join(cfg.StorageRoot, "sites"))
	if err != nil {
		logger.Error("site artifact storage error", "error", err)
		os.Exit(1)
	}
	cipher, err := functionsecret.New(cfg.FunctionsSecretKey)
	if err != nil {
		logger.Error("function secret configuration error", "error", err)
		os.Exit(1)
	}
	repo := repository.NewWithWebhookCipher(pool, cipher)
	webhookWorker, err := webhookrunner.New(repo, cipher, cfg.FunctionsWorkerID, logger)
	if err != nil {
		logger.Error("webhook worker configuration error", "error", err)
		os.Exit(1)
	}
	webhookWorker.PollInterval = cfg.FunctionsRunnerPoll
	webhookWorker.LeaseAge = cfg.FunctionsRunnerLeaseAge
	if !cfg.FunctionsRunnerEnabled {
		logger.Info("functions runner is disabled; webhook runner remains active")
		workerContext, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
		defer stop()
		if err := webhookWorker.Run(workerContext); err != nil && !errors.Is(err, context.Canceled) {
			logger.Error("webhook worker stopped with error", "error", err)
			os.Exit(1)
		}
		return
	}
	executor := functionrunner.NewDockerExecutor(cfg.FunctionsRunnerStagingVolume)
	executor.HelperImage = cfg.FunctionsRunnerHelperImage
	executor.NodeImage = cfg.FunctionsRunnerNodeImage
	executor.PythonImage = cfg.FunctionsRunnerPythonImage
	executor.GoImage = cfg.FunctionsRunnerGoImage
	worker, err := functionrunner.NewWorker(repo, store, cipher, executor, cfg.FunctionsWorkerID, cfg.FunctionsRunnerStagingRoot, logger)
	if err != nil {
		logger.Error("worker configuration error", "error", err)
		os.Exit(1)
	}
	worker.PollInterval = cfg.FunctionsRunnerPoll
	worker.LeaseAge = cfg.FunctionsRunnerLeaseAge
	worker.BuildTimeout = cfg.FunctionsRunnerBuildTimeout
	worker.ArchiveLimit.MaxCompressed = cfg.FunctionsMaxArtifactSize
	siteWorker, err := functionrunner.NewSiteWorker(repo, siteSourceStore, sitePublicStore, executor, cfg.FunctionsWorkerID, cfg.FunctionsRunnerStagingRoot, logger)
	if err != nil {
		logger.Error("site worker configuration error", "error", err)
		os.Exit(1)
	}
	siteWorker.PollInterval = cfg.FunctionsRunnerPoll
	siteWorker.LeaseAge = cfg.FunctionsRunnerLeaseAge
	siteWorker.BuildTimeout = cfg.FunctionsRunnerBuildTimeout
	siteWorker.ArchiveLimit.MaxBytes = cfg.SitesMaxExpandedBytes
	siteWorker.ArchiveLimit.MaxEntry = cfg.SitesMaxExpandedBytes
	siteWorker.ArchiveLimit.MaxFiles = cfg.SitesMaxFiles
	siteWorker.ArchiveLimit.MaxCompressed = cfg.SitesMaxArtifactSize
	siteWorker.Metrics = worker.Metrics
	workerContext, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	metricsServer := &http.Server{
		Addr:              cfg.FunctionsRunnerMetricsAddress,
		Handler:           worker.MetricsHandler(),
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	metricsErr := make(chan error, 1)
	go func() {
		logger.Info("worker metrics listening", "address", cfg.FunctionsRunnerMetricsAddress)
		if err := metricsServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			metricsErr <- err
		}
	}()
	workerErr := make(chan error, 1)
	go func() { workerErr <- worker.Run(workerContext) }()
	siteWorkerErr := make(chan error, 1)
	go func() { siteWorkerErr <- siteWorker.Run(workerContext) }()
	webhookWorkerErr := make(chan error, 1)
	go func() { webhookWorkerErr <- webhookWorker.Run(workerContext) }()

	var runErr, metricsFailure error
	select {
	case runErr = <-workerErr:
		stop()
		if siteErr := <-siteWorkerErr; siteErr != nil && !errors.Is(siteErr, context.Canceled) {
			logger.Error("site worker stopped with error", "error", siteErr)
			if runErr == nil {
				runErr = siteErr
			}
		}
		if webhookErr := <-webhookWorkerErr; webhookErr != nil && !errors.Is(webhookErr, context.Canceled) {
			logger.Error("webhook worker stopped with error", "error", webhookErr)
			if runErr == nil {
				runErr = webhookErr
			}
		}
	case siteErr := <-siteWorkerErr:
		if siteErr != nil && !errors.Is(siteErr, context.Canceled) {
			logger.Error("site worker stopped with error", "error", siteErr)
		}
		stop()
		runErr = <-workerErr
		if webhookErr := <-webhookWorkerErr; webhookErr != nil && !errors.Is(webhookErr, context.Canceled) {
			logger.Error("webhook worker stopped with error", "error", webhookErr)
			if runErr == nil {
				runErr = webhookErr
			}
		}
	case webhookErr := <-webhookWorkerErr:
		if webhookErr != nil && !errors.Is(webhookErr, context.Canceled) {
			logger.Error("webhook worker stopped with error", "error", webhookErr)
			runErr = webhookErr
		}
		stop()
		if workerFailure := <-workerErr; workerFailure != nil && !errors.Is(workerFailure, context.Canceled) && runErr == nil {
			runErr = workerFailure
		}
		if siteFailure := <-siteWorkerErr; siteFailure != nil && !errors.Is(siteFailure, context.Canceled) && runErr == nil {
			runErr = siteFailure
		}
	case metricsFailure = <-metricsErr:
		logger.Error("worker metrics server error", "error", metricsFailure)
		stop()
		runErr = <-workerErr
		<-siteWorkerErr
		<-webhookWorkerErr
	case <-workerContext.Done():
		runErr = <-workerErr
		<-siteWorkerErr
		<-webhookWorkerErr
	}
	shutdownContext, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	if err := metricsServer.Shutdown(shutdownContext); err != nil {
		logger.Error("worker metrics shutdown error", "error", err)
	}
	if metricsFailure != nil {
		os.Exit(1)
	}
	if runErr != nil && !errors.Is(runErr, context.Canceled) {
		logger.Error("worker stopped with error", "error", runErr)
		os.Exit(1)
	}
}

func firstNonEmpty(value, fallback string) string {
	if value != "" {
		return value
	}
	return fallback
}
