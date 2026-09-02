package httpapi_test

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stealth-cloud/stealth/services/api/internal/config"
	"github.com/stealth-cloud/stealth/services/api/internal/httpapi"
	"github.com/stealth-cloud/stealth/services/api/internal/migrate"
	"github.com/stealth-cloud/stealth/services/api/internal/repository"
)

func TestProjectUsageIntegration(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("set TEST_DATABASE_URL to run PostgreSQL integration tests")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	if err := migrate.Apply(ctx, pool); err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(httpapi.New(config.Config{SessionCookieName: "stealth_session", SessionTTL: time.Hour}, repository.New(pool), slog.New(slog.NewTextHandler(io.Discard, nil))))
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
		"email":    fmt.Sprintf("usage-owner-%s@example.test", ownerID),
		"password": "correct-horse-battery-staple",
	}, http.StatusCreated, &registration)
	var project struct {
		Project struct {
			ID string `json:"id"`
		} `json:"project"`
	}
	requestJSON(t, ownerClient, http.MethodPost, server.URL+"/v1/organizations/"+registration.Organization.ID+"/projects", map[string]string{"name": "usage-" + ownerID.String()[:8]}, http.StatusCreated, &project)
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM audit_events WHERE actor_account_id=$1 OR organization_id=$2`, registration.Account.ID, registration.Organization.ID)
		_, _ = pool.Exec(context.Background(), `DELETE FROM organizations WHERE id=$1`, registration.Organization.ID)
		_, _ = pool.Exec(context.Background(), `DELETE FROM accounts WHERE id=$1`, registration.Account.ID)
	})

	projectURL := server.URL + "/v1/projects/" + project.Project.ID
	var initial struct {
		Usage struct {
			ProjectID        string    `json:"project_id"`
			ApplicationUsers int64     `json:"application_users"`
			CapturedAt       time.Time `json:"captured_at"`
		} `json:"usage"`
	}
	requestJSON(t, ownerClient, http.MethodGet, projectURL+"/usage", nil, http.StatusOK, &initial)
	if initial.Usage.ProjectID != project.Project.ID || initial.Usage.ApplicationUsers != 0 || initial.Usage.CapturedAt.IsZero() {
		t.Fatalf("unexpected initial usage: %+v", initial.Usage)
	}
	requestJSON(t, ownerClient, http.MethodPost, projectURL+"/users", map[string]string{"email": "usage-user@example.test", "password": "correct-horse-battery-staple"}, http.StatusCreated, nil)
	var after struct {
		Usage struct {
			ApplicationUsers int64 `json:"application_users"`
		} `json:"usage"`
	}
	requestJSON(t, ownerClient, http.MethodGet, projectURL+"/usage", nil, http.StatusOK, &after)
	if after.Usage.ApplicationUsers != 1 {
		t.Fatalf("application user count = %d, want 1", after.Usage.ApplicationUsers)
	}
}
