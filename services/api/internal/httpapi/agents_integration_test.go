package httpapi_test

import (
	"context"
	"encoding/json"
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
	"github.com/stealth-cloud/stealth/services/api/internal/domain"
	"github.com/stealth-cloud/stealth/services/api/internal/httpapi"
	"github.com/stealth-cloud/stealth/services/api/internal/migrate"
	"github.com/stealth-cloud/stealth/services/api/internal/repository"
)

func TestProjectAgentsControlPlaneIntegration(t *testing.T) {
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

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	server := httpapi.New(config.Config{SessionCookieName: "stealth_session", SessionTTL: time.Hour}, repository.New(pool), logger)
	httpServer := httptest.NewServer(server)
	defer httpServer.Close()

	ownerClient := newIntegrationClient(t)
	ownerID := uuid.Must(uuid.NewV7())
	var ownerRegistration struct {
		Account struct {
			ID string `json:"id"`
		} `json:"account"`
		Organization struct {
			ID string `json:"id"`
		} `json:"organization"`
	}
	requestJSON(t, ownerClient, http.MethodPost, httpServer.URL+"/v1/account/registrations", map[string]string{
		"email": fmt.Sprintf("agent-owner-%s@example.test", ownerID), "password": "correct-horse-battery-staple",
	}, http.StatusCreated, &ownerRegistration)

	var project struct {
		Project struct {
			ID string `json:"id"`
		} `json:"project"`
	}
	requestJSON(t, ownerClient, http.MethodPost, httpServer.URL+"/v1/organizations/"+ownerRegistration.Organization.ID+"/projects", map[string]string{
		"name": "agents-" + ownerID.String()[:8],
	}, http.StatusCreated, &project)

	viewerClient := newIntegrationClient(t)
	viewerID := uuid.Must(uuid.NewV7())
	var viewerRegistration struct {
		Account struct {
			ID string `json:"id"`
		} `json:"account"`
		Organization struct {
			ID string `json:"id"`
		} `json:"organization"`
	}
	requestJSON(t, viewerClient, http.MethodPost, httpServer.URL+"/v1/account/registrations", map[string]string{
		"email": fmt.Sprintf("agent-viewer-%s@example.test", viewerID), "password": "correct-horse-battery-staple",
	}, http.StatusCreated, &viewerRegistration)
	if _, err := pool.Exec(ctx, `INSERT INTO organization_memberships (organization_id,account_id,role) VALUES ($1,$2,'viewer')`, ownerRegistration.Organization.ID, viewerRegistration.Account.ID); err != nil {
		t.Fatal(err)
	}

	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM audit_events WHERE target_id IN (SELECT id FROM project_agents WHERE project_id=$1) OR actor_account_id IN ($2,$3) OR organization_id IN ($4,$5)`, project.Project.ID, ownerRegistration.Account.ID, viewerRegistration.Account.ID, ownerRegistration.Organization.ID, viewerRegistration.Organization.ID)
		_, _ = pool.Exec(context.Background(), `DELETE FROM organizations WHERE id IN ($1,$2)`, ownerRegistration.Organization.ID, viewerRegistration.Organization.ID)
		_, _ = pool.Exec(context.Background(), `DELETE FROM accounts WHERE id IN ($1,$2)`, ownerRegistration.Account.ID, viewerRegistration.Account.ID)
	})

	createBody := requestJSONRaw(t, ownerClient, http.MethodPost, httpServer.URL+"/v1/agents", map[string]any{
		"project_id":   project.Project.ID,
		"name":         "Frontend Engineer",
		"description":  "Build and review the web console.",
		"role":         "Frontend",
		"branch":       "main",
		"provider":     "OpenAI",
		"model":        "GPT-5.6",
		"tools":        []string{"Read files", "Edit files", "Run tests"},
		"instructions": "Inspect the repository before editing.",
	}, http.StatusCreated)
	var created struct {
		Agent struct {
			ID          string   `json:"id"`
			ProjectID   string   `json:"project_id"`
			ProjectName string   `json:"project_name"`
			Name        string   `json:"name"`
			Role        string   `json:"role"`
			Status      string   `json:"status"`
			Tools       []string `json:"tools"`
		} `json:"agent"`
	}
	if err := json.Unmarshal(createBody, &created); err != nil {
		t.Fatal(err)
	}
	if created.Agent.ID == "" || created.Agent.ProjectID != project.Project.ID || created.Agent.ProjectName == "" || created.Agent.Name != "Frontend Engineer" || created.Agent.Role != "Frontend" || created.Agent.Status != "idle" || len(created.Agent.Tools) != 3 {
		t.Fatalf("unexpected agent response: %s", createBody)
	}

	var list struct {
		Agents []struct {
			ID string `json:"id"`
		} `json:"agents"`
		Pagination struct {
			NextCursor *string `json:"next_cursor"`
		} `json:"pagination"`
	}
	requestJSON(t, ownerClient, http.MethodGet, httpServer.URL+"/v1/agents?limit=1", nil, http.StatusOK, &list)
	if len(list.Agents) != 1 || list.Agents[0].ID != created.Agent.ID {
		t.Fatalf("unexpected agent list: %+v", list)
	}

	requestJSON(t, viewerClient, http.MethodGet, httpServer.URL+"/v1/agents/"+created.Agent.ID, nil, http.StatusOK, &struct{}{})
	runBody := requestJSONRaw(t, ownerClient, http.MethodPost, httpServer.URL+"/v1/agents/"+created.Agent.ID+"/runs", map[string]any{
		"prompt": "Inspect the project and report the first safe improvement.",
	}, http.StatusAccepted)
	var createdRun struct {
		Run struct {
			ID        string `json:"id"`
			AgentID   string `json:"agent_id"`
			ProjectID string `json:"project_id"`
			Prompt    string `json:"prompt"`
			Status    string `json:"status"`
			Steps     []any  `json:"steps"`
			Changes   []any  `json:"changes"`
		} `json:"run"`
	}
	if err := json.Unmarshal(runBody, &createdRun); err != nil {
		t.Fatal(err)
	}
	if createdRun.Run.ID == "" || createdRun.Run.AgentID != created.Agent.ID || createdRun.Run.ProjectID != project.Project.ID || createdRun.Run.Prompt == "" || createdRun.Run.Status != "queued" || createdRun.Run.Steps == nil || createdRun.Run.Changes == nil {
		t.Fatalf("unexpected run response: %s", runBody)
	}
	requestJSON(t, ownerClient, http.MethodGet, httpServer.URL+"/v1/agents/"+created.Agent.ID+"/runs", nil, http.StatusOK, &struct{}{})
	requestJSON(t, ownerClient, http.MethodGet, httpServer.URL+"/v1/agents/"+created.Agent.ID+"/runs/"+createdRun.Run.ID, nil, http.StatusOK, &struct{}{})
	requestJSON(t, ownerClient, http.MethodGet, httpServer.URL+"/v1/agents/"+created.Agent.ID+"/runs/"+createdRun.Run.ID+"/logs", nil, http.StatusOK, &struct{}{})
	requestJSON(t, viewerClient, http.MethodGet, httpServer.URL+"/v1/agents/"+created.Agent.ID+"/runs/"+createdRun.Run.ID, nil, http.StatusOK, &struct{}{})
	requestJSON(t, viewerClient, http.MethodPost, httpServer.URL+"/v1/agents/"+created.Agent.ID+"/runs", map[string]string{"prompt": "Viewer cannot enqueue"}, http.StatusForbidden, nil)
	requestJSON(t, viewerClient, http.MethodPost, httpServer.URL+"/v1/agents/"+created.Agent.ID+"/runs/"+createdRun.Run.ID+"/cancel", nil, http.StatusForbidden, nil)
	requestJSON(t, ownerClient, http.MethodPost, httpServer.URL+"/v1/agents/"+created.Agent.ID+"/runs/"+createdRun.Run.ID+"/cancel", nil, http.StatusOK, &struct{}{})
	requestJSON(t, ownerClient, http.MethodPost, httpServer.URL+"/v1/agents/"+created.Agent.ID+"/runs/"+createdRun.Run.ID+"/cancel", nil, http.StatusConflict, nil)
	workerRunBody := requestJSONRaw(t, ownerClient, http.MethodPost, httpServer.URL+"/v1/agents/"+created.Agent.ID+"/runs", map[string]string{"prompt": "Exercise the worker lifecycle"}, http.StatusAccepted)
	var workerRun struct {
		Run struct {
			ID string `json:"id"`
		} `json:"run"`
	}
	if err := json.Unmarshal(workerRunBody, &workerRun); err != nil {
		t.Fatal(err)
	}
	repo := repository.New(pool)
	workerID := "agent-integration-worker"
	job, err := repo.ClaimNextAgentRun(ctx, workerID)
	if err != nil {
		t.Fatal(err)
	}
	if job.Run.ID != workerRun.Run.ID || job.Run.Status != "running" || job.Agent.ID != created.Agent.ID || job.Agent.Status != "running" {
		t.Fatalf("unexpected claimed job: %+v", job)
	}
	if _, err := repo.AppendAgentRunLog(ctx, uuid.MustParse(project.Project.ID), uuid.MustParse(created.Agent.ID), uuid.MustParse(workerRun.Run.ID), workerID, uuid.Must(uuid.NewV7()), 0, "info", "worker claimed run"); err != nil {
		t.Fatal(err)
	}
	requestJSON(t, ownerClient, http.MethodGet, httpServer.URL+"/v1/agents/"+created.Agent.ID+"/runs/"+workerRun.Run.ID+"/logs", nil, http.StatusOK, &struct{}{})
	output := "Worker completed the control-plane lifecycle."
	if _, err := repo.TransitionAgentRun(ctx, uuid.MustParse(project.Project.ID), uuid.MustParse(created.Agent.ID), uuid.MustParse(workerRun.Run.ID), workerID, repository.AgentRunResult{
		Status: "completed", OutputText: &output, Steps: []domain.AgentRunStep{{ID: "step-1", Type: "check", Label: "Worker check", Target: "control-plane", Status: "done"}},
		Changes: []domain.AgentRunChange{{Path: "README.md", Additions: 1, Deletions: 0, Status: "modified"}},
	}); err != nil {
		t.Fatal(err)
	}
	var completedRun struct {
		Run struct {
			Status     string `json:"status"`
			OutputText string `json:"output_text"`
			Steps      []any  `json:"steps"`
			Changes    []any  `json:"changes"`
		} `json:"run"`
	}
	requestJSON(t, ownerClient, http.MethodGet, httpServer.URL+"/v1/agents/"+created.Agent.ID+"/runs/"+workerRun.Run.ID, nil, http.StatusOK, &completedRun)
	if completedRun.Run.Status != "completed" || completedRun.Run.OutputText != output || len(completedRun.Run.Steps) != 1 || len(completedRun.Run.Changes) != 1 {
		t.Fatalf("unexpected completed run: %+v", completedRun.Run)
	}
	requestJSON(t, viewerClient, http.MethodPost, httpServer.URL+"/v1/agents", map[string]any{
		"project_id": project.Project.ID, "name": "Viewer Agent", "role": "General", "provider": "OpenAI", "model": "GPT-5.6",
	}, http.StatusForbidden, nil)
	requestJSON(t, viewerClient, http.MethodPatch, httpServer.URL+"/v1/agents/"+created.Agent.ID, map[string]string{"name": "Viewer Rename"}, http.StatusForbidden, nil)
	requestJSON(t, viewerClient, http.MethodDelete, httpServer.URL+"/v1/agents/"+created.Agent.ID, nil, http.StatusForbidden, nil)

	requestJSON(t, ownerClient, http.MethodPost, httpServer.URL+"/v1/agents", map[string]any{
		"project_id": project.Project.ID, "name": "Frontend Engineer", "role": "Frontend", "provider": "OpenAI", "model": "GPT-5.6",
	}, http.StatusConflict, nil)
	requestJSON(t, ownerClient, http.MethodPatch, httpServer.URL+"/v1/agents/"+created.Agent.ID, map[string]any{
		"name": "Frontend Platform Engineer", "current_task": "Wire the Agent control plane", "tools": []string{"Search code", "Read files"},
	}, http.StatusOK, &struct{}{})
	requestJSON(t, ownerClient, http.MethodDelete, httpServer.URL+"/v1/agents/"+created.Agent.ID, nil, http.StatusNoContent, nil)
	requestJSON(t, ownerClient, http.MethodGet, httpServer.URL+"/v1/agents/"+created.Agent.ID, nil, http.StatusNotFound, nil)
}
