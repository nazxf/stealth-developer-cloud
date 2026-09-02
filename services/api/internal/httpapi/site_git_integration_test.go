package httpapi_test

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stealth-cloud/stealth/services/api/internal/config"
	"github.com/stealth-cloud/stealth/services/api/internal/gitarchive"
	"github.com/stealth-cloud/stealth/services/api/internal/httpapi"
	"github.com/stealth-cloud/stealth/services/api/internal/migrate"
	"github.com/stealth-cloud/stealth/services/api/internal/ratelimit"
	"github.com/stealth-cloud/stealth/services/api/internal/repository"
)

func TestGitSiteDeploymentQueuesValidatedSourceIntegration(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("set TEST_DATABASE_URL to run PostgreSQL integration tests")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	if err := migrate.Apply(ctx, pool); err != nil {
		t.Fatal(err)
	}
	root := t.TempDir()
	fetcher := &fakeGitFetcher{archive: gitArchiveBytes(t)}
	server := httptest.NewServer(httpapi.NewWithLimiterAndGitFetcher(config.Config{
		StorageRoot:        root,
		FunctionsSecretKey: bytes.Repeat([]byte{0x3a}, 32),
		SessionCookieName:  "stealth_session",
		SessionTTL:         time.Hour,
		AppSessionTTL:      time.Hour,
		AuthRateLimit:      100,
		AuthRateWindow:     time.Minute,
	}, repository.New(pool), slog.New(slog.NewTextHandler(io.Discard, nil)), ratelimit.NewMemoryLimiter(), fetcher))
	defer server.Close()

	ownerClient := newIntegrationClient(t)
	ownerID := uuid.Must(uuid.NewV7())
	var registration struct {
		Account struct {
			ID string `json:"id"`
		} `json:"account"`
		Organization struct {
			ID string `json:"id"`
		} `json:"organization"`
	}
	requestJSON(t, ownerClient, http.MethodPost, server.URL+"/v1/account/registrations", map[string]string{
		"email":    fmt.Sprintf("site-git-owner-%s@example.test", ownerID),
		"password": "correct-horse-battery-staple",
	}, http.StatusCreated, &registration)
	t.Cleanup(func() {
		cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cleanupCancel()
		_, _ = pool.Exec(cleanupCtx, `DELETE FROM audit_events WHERE organization_id=$1 OR actor_account_id=$2`, registration.Organization.ID, registration.Account.ID)
		_, _ = pool.Exec(cleanupCtx, `DELETE FROM organizations WHERE id=$1`, registration.Organization.ID)
		_, _ = pool.Exec(cleanupCtx, `DELETE FROM accounts WHERE id=$1`, registration.Account.ID)
	})
	var project struct {
		Project struct {
			ID string `json:"id"`
		} `json:"project"`
	}
	requestJSON(t, ownerClient, http.MethodPost, server.URL+"/v1/organizations/"+registration.Organization.ID+"/projects", map[string]string{"name": "site-git-" + ownerID.String()[:8]}, http.StatusCreated, &project)
	projectURL := server.URL + "/v1/projects/" + project.Project.ID
	var site struct {
		Site struct {
			ID string `json:"id"`
		} `json:"site"`
	}
	requestJSON(t, ownerClient, http.MethodPost, projectURL+"/sites", map[string]string{"name": "git-site"}, http.StatusCreated, &site)

	var created struct {
		Deployment struct {
			Source        string  `json:"source"`
			Repository    *string `json:"git_repository"`
			Ref           *string `json:"git_ref"`
			Status        string  `json:"status"`
			BuildStatus   string  `json:"build_status"`
			ArchiveBytes  int64   `json:"archive_size_bytes"`
			ReservedBytes int64   `json:"reserved_bytes"`
		} `json:"deployment"`
	}
	requestJSON(t, ownerClient, http.MethodPost, projectURL+"/sites/"+site.Site.ID+"/deployments/git", map[string]any{
		"repository":       "https://github.com/acme/landing.git",
		"ref":              "release/2026.09",
		"build_runtime":    "node-22",
		"build_command":    "npm run build",
		"output_directory": "dist",
		"activate":         true,
	}, http.StatusCreated, &created)
	if created.Deployment.Source != "github" || created.Deployment.Repository == nil || *created.Deployment.Repository != "https://github.com/acme/landing" || created.Deployment.Ref == nil || *created.Deployment.Ref != "release/2026.09" || created.Deployment.Status != "queued" || created.Deployment.BuildStatus != "queued" || created.Deployment.ArchiveBytes == 0 || created.Deployment.ReservedBytes == 0 {
		t.Fatalf("unexpected Git deployment: %+v", created.Deployment)
	}
	if fetcher.repository != "https://github.com/acme/landing.git" || fetcher.ref != "release/2026.09" {
		t.Fatalf("fetcher received repository=%q ref=%q", fetcher.repository, fetcher.ref)
	}
	if countRegularFiles(filepath.Join(root, "site-archives")) != 1 {
		t.Fatalf("expected one immutable Git source archive in site-archives")
	}
}

type fakeGitFetcher struct {
	archive    []byte
	repository string
	ref        string
}

func (f *fakeGitFetcher) Fetch(_ context.Context, repository, ref string, _ int64) (gitarchive.Archive, error) {
	f.repository, f.ref = repository, ref
	return gitarchive.Archive{Provider: "github", Repository: "https://github.com/acme/landing", Ref: "release/2026.09", Filename: "git-github-landing-release-2026.09.tar.gz", Body: io.NopCloser(bytes.NewReader(f.archive))}, nil
}

func gitArchiveBytes(t *testing.T) []byte {
	t.Helper()
	var compressed bytes.Buffer
	gzipWriter := gzip.NewWriter(&compressed)
	tarWriter := tar.NewWriter(gzipWriter)
	content := []byte("<html>source</html>")
	if err := tarWriter.WriteHeader(&tar.Header{Name: "landing-release-2026.09/", Mode: 0o755, Typeflag: tar.TypeDir}); err != nil {
		t.Fatal(err)
	}
	if err := tarWriter.WriteHeader(&tar.Header{Name: "landing-release-2026.09/index.html", Mode: 0o644, Size: int64(len(content))}); err != nil {
		t.Fatal(err)
	}
	if _, err := tarWriter.Write(content); err != nil {
		t.Fatal(err)
	}
	if err := tarWriter.Close(); err != nil {
		t.Fatal(err)
	}
	if err := gzipWriter.Close(); err != nil {
		t.Fatal(err)
	}
	return compressed.Bytes()
}

func countRegularFiles(root string) int {
	count := 0
	_ = filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err == nil && info.Mode().IsRegular() {
			count++
		}
		return nil
	})
	return count
}
