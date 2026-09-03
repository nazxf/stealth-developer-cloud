package httpapi_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stealth-cloud/stealth/services/api/internal/config"
	"github.com/stealth-cloud/stealth/services/api/internal/functionsecret"
	"github.com/stealth-cloud/stealth/services/api/internal/httpapi"
	"github.com/stealth-cloud/stealth/services/api/internal/migrate"
	"github.com/stealth-cloud/stealth/services/api/internal/repository"
)

func TestProjectMessagingControlPlaneIntegration(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("set TEST_DATABASE_URL to run PostgreSQL integration tests")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	if err := migrate.Apply(ctx, pool); err != nil {
		t.Fatal(err)
	}
	cipher, err := functionsecret.New(bytes.Repeat([]byte("m"), functionsecret.KeySize))
	if err != nil {
		t.Fatal(err)
	}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	server := httptest.NewServer(httpapi.New(config.Config{SessionCookieName: "stealth_session", SessionTTL: time.Hour}, repository.NewWithWebhookCipher(pool, cipher), logger))
	defer server.Close()

	ownerClient := newIntegrationClient(t)
	ownerID := uuid.Must(uuid.NewV7())
	var registration struct {
		Account struct{ ID string `json:"id"` } `json:"account"`
		Organization struct{ ID string `json:"id"` } `json:"organization"`
	}
	requestJSON(t, ownerClient, http.MethodPost, server.URL+"/v1/account/registrations", map[string]string{
		"email": fmt.Sprintf("messaging-owner-%s@example.test", ownerID), "password": "correct-horse-battery-staple",
	}, http.StatusCreated, &registration)
	var project struct{ Project struct{ ID string `json:"id"` } `json:"project"` }
	requestJSON(t, ownerClient, http.MethodPost, server.URL+"/v1/organizations/"+registration.Organization.ID+"/projects", map[string]string{"name": "messaging-" + ownerID.String()[:8]}, http.StatusCreated, &project)
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM organizations WHERE id=$1`, registration.Organization.ID)
		_, _ = pool.Exec(context.Background(), `DELETE FROM accounts WHERE id=$1`, registration.Account.ID)
	})
	projectURL := server.URL + "/v1/projects/" + project.Project.ID

	createBody := requestJSONRaw(t, ownerClient, http.MethodPost, projectURL+"/messaging/providers", map[string]any{
		"name": "Primary SMTP", "channel": "email", "provider": "smtp", "credentials": map[string]string{"host": "smtp.example.test", "password": "do-not-return"},
	}, http.StatusCreated)
	var createdProvider struct {
		Provider struct {
			ID                 string `json:"id"`
			CredentialsPresent bool   `json:"credentials_present"`
		} `json:"provider"`
	}
	if err := json.Unmarshal(createBody, &createdProvider); err != nil {
		t.Fatal(err)
	}
	if createdProvider.Provider.ID == "" || !createdProvider.Provider.CredentialsPresent || bytes.Contains(createBody, []byte("do-not-return")) || bytes.Contains(createBody, []byte("ciphertext")) {
		t.Fatalf("provider response leaked or omitted credential metadata: %s", createBody)
	}
	requestJSON(t, ownerClient, http.MethodPost, projectURL+"/messaging/providers", map[string]any{"name": "Primary SMTP", "channel": "email", "provider": "smtp"}, http.StatusConflict, nil)

	requestJSON(t, ownerClient, http.MethodPatch, projectURL+"/messaging/providers/"+createdProvider.Provider.ID, map[string]any{"credentials": map[string]string{}}, http.StatusOK, &createdProvider)
	if createdProvider.Provider.CredentialsPresent {
		t.Fatal("clearing credentials kept credentials_present=true")
	}

	topicBody := requestJSONRaw(t, ownerClient, http.MethodPost, projectURL+"/messaging/topics", map[string]any{"name": "Product updates", "description": "Release notifications"}, http.StatusCreated)
	var createdTopic struct {
		Topic struct {
			ID              string `json:"id"`
			SubscriberCount int64  `json:"subscriber_count"`
		} `json:"topic"`
	}
	if err := json.Unmarshal(topicBody, &createdTopic); err != nil {
		t.Fatal(err)
	}
	if createdTopic.Topic.ID == "" || createdTopic.Topic.SubscriberCount != 0 {
		t.Fatalf("unexpected topic response: %s", topicBody)
	}

	subscriberBody := requestJSONRaw(t, ownerClient, http.MethodPost, projectURL+"/messaging/topics/"+createdTopic.Topic.ID+"/subscribers", map[string]any{"channel": "email", "address": "Person@example.test"}, http.StatusCreated)
	var createdSubscriber struct {
		Subscriber struct {
			ID             string `json:"id"`
			AddressPreview string `json:"address_preview"`
		} `json:"subscriber"`
	}
	if err := json.Unmarshal(subscriberBody, &createdSubscriber); err != nil {
		t.Fatal(err)
	}
	if createdSubscriber.Subscriber.ID == "" || strings.Contains(strings.ToLower(createdSubscriber.Subscriber.AddressPreview), "person@example.test") || !strings.Contains(createdSubscriber.Subscriber.AddressPreview, "@") {
		t.Fatalf("subscriber address was not masked: %s", subscriberBody)
	}
	requestJSON(t, ownerClient, http.MethodPost, projectURL+"/messaging/topics/"+createdTopic.Topic.ID+"/subscribers", map[string]any{"channel": "email", "address": "person@example.test"}, http.StatusConflict, nil)
	requestJSON(t, ownerClient, http.MethodPost, projectURL+"/messaging/topics/"+createdTopic.Topic.ID+"/subscribers", map[string]any{"channel": "sms", "address": "not-a-phone"}, http.StatusUnprocessableEntity, nil)

	var topicList struct {
		Topics []struct {
			SubscriberCount int64 `json:"subscriber_count"`
		} `json:"topics"`
	}
	requestJSON(t, ownerClient, http.MethodGet, projectURL+"/messaging/topics", nil, http.StatusOK, &topicList)
	if len(topicList.Topics) != 1 || topicList.Topics[0].SubscriberCount != 1 {
		t.Fatalf("topic subscriber count was not durable: %+v", topicList)
	}

	var readKey struct {
		Key    struct{ ID string `json:"id"` } `json:"key"`
		Secret string `json:"secret"`
	}
	requestJSON(t, ownerClient, http.MethodPost, projectURL+"/api-keys", map[string]any{"name": "messaging-read", "scopes": []string{"messaging.read"}}, http.StatusCreated, &readKey)
	keyClient := &http.Client{}
	requestJSONWithHeaders(t, keyClient, http.MethodGet, projectURL+"/messaging/providers", nil, http.StatusOK, map[string]string{"X-Stealth-Key": readKey.Secret})
	requestJSONWithHeaders(t, keyClient, http.MethodPost, projectURL+"/messaging/topics", map[string]any{"name": "denied-topic"}, http.StatusForbidden, map[string]string{"X-Stealth-Key": readKey.Secret})

	requestJSON(t, ownerClient, http.MethodDelete, projectURL+"/messaging/topics/"+createdTopic.Topic.ID+"/subscribers/"+createdSubscriber.Subscriber.ID, nil, http.StatusNoContent, nil)
	requestJSON(t, ownerClient, http.MethodDelete, projectURL+"/messaging/topics/"+createdTopic.Topic.ID, nil, http.StatusNoContent, nil)
	requestJSON(t, ownerClient, http.MethodDelete, projectURL+"/messaging/providers/"+createdProvider.Provider.ID, nil, http.StatusNoContent, nil)
}
