package httpapi

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"mime"
	"net"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/stealth-cloud/stealth/services/api/internal/apikey"
	"github.com/stealth-cloud/stealth/services/api/internal/auth"
	"github.com/stealth-cloud/stealth/services/api/internal/config"
	"github.com/stealth-cloud/stealth/services/api/internal/domain"
	"github.com/stealth-cloud/stealth/services/api/internal/functionsecret"
	"github.com/stealth-cloud/stealth/services/api/internal/functionstore"
	"github.com/stealth-cloud/stealth/services/api/internal/gitarchive"
	"github.com/stealth-cloud/stealth/services/api/internal/mailer"
	"github.com/stealth-cloud/stealth/services/api/internal/observability"
	"github.com/stealth-cloud/stealth/services/api/internal/ratelimit"
	"github.com/stealth-cloud/stealth/services/api/internal/repository"
	"github.com/stealth-cloud/stealth/services/api/internal/sitestore"
	"github.com/stealth-cloud/stealth/services/api/internal/storage"
	"github.com/stealth-cloud/stealth/services/api/internal/validate"
)

const maxBodyBytes = 1 << 20
const maxMultipartOverhead = 2 << 20

type Server struct {
	config         config.Config
	repo           *repository.Repository
	logger         *slog.Logger
	limiter        ratelimit.Limiter
	storage        *storage.Store
	storageReady   bool
	functions      *functionstore.Store
	functionCipher *functionsecret.Cipher
	functionsReady bool
	sites          *sitestore.Store
	siteArchives   *functionstore.Store
	siteGitFetcher gitarchive.SourceFetcher
	siteGitSlots   chan struct{}
	sitesReady     bool
	metrics        *observability.APIMetrics
	realtimeSlots  chan struct{}
	emailSender    mailer.Sender
}

func New(cfg config.Config, repo *repository.Repository, logger *slog.Logger) http.Handler {
	return NewWithLimiter(cfg, repo, logger, ratelimit.NoopLimiter{})
}

func NewWithLimiter(cfg config.Config, repo *repository.Repository, logger *slog.Logger, authLimiter ratelimit.Limiter) http.Handler {
	return NewWithLimiterAndGitFetcher(cfg, repo, logger, authLimiter, gitarchive.NewFetcher())
}

// NewWithLimiterAndGitFetcher keeps provider downloads injectable for
// deterministic integration tests while production callers use the strict
// GitHub/GitLab fetcher created by NewWithLimiter.
func NewWithLimiterAndGitFetcher(cfg config.Config, repo *repository.Repository, logger *slog.Logger, authLimiter ratelimit.Limiter, siteGitFetcher gitarchive.SourceFetcher) http.Handler {
	return NewWithLimiterAndGitFetcherAndMailer(cfg, repo, logger, authLimiter, siteGitFetcher, nil)
}

// NewWithLimiterAndGitFetcherAndMailer keeps email delivery injectable for
// deterministic tests and provider adapters while production uses the
// configured SMTP/log/disabled implementation.
func NewWithLimiterAndGitFetcherAndMailer(cfg config.Config, repo *repository.Repository, logger *slog.Logger, authLimiter ratelimit.Limiter, siteGitFetcher gitarchive.SourceFetcher, emailSender mailer.Sender) http.Handler {
	if logger == nil {
		logger = slog.Default()
	}
	if authLimiter == nil {
		authLimiter = ratelimit.UnavailableLimiter{}
	}
	if siteGitFetcher == nil {
		siteGitFetcher = gitarchive.NewFetcher()
	}
	if cfg.SessionTTL <= 0 {
		cfg.SessionTTL = 720 * time.Hour
	}
	if strings.TrimSpace(cfg.SessionCookieName) == "" {
		cfg.SessionCookieName = "stealth_session"
	}
	if cfg.AppSessionTTL <= 0 {
		cfg.AppSessionTTL = cfg.SessionTTL
	}
	if cfg.AuthRateLimit <= 0 {
		cfg.AuthRateLimit = 10
	}
	if cfg.AuthRateWindow <= 0 {
		cfg.AuthRateWindow = time.Minute
	}
	if cfg.AuthVerificationTTL <= 0 {
		cfg.AuthVerificationTTL = 24 * time.Hour
	}
	if cfg.AuthPasswordResetTTL <= 0 {
		cfg.AuthPasswordResetTTL = time.Hour
	}
	if strings.TrimSpace(cfg.PublicAppURL) == "" {
		cfg.PublicAppURL = "http://localhost:4173"
	}
	if emailSender == nil {
		emailSender = mailer.NewFromConfig(cfg, logger)
	}
	if cfg.StorageRoot == "" {
		cfg.StorageRoot = "/var/lib/stealth/storage"
	}
	if cfg.StorageMaxFileSize <= 0 {
		cfg.StorageMaxFileSize = 50 << 20
	}
	if cfg.StorageDefaultQuotaBytes <= 0 {
		cfg.StorageDefaultQuotaBytes = 1 << 30
	}
	if cfg.FunctionsMaxArtifactSize <= 0 {
		cfg.FunctionsMaxArtifactSize = cfg.StorageMaxFileSize
	}
	if cfg.FunctionsMaxArtifactSize <= 0 {
		cfg.FunctionsMaxArtifactSize = 50 << 20
	}
	if cfg.FunctionsDefaultQuotaBytes <= 0 {
		cfg.FunctionsDefaultQuotaBytes = cfg.StorageDefaultQuotaBytes
	}
	if cfg.FunctionsDefaultQuotaBytes <= 0 {
		cfg.FunctionsDefaultQuotaBytes = 1 << 30
	}
	if cfg.SitesMaxArtifactSize <= 0 {
		cfg.SitesMaxArtifactSize = cfg.StorageMaxFileSize
	}
	if cfg.SitesMaxArtifactSize <= 0 {
		cfg.SitesMaxArtifactSize = 50 << 20
	}
	if cfg.SitesDefaultQuotaBytes <= 0 {
		cfg.SitesDefaultQuotaBytes = cfg.StorageDefaultQuotaBytes
	}
	if cfg.SitesDefaultQuotaBytes <= 0 {
		cfg.SitesDefaultQuotaBytes = 1 << 30
	}
	if cfg.SitesMaxExpandedBytes <= 0 {
		cfg.SitesMaxExpandedBytes = 256 << 20
	}
	if cfg.SitesMaxExpandedBytes > cfg.SitesDefaultQuotaBytes {
		cfg.SitesMaxExpandedBytes = cfg.SitesDefaultQuotaBytes
	}
	if cfg.SitesMaxFiles <= 0 {
		cfg.SitesMaxFiles = 4096
	}
	if cfg.SitesGitFetchConcurrency <= 0 {
		cfg.SitesGitFetchConcurrency = 4
	}
	if cfg.SitesGitFetchConcurrency > 32 {
		cfg.SitesGitFetchConcurrency = 32
	}
	storageStore, storageErr := storage.New(cfg.StorageRoot, cfg.StorageMaxFileSize)
	if storageErr != nil {
		logger.Error("storage configuration error", "error", storageErr)
	}
	functionRoot := filepath.Join(cfg.StorageRoot, "functions")
	functionStore, functionStoreErr := functionstore.New(functionRoot, cfg.FunctionsMaxArtifactSize)
	if functionStoreErr != nil {
		logger.Error("function artifact storage configuration error", "error", functionStoreErr)
	}
	siteRoot := filepath.Join(cfg.StorageRoot, "sites")
	siteStore, siteStoreErr := sitestore.New(siteRoot)
	if siteStoreErr != nil {
		logger.Error("site artifact storage configuration error", "error", siteStoreErr)
	}
	siteArchiveRoot := filepath.Join(cfg.StorageRoot, "site-archives")
	siteArchiveStore, siteArchiveErr := functionstore.New(siteArchiveRoot, cfg.SitesMaxArtifactSize)
	if siteArchiveErr != nil {
		logger.Error("site upload staging storage configuration error", "error", siteArchiveErr)
	}
	functionCipher, functionCipherErr := functionsecret.New(cfg.FunctionsSecretKey)
	if functionCipherErr != nil {
		logger.Error("function secret configuration error", "error", functionCipherErr)
	}
	functionsReady := functionStoreErr == nil && functionCipherErr == nil && cfg.FunctionsMaxArtifactSize > 0 && cfg.FunctionsDefaultQuotaBytes >= cfg.FunctionsMaxArtifactSize
	sitesReady := siteStoreErr == nil && siteArchiveErr == nil && cfg.SitesMaxArtifactSize > 0 && cfg.SitesMaxExpandedBytes > 0 && cfg.SitesMaxFiles > 0
	s := &Server{config: cfg, repo: repo, logger: logger, limiter: authLimiter, storage: storageStore, storageReady: storageErr == nil, functions: functionStore, functionCipher: functionCipher, functionsReady: functionsReady, sites: siteStore, siteArchives: siteArchiveStore, siteGitFetcher: siteGitFetcher, siteGitSlots: make(chan struct{}, cfg.SitesGitFetchConcurrency), sitesReady: sitesReady, metrics: observability.NewAPIMetrics(), realtimeSlots: make(chan struct{}, 256), emailSender: emailSender}
	r := chi.NewRouter()
	// Request telemetry is outside recovery so a recovered panic is counted as
	// the 500 response that callers actually receive.
	r.Use(observability.HTTPMiddlewareWithRecorder(s.recordHTTPTrace), s.requestLog, s.recoverer, s.limitRequestBody, s.cors)
	r.Get("/healthz", s.health)
	r.Get("/readyz", s.ready)
	r.Get("/metrics", s.metricsHandler)
	r.Route("/v1", func(r chi.Router) {
		r.Post("/account/registrations", s.register)
		r.With(s.requireSession).Get("/account", s.currentAccount)
		r.With(s.requireSession).Get("/account/sessions", s.listConsoleSessions)
		r.With(s.requireSession).Delete("/account/sessions", s.revokeOtherConsoleSessions)
		r.With(s.requireSession).Delete("/account/sessions/{sessionID}", s.revokeConsoleSession)
		r.With(s.requireSession).Patch("/account/password", s.updateAccountPassword)
		r.With(s.requireSession).Post("/account/verification", s.sendAccountVerification)
		r.Put("/account/verification", s.confirmAccountVerification)
		r.Post("/account/recovery", s.createAccountRecovery)
		r.Put("/account/recovery", s.confirmAccountRecovery)
		r.Post("/sessions/email-password", s.login)
		r.With(s.requireSession).Delete("/session", s.logout)
		r.With(s.requireSession).Get("/organizations", s.listOrganizations)
		r.With(s.requireSession).Post("/organizations", s.createOrganization)
		r.With(s.requireSession).Patch("/organizations/{organizationID}", s.updateOrganization)
		r.With(s.requireSession).Get("/organizations/{organizationID}/memberships", s.listMemberships)
		r.With(s.requireSession).Post("/organizations/{organizationID}/memberships", s.createMembership)
		r.With(s.requireSession).Patch("/organizations/{organizationID}/memberships/{accountID}", s.updateMembership)
		r.With(s.requireSession).Delete("/organizations/{organizationID}/memberships/{accountID}", s.removeMembership)
		r.With(s.requireSession).Get("/organizations/{organizationID}/invitations", s.listOrganizationInvitations)
		r.With(s.requireSession).Post("/organizations/{organizationID}/invitations", s.createOrganizationInvitation)
		r.With(s.requireSession).Delete("/organizations/{organizationID}/invitations/{invitationID}", s.revokeOrganizationInvitation)
		r.With(s.requireSession).Post("/organization-invitations/accept", s.acceptOrganizationInvitation)
		r.With(s.requireSession).Get("/organizations/{organizationID}/incidents", s.listOrganizationIncidents)
		r.With(s.requireSession).Post("/organizations/{organizationID}/incidents", s.createOrganizationIncident)
		r.With(s.requireSession).Get("/organizations/{organizationID}/incidents/{incidentID}", s.getOrganizationIncident)
		r.With(s.requireSession).Patch("/organizations/{organizationID}/incidents/{incidentID}", s.updateOrganizationIncident)
		r.With(s.requireSession).Get("/organizations/{organizationID}/traces", s.listOrganizationTraces)
		r.With(s.requireSession).Get("/organizations/{organizationID}/audit-events", s.listAuditEvents)
		r.With(s.requireSession).Get("/organizations/{organizationID}/projects", s.listProjects)
		r.With(s.requireSession).Post("/organizations/{organizationID}/projects", s.createProject)
		r.With(s.requireSession).Get("/projects/{projectID}", s.getProject)
		r.With(s.requireSession).Patch("/projects/{projectID}", s.updateProject)
		r.With(s.requireSession).Delete("/projects/{projectID}", s.deleteProject)
		r.With(s.requireSession).Get("/projects/{projectID}/audit-events", s.listProjectAuditEvents)
		r.With(s.requireSession).Get("/projects/{projectID}/traces", s.listProjectTraces)
		r.With(s.requireSession).Get("/projects/{projectID}/service-layout", s.listProjectServiceLayout)
		r.With(s.requireSession).Put("/projects/{projectID}/service-layout", s.replaceProjectServiceLayout)
		r.With(s.requireSession).Get("/agents", s.listAgents)
		r.With(s.requireSession).Post("/agents", s.createAgent)
		r.With(s.requireSession).Get("/agents/{agentID}", s.getAgent)
		r.With(s.requireSession).Patch("/agents/{agentID}", s.updateAgent)
		r.With(s.requireSession).Delete("/agents/{agentID}", s.deleteAgent)
		r.With(s.requireSession).Get("/agents/{agentID}/runs", s.listAgentRuns)
		r.With(s.requireSession).Post("/agents/{agentID}/runs", s.createAgentRun)
		r.With(s.requireSession).Get("/agents/{agentID}/runs/{runID}", s.getAgentRun)
		r.With(s.requireSession).Post("/agents/{agentID}/runs/{runID}/cancel", s.cancelAgentRun)
		r.With(s.requireSession).Get("/agents/{agentID}/runs/{runID}/logs", s.listAgentRunLogs)
		r.With(s.requireProjectManagement).Get("/projects/{projectID}/users", s.listProjectUsers)
		r.With(s.requireProjectManagement).Post("/projects/{projectID}/users", s.createProjectUser)
		r.With(s.requireProjectManagement).Get("/projects/{projectID}/users/{userID}", s.getProjectUser)
		r.With(s.requireProjectManagement).Delete("/projects/{projectID}/users/{userID}", s.deleteProjectUser)
		r.With(s.requireProjectManagement).Patch("/projects/{projectID}/users/{userID}/status", s.updateProjectUserStatus)
		r.With(s.requireSession).Get("/projects/{projectID}/auth/settings", s.getProjectAuthSettings)
		r.With(s.requireSession).Patch("/projects/{projectID}/auth/settings", s.updateProjectAuthSettings)
		r.With(s.requireSession).Get("/projects/{projectID}/usage", s.getProjectUsage)
		r.With(s.requireSession).Get("/projects/{projectID}/usage/metering", s.getProjectUsageMetering)
		r.With(s.requireSession).Get("/projects/{projectID}/api-keys", s.listProjectAPIKeys)
		r.With(s.requireSession).Post("/projects/{projectID}/api-keys", s.createProjectAPIKey)
		r.With(s.requireSession).Get("/projects/{projectID}/api-keys/{keyID}", s.getProjectAPIKey)
		r.With(s.requireSession).Delete("/projects/{projectID}/api-keys/{keyID}", s.revokeProjectAPIKey)
		r.With(s.requireProjectManagement).Get("/projects/{projectID}/webhooks", s.listWebhooks)
		r.With(s.requireProjectManagement).Post("/projects/{projectID}/webhooks", s.createWebhook)
		r.With(s.requireProjectManagement).Post("/projects/{projectID}/webhooks/{webhookID}/rotate-secret", s.rotateWebhookSecret)
		r.With(s.requireProjectManagement).Get("/projects/{projectID}/webhooks/{webhookID}/deliveries", s.listWebhookDeliveries)
		r.With(s.requireProjectManagement).Get("/projects/{projectID}/webhooks/{webhookID}", s.getWebhook)
		r.With(s.requireProjectManagement).Patch("/projects/{projectID}/webhooks/{webhookID}", s.updateWebhook)
		r.With(s.requireProjectManagement).Delete("/projects/{projectID}/webhooks/{webhookID}", s.deleteWebhook)
		r.With(s.requireProjectManagement).Get("/projects/{projectID}/messaging/providers", s.listMessagingProviders)
		r.With(s.requireProjectManagement).Post("/projects/{projectID}/messaging/providers", s.createMessagingProvider)
		r.With(s.requireProjectManagement).Get("/projects/{projectID}/messaging/providers/{providerID}", s.getMessagingProvider)
		r.With(s.requireProjectManagement).Patch("/projects/{projectID}/messaging/providers/{providerID}", s.updateMessagingProvider)
		r.With(s.requireProjectManagement).Delete("/projects/{projectID}/messaging/providers/{providerID}", s.deleteMessagingProvider)
		r.With(s.requireProjectManagement).Get("/projects/{projectID}/messaging/topics", s.listMessagingTopics)
		r.With(s.requireProjectManagement).Post("/projects/{projectID}/messaging/topics", s.createMessagingTopic)
		r.With(s.requireProjectManagement).Get("/projects/{projectID}/messaging/topics/{topicID}", s.getMessagingTopic)
		r.With(s.requireProjectManagement).Patch("/projects/{projectID}/messaging/topics/{topicID}", s.updateMessagingTopic)
		r.With(s.requireProjectManagement).Delete("/projects/{projectID}/messaging/topics/{topicID}", s.deleteMessagingTopic)
		r.With(s.requireProjectManagement).Get("/projects/{projectID}/messaging/topics/{topicID}/subscribers", s.listMessagingSubscribers)
		r.With(s.requireProjectManagement).Post("/projects/{projectID}/messaging/topics/{topicID}/subscribers", s.createMessagingSubscriber)
		r.With(s.requireProjectManagement).Get("/projects/{projectID}/messaging/topics/{topicID}/subscribers/{subscriberID}", s.getMessagingSubscriber)
		r.With(s.requireProjectManagement).Delete("/projects/{projectID}/messaging/topics/{topicID}/subscribers/{subscriberID}", s.deleteMessagingSubscriber)
		r.With(s.requireProjectManagement).Get("/projects/{projectID}/messaging/messages", s.listMessagingMessages)
		r.With(s.requireProjectManagement).Post("/projects/{projectID}/messaging/messages", s.createMessagingMessage)
		r.With(s.requireProjectManagement).Get("/projects/{projectID}/messaging/messages/{messageID}", s.getMessagingMessage)
		r.With(s.requireProjectManagement).Post("/projects/{projectID}/messaging/messages/{messageID}/cancel", s.cancelMessagingMessage)
		r.With(s.requireProjectManagement).Get("/projects/{projectID}/messaging/messages/{messageID}/deliveries", s.listMessagingDeliveries)
		r.With(s.requireProjectDataActor).Get("/projects/{projectID}/realtime", s.realtime)
		r.With(s.requireProjectManagement).Get("/projects/{projectID}/databases", s.listProjectDatabases)
		r.With(s.requireProjectManagement).Post("/projects/{projectID}/databases", s.createProjectDatabase)
		r.With(s.requireProjectManagement).Get("/projects/{projectID}/databases/{databaseID}", s.getProjectDatabase)
		r.With(s.requireProjectManagement).Delete("/projects/{projectID}/databases/{databaseID}", s.deleteProjectDatabase)
		r.With(s.requireProjectManagement).Get("/projects/{projectID}/databases/{databaseID}/tables", s.listDatabaseTables)
		r.With(s.requireProjectManagement).Post("/projects/{projectID}/databases/{databaseID}/tables", s.createDatabaseTable)
		r.With(s.requireProjectManagement).Get("/projects/{projectID}/databases/{databaseID}/tables/{tableID}", s.getDatabaseTable)
		r.With(s.requireProjectManagement).Patch("/projects/{projectID}/databases/{databaseID}/tables/{tableID}", s.updateDatabaseTable)
		r.With(s.requireProjectManagement).Delete("/projects/{projectID}/databases/{databaseID}/tables/{tableID}", s.deleteDatabaseTable)
		r.With(s.requireProjectManagement).Get("/projects/{projectID}/databases/{databaseID}/tables/{tableID}/columns", s.listDatabaseColumns)
		r.With(s.requireProjectManagement).Post("/projects/{projectID}/databases/{databaseID}/tables/{tableID}/columns", s.createDatabaseColumn)
		r.With(s.requireProjectManagement).Delete("/projects/{projectID}/databases/{databaseID}/tables/{tableID}/columns/{columnID}", s.deleteDatabaseColumn)
		r.With(s.requireProjectManagement).Get("/projects/{projectID}/databases/{databaseID}/tables/{tableID}/indexes", s.listDatabaseIndexes)
		r.With(s.requireProjectManagement).Post("/projects/{projectID}/databases/{databaseID}/tables/{tableID}/indexes", s.createDatabaseIndex)
		r.With(s.requireProjectManagement).Delete("/projects/{projectID}/databases/{databaseID}/tables/{tableID}/indexes/{indexID}", s.deleteDatabaseIndex)
		r.With(s.requireProjectDataActor).Get("/projects/{projectID}/databases/{databaseID}/tables/{tableID}/rows", s.listDatabaseRows)
		r.With(s.requireProjectDataActor).Post("/projects/{projectID}/databases/{databaseID}/tables/{tableID}/rows", s.createDatabaseRow)
		r.With(s.requireProjectDataActor).Get("/projects/{projectID}/databases/{databaseID}/tables/{tableID}/rows/{rowID}", s.getDatabaseRow)
		r.With(s.requireProjectDataActor).Patch("/projects/{projectID}/databases/{databaseID}/tables/{tableID}/rows/{rowID}", s.updateDatabaseRow)
		r.With(s.requireProjectDataActor).Delete("/projects/{projectID}/databases/{databaseID}/tables/{tableID}/rows/{rowID}", s.deleteDatabaseRow)
		r.With(s.requireProjectManagement).Get("/projects/{projectID}/storage/buckets", s.listStorageBuckets)
		r.With(s.requireProjectManagement).Post("/projects/{projectID}/storage/buckets", s.createStorageBucket)
		r.With(s.requireProjectManagement).Get("/projects/{projectID}/storage/buckets/{bucketID}", s.getStorageBucket)
		r.With(s.requireProjectManagement).Patch("/projects/{projectID}/storage/buckets/{bucketID}", s.updateStorageBucket)
		r.With(s.requireProjectManagement).Delete("/projects/{projectID}/storage/buckets/{bucketID}", s.deleteStorageBucket)
		r.With(s.requireProjectStorageActor).Get("/projects/{projectID}/storage/buckets/{bucketID}/files", s.listStorageFiles)
		r.With(s.requireProjectStorageActor).Post("/projects/{projectID}/storage/buckets/{bucketID}/files", s.uploadStorageFile)
		r.With(s.requireProjectStorageActor).Get("/projects/{projectID}/storage/buckets/{bucketID}/files/{fileID}", s.getStorageFile)
		r.With(s.requireProjectStorageActor).Patch("/projects/{projectID}/storage/buckets/{bucketID}/files/{fileID}", s.updateStorageFile)
		r.With(s.requireProjectStorageActor).Get("/projects/{projectID}/storage/buckets/{bucketID}/files/{fileID}/download", s.downloadStorageFile)
		r.With(s.requireProjectStorageActor).Delete("/projects/{projectID}/storage/buckets/{bucketID}/files/{fileID}", s.deleteStorageFile)
		r.With(s.requireProjectManagement).Get("/projects/{projectID}/functions", s.listFunctions)
		r.With(s.requireProjectManagement).Post("/projects/{projectID}/functions", s.createFunction)
		r.With(s.requireProjectManagement).Get("/projects/{projectID}/functions/{functionID}", s.getFunction)
		r.With(s.requireProjectManagement).Patch("/projects/{projectID}/functions/{functionID}", s.updateFunction)
		r.With(s.requireProjectManagement).Delete("/projects/{projectID}/functions/{functionID}", s.deleteFunction)
		r.With(s.requireProjectManagement).Get("/projects/{projectID}/functions/{functionID}/variables", s.listFunctionVariables)
		r.With(s.requireProjectManagement).Post("/projects/{projectID}/functions/{functionID}/variables", s.createFunctionVariable)
		r.With(s.requireProjectManagement).Get("/projects/{projectID}/functions/{functionID}/variables/{variableID}", s.getFunctionVariable)
		r.With(s.requireProjectManagement).Patch("/projects/{projectID}/functions/{functionID}/variables/{variableID}", s.updateFunctionVariable)
		r.With(s.requireProjectManagement).Delete("/projects/{projectID}/functions/{functionID}/variables/{variableID}", s.deleteFunctionVariable)
		r.With(s.requireProjectManagement).Get("/projects/{projectID}/functions/{functionID}/deployments", s.listFunctionDeployments)
		r.With(s.requireProjectManagement).Post("/projects/{projectID}/functions/{functionID}/deployments", s.uploadFunctionDeployment)
		r.With(s.requireProjectManagement).Get("/projects/{projectID}/functions/{functionID}/deployments/{deploymentID}", s.getFunctionDeployment)
		r.With(s.requireProjectManagement).Delete("/projects/{projectID}/functions/{functionID}/deployments/{deploymentID}", s.deleteFunctionDeployment)
		r.With(s.requireProjectManagement).Post("/projects/{projectID}/functions/{functionID}/deployments/{deploymentID}/activate", s.activateFunctionDeployment)
		r.With(s.requireProjectManagement).Get("/projects/{projectID}/functions/{functionID}/deployments/{deploymentID}/logs", s.listFunctionBuildLogs)
		r.With(s.requireFunctionExecutionActor).Post("/projects/{projectID}/functions/{functionID}/executions", s.createFunctionExecution)
		r.With(s.requireProjectManagement).Get("/projects/{projectID}/functions/{functionID}/executions", s.listFunctionExecutions)
		r.With(s.requireProjectManagement).Get("/projects/{projectID}/functions/{functionID}/executions/{executionID}", s.getFunctionExecution)
		r.With(s.requireProjectManagement).Get("/projects/{projectID}/functions/{functionID}/executions/{executionID}/logs", s.listFunctionExecutionLogs)
		r.With(s.requireProjectManagement).Get("/projects/{projectID}/sites", s.listSites)
		r.With(s.requireProjectManagement).Post("/projects/{projectID}/sites", s.createSite)
		r.With(s.requireProjectManagement).Get("/projects/{projectID}/sites/{siteID}", s.getSite)
		r.With(s.requireProjectManagement).Patch("/projects/{projectID}/sites/{siteID}", s.updateSite)
		r.With(s.requireProjectManagement).Delete("/projects/{projectID}/sites/{siteID}", s.deleteSite)
		r.With(s.requireProjectManagement).Get("/projects/{projectID}/sites/{siteID}/domains", s.listSiteDomains)
		r.With(s.requireProjectManagement).Post("/projects/{projectID}/sites/{siteID}/domains", s.createSiteDomain)
		r.With(s.requireProjectManagement).Get("/projects/{projectID}/sites/{siteID}/domains/{domainID}", s.getSiteDomain)
		r.With(s.requireProjectManagement).Delete("/projects/{projectID}/sites/{siteID}/domains/{domainID}", s.deleteSiteDomain)
		r.With(s.requireProjectManagement).Post("/projects/{projectID}/sites/{siteID}/domains/{domainID}/verify", s.verifySiteDomain)
		r.With(s.requireProjectManagement).Get("/projects/{projectID}/sites/{siteID}/deployments", s.listSiteDeployments)
		r.With(s.requireProjectManagement).Post("/projects/{projectID}/sites/{siteID}/deployments", s.uploadSiteDeployment)
		r.With(s.requireProjectManagement).Post("/projects/{projectID}/sites/{siteID}/deployments/git", s.createGitSiteDeployment)
		r.With(s.requireProjectManagement).Get("/projects/{projectID}/sites/{siteID}/deployments/{deploymentID}", s.getSiteDeployment)
		r.With(s.requireProjectManagement).Delete("/projects/{projectID}/sites/{siteID}/deployments/{deploymentID}", s.deleteSiteDeployment)
		r.With(s.requireProjectManagement).Post("/projects/{projectID}/sites/{siteID}/deployments/{deploymentID}/activate", s.activateSiteDeployment)
		r.With(s.requireProjectManagement).Get("/projects/{projectID}/sites/{siteID}/deployments/{deploymentID}/logs", s.listSiteBuildLogs)
		r.Get("/sites/{siteID}", s.serveSiteFile)
		r.Get("/sites/{siteID}/*", s.serveSiteFile)
		r.Post("/projects/{projectID}/account/registrations", s.registerProjectUser)
		r.Post("/projects/{projectID}/sessions/email-password", s.loginProjectUser)
		r.With(s.requireProjectAppSession).Get("/projects/{projectID}/account", s.currentProjectUser)
		r.With(s.requireProjectAppSession).Post("/projects/{projectID}/account/verification", s.sendProjectUserVerification)
		r.Put("/projects/{projectID}/account/verification", s.confirmProjectUserVerification)
		r.Post("/projects/{projectID}/account/recovery", s.createProjectUserRecovery)
		r.Put("/projects/{projectID}/account/recovery", s.confirmProjectUserRecovery)
		r.With(s.requireProjectAppSession).Delete("/projects/{projectID}/session", s.logoutProjectUser)
	})
	// A reverse proxy can forward custom-domain traffic to the same API. The
	// hostname is resolved against verified Site domains; unknown hosts return
	// 404 and never fall back to an arbitrary project artifact.
	r.Get("/", s.serveCustomDomainFile)
	r.Get("/*", s.serveCustomDomainFile)
	return r
}

type contextKey string

const accountContextKey contextKey = "account"
const sessionContextKey contextKey = "session"
const projectUserContextKey contextKey = "project-user"
const projectUserSessionContextKey contextKey = "project-user-session"
const projectActorContextKey contextKey = "project-actor"

type projectActorKind string

const (
	consoleProjectActor projectActorKind = "console"
	apiKeyProjectActor  projectActorKind = "api_key"
)

type projectActor struct {
	kind     projectActorKind
	apiKeyID uuid.UUID
	scopes   []string
}

type apiError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}
type errorEnvelope struct {
	Error apiError `json:"error"`
}
type pagination struct {
	Limit      int     `json:"limit"`
	NextCursor *string `json:"next_cursor"`
}

func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) metricsHandler(w http.ResponseWriter, r *http.Request) {
	if s.metrics == nil {
		http.NotFound(w, r)
		return
	}
	s.metrics.Handler().ServeHTTP(w, r)
}

func (s *Server) ready(w http.ResponseWriter, r *http.Request) {
	if err := s.repo.Ping(r.Context()); err != nil {
		writeError(w, http.StatusServiceUnavailable, "not_ready", "database is not ready")
		return
	}
	if !s.storageReady || s.storage == nil {
		writeError(w, http.StatusServiceUnavailable, "not_ready", "storage is not ready")
		return
	}
	if !s.functionsReady || s.functions == nil || s.functionCipher == nil {
		writeError(w, http.StatusServiceUnavailable, "not_ready", "function services are not ready")
		return
	}
	if !s.sitesReady || s.sites == nil || s.siteArchives == nil {
		writeError(w, http.StatusServiceUnavailable, "not_ready", "site services are not ready")
		return
	}
	if err := s.limiter.Ping(r.Context()); err != nil {
		s.logger.Error("rate limiter is not ready", "error", err)
		writeError(w, http.StatusServiceUnavailable, "not_ready", "rate limiter is not ready")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ready"})
}

type registerRequest struct {
	Email            string `json:"email"`
	Password         string `json:"password"`
	OrganizationName string `json:"organization_name"`
}

func (s *Server) register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	email, err := validate.Email(req.Email)
	if err != nil {
		writeError(w, 422, "validation_error", err.Error())
		return
	}
	// Console registration is public just like project registration. Apply
	// both the aggregate IP bucket and the email/IP bucket before doing the
	// expensive password hash or creating tenant rows.
	if !s.allowAccountAuth(w, r, "registration", email) {
		return
	}
	if err := auth.ValidatePassword(req.Password); err != nil {
		writeError(w, 422, "validation_error", err.Error())
		return
	}
	name := req.OrganizationName
	if strings.TrimSpace(name) == "" {
		name = strings.Split(email, "@")[0] + "'s organization"
	}
	name, err = validate.Name(name, "organization_name")
	if err != nil {
		writeError(w, 422, "validation_error", err.Error())
		return
	}
	accountID := uuid.Must(uuid.NewV7())
	orgID := uuid.Must(uuid.NewV7())
	sessionID := uuid.Must(uuid.NewV7())
	passwordHash, err := auth.HashPassword(req.Password)
	if err != nil {
		writeError(w, 500, "internal_error", "unable to create account")
		return
	}
	token, tokenHash, err := auth.NewSessionToken()
	if err != nil {
		writeError(w, 500, "internal_error", "unable to create session")
		return
	}
	orgSlug := "personal-" + strings.ReplaceAll(orgID.String(), "-", "")[:16]
	account, org, err := s.repo.Signup(r.Context(), repository.SignupInput{AccountID: accountID, OrganizationID: orgID, SessionID: sessionID, Email: email, PasswordHash: passwordHash, OrganizationName: name, OrganizationSlug: orgSlug, TokenHash: tokenHash, SessionExpiresAt: time.Now().UTC().Add(s.config.SessionTTL)})
	if err != nil {
		if errors.Is(err, repository.ErrConflict) {
			writeError(w, 409, "conflict", "an account with this email already exists")
			return
		}
		s.logger.Error("signup failed", "error", err)
		writeError(w, 500, "internal_error", "unable to create account")
		return
	}
	s.setSessionCookie(w, token)
	s.issueAccountVerification(r, accountID, account.Email)
	writeJSON(w, http.StatusCreated, map[string]any{"account": account, "organization": org})
}
func (s *Server) currentAccount(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]domain.Account{"account": accountFrom(r)})
}

func (s *Server) registerProjectUser(w http.ResponseWriter, r *http.Request) {
	projectID, ok := pathUUID(w, r, "projectID")
	if !ok {
		return
	}
	var req projectUserRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	enabled, err := s.repo.ProjectRegistrationEnabled(r.Context(), projectID)
	if projectSettingsError(w, err) {
		return
	}
	if err != nil {
		internalError(s, w, err)
		return
	}
	if !enabled {
		writeError(w, http.StatusForbidden, "registration_disabled", "public registration is disabled for this project")
		return
	}
	email, err := validate.Email(req.Email)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "validation_error", err.Error())
		return
	}
	if err := auth.ValidatePassword(req.Password); err != nil {
		writeError(w, http.StatusUnprocessableEntity, "validation_error", err.Error())
		return
	}
	name, err := optionalProjectUserName(req.Name)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "validation_error", err.Error())
		return
	}
	if !s.allowPublicAuth(w, r, "registration", projectID, email) {
		return
	}
	passwordHash, err := auth.HashPassword(req.Password)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "unable to create application session")
		return
	}
	token, tokenHash, err := auth.NewSessionToken()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "unable to create application session")
		return
	}
	item, err := s.repo.RegisterProjectUser(r.Context(), uuid.Must(uuid.NewV7()), uuid.Must(uuid.NewV7()), projectID, email, passwordHash, name, tokenHash, time.Now().UTC().Add(s.config.AppSessionTTL))
	if errors.Is(err, repository.ErrRegistrationDisabled) {
		writeError(w, http.StatusForbidden, "registration_disabled", "public registration is disabled for this project")
		return
	}
	if errors.Is(err, repository.ErrConflict) {
		writeError(w, http.StatusConflict, "conflict", "an application user with this email already exists in the project")
		return
	}
	if projectSettingsError(w, err) {
		return
	}
	if err != nil {
		internalError(s, w, err)
		return
	}
	s.setProjectSessionCookie(w, projectID, token)
	userID, userIDErr := repository.ParseUUID(item.ID)
	if userIDErr == nil {
		s.issueProjectUserVerification(r, projectID, userID, item.Email)
	} else {
		s.logger.Error("project verification setup failed", "project_id", projectID, "user_id", item.ID, "error", userIDErr)
	}
	writeJSON(w, http.StatusCreated, map[string]domain.ApplicationUser{"account": item})
}

func (s *Server) loginProjectUser(w http.ResponseWriter, r *http.Request) {
	projectID, ok := pathUUID(w, r, "projectID")
	if !ok {
		return
	}
	var req loginRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	normalizedEmail := strings.ToLower(strings.TrimSpace(req.Email))
	email, validationErr := validate.Email(req.Email)
	if validationErr == nil {
		normalizedEmail = email
	}
	if !s.allowPublicAuth(w, r, "login", projectID, normalizedEmail) {
		return
	}
	if len(req.Password) > 256 {
		// Do dummy Argon2id work without loading or verifying the user's real
		// hash. This bounds work for oversized credentials while preserving the
		// same invalid-credentials response as unknown accounts.
		auth.VerifyPasswordOrDummy("", req.Password)
		writeError(w, http.StatusUnauthorized, "invalid_credentials", "invalid email or password")
		return
	}
	if validationErr != nil {
		auth.VerifyPasswordOrDummy("", req.Password)
		writeError(w, http.StatusUnauthorized, "invalid_credentials", "invalid email or password")
		return
	}
	userID, passwordHash, status, err := s.repo.ApplicationUserPassword(r.Context(), projectID, email)
	if errors.Is(err, repository.ErrNotFound) {
		auth.VerifyPasswordOrDummy("", req.Password)
		writeError(w, http.StatusUnauthorized, "invalid_credentials", "invalid email or password")
		return
	}
	if err != nil {
		internalError(s, w, err)
		return
	}
	validPassword := auth.VerifyPasswordOrDummy(passwordHash, req.Password)
	if !validPassword || status != "active" {
		writeError(w, http.StatusUnauthorized, "invalid_credentials", "invalid email or password")
		return
	}
	token, tokenHash, err := auth.NewSessionToken()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "unable to create application session")
		return
	}
	err = s.repo.CreateProjectUserSession(r.Context(), uuid.Must(uuid.NewV7()), projectID, userID, tokenHash, time.Now().UTC().Add(s.config.AppSessionTTL))
	if errors.Is(err, repository.ErrForbidden) || errors.Is(err, repository.ErrNotFound) {
		writeError(w, http.StatusUnauthorized, "invalid_credentials", "invalid email or password")
		return
	}
	if err != nil {
		internalError(s, w, err)
		return
	}
	s.setProjectSessionCookie(w, projectID, token)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) currentProjectUser(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]domain.ApplicationUser{"account": projectUserFrom(r)})
}

func (s *Server) logoutProjectUser(w http.ResponseWriter, r *http.Request) {
	projectID, ok := pathUUID(w, r, "projectID")
	if !ok {
		return
	}
	if err := s.repo.DeleteProjectUserSession(r.Context(), projectID, projectUserSessionFrom(r)); err != nil {
		internalError(s, w, err)
		return
	}
	s.clearProjectSessionCookie(w, projectID)
	w.WriteHeader(http.StatusNoContent)
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	// Rate-limit before credential lookup (and before Argon2id work) so
	// unknown addresses and malformed passwords cannot turn this endpoint into
	// an unbounded CPU or account-enumeration oracle.
	normalizedEmail := strings.ToLower(strings.TrimSpace(req.Email))
	if !s.allowAccountAuth(w, r, "login", normalizedEmail) {
		return
	}
	email, err := validate.Email(req.Email)
	if err != nil {
		auth.VerifyPasswordOrDummy("", req.Password)
		writeError(w, 401, "invalid_credentials", "invalid email or password")
		return
	}
	accountID, hash, err := s.repo.AccountPassword(r.Context(), email)
	if errors.Is(err, repository.ErrNotFound) {
		auth.VerifyPasswordOrDummy("", req.Password)
		writeError(w, 401, "invalid_credentials", "invalid email or password")
		return
	}
	if err != nil {
		s.logger.Error("account lookup failed", "error", err)
		writeError(w, 500, "internal_error", "unable to create session")
		return
	}
	if !auth.VerifyPasswordOrDummy(hash, req.Password) {
		writeError(w, 401, "invalid_credentials", "invalid email or password")
		return
	}
	token, tokenHash, err := auth.NewSessionToken()
	if err != nil {
		writeError(w, 500, "internal_error", "unable to create session")
		return
	}
	if err = s.repo.CreateSession(r.Context(), uuid.Must(uuid.NewV7()), accountID, tokenHash, time.Now().UTC().Add(s.config.SessionTTL)); err != nil {
		s.logger.Error("session creation failed", "error", err)
		writeError(w, 500, "internal_error", "unable to create session")
		return
	}
	s.setSessionCookie(w, token)
	w.WriteHeader(http.StatusNoContent)
}
func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	if err := s.repo.DeleteSession(r.Context(), sessionFrom(r), uuid.Must(uuid.Parse(accountFrom(r).ID))); err != nil {
		s.logger.Error("logout failed", "error", err)
		writeError(w, 500, "internal_error", "unable to delete session")
		return
	}
	s.clearSessionCookie(w)
	w.WriteHeader(http.StatusNoContent)
}
func (s *Server) listOrganizations(w http.ResponseWriter, r *http.Request) {
	limit, cursor, ok := page(w, r)
	if !ok {
		return
	}
	items, next, err := s.repo.ListOrganizations(r.Context(), uuid.Must(uuid.Parse(accountFrom(r).ID)), limit, cursor)
	if err != nil {
		internalError(s, w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"organizations": items, "pagination": paginationOf(limit, next)})
}

type organizationRequest struct {
	Name string `json:"name"`
	Slug string `json:"slug"`
}

func (s *Server) createOrganization(w http.ResponseWriter, r *http.Request) {
	var req organizationRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	name, err := validate.Name(req.Name, "name")
	if err != nil {
		writeError(w, 422, "validation_error", err.Error())
		return
	}
	slug, err := validate.Slug(req.Slug, "slug")
	if err != nil {
		writeError(w, 422, "validation_error", err.Error())
		return
	}
	item, err := s.repo.CreateOrganization(r.Context(), uuid.Must(uuid.NewV7()), uuid.Must(uuid.Parse(accountFrom(r).ID)), name, slug)
	if err != nil {
		if errors.Is(err, repository.ErrConflict) {
			writeError(w, 409, "conflict", "organization slug is already in use")
			return
		}
		internalError(s, w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]domain.Organization{"organization": item})
}

func (s *Server) updateOrganization(w http.ResponseWriter, r *http.Request) {
	organizationID, ok := pathUUID(w, r, "organizationID")
	if !ok {
		return
	}
	var req organizationRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	name, err := validate.Name(req.Name, "name")
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "validation_error", err.Error())
		return
	}
	slug, err := validate.Slug(req.Slug, "slug")
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "validation_error", err.Error())
		return
	}
	item, err := s.repo.UpdateOrganization(r.Context(), organizationID, mustUUID(accountFrom(r).ID), name, slug)
	if errors.Is(err, repository.ErrNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "organization was not found")
		return
	}
	if errors.Is(err, repository.ErrForbidden) {
		writeError(w, http.StatusForbidden, "forbidden", "only organization owners and admins can change organization settings")
		return
	}
	if errors.Is(err, repository.ErrConflict) {
		writeError(w, http.StatusConflict, "conflict", "organization slug is already in use")
		return
	}
	if err != nil {
		internalError(s, w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]domain.Organization{"organization": item})
}
func (s *Server) listMemberships(w http.ResponseWriter, r *http.Request) {
	orgID, ok := pathUUID(w, r, "organizationID")
	if !ok {
		return
	}
	limit, cursor, ok := page(w, r)
	if !ok {
		return
	}
	items, next, canManage, err := s.repo.ListMemberships(r.Context(), orgID, uuid.Must(uuid.Parse(accountFrom(r).ID)), limit, cursor)
	if authzError(w, err) {
		return
	}
	if err != nil {
		internalError(s, w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"memberships": items, "pagination": paginationOf(limit, next), "can_manage": canManage})
}
func (s *Server) listProjects(w http.ResponseWriter, r *http.Request) {
	orgID, ok := pathUUID(w, r, "organizationID")
	if !ok {
		return
	}
	limit, cursor, ok := page(w, r)
	if !ok {
		return
	}
	items, next, err := s.repo.ListProjects(r.Context(), orgID, uuid.Must(uuid.Parse(accountFrom(r).ID)), limit, cursor)
	if authzError(w, err) {
		return
	}
	if err != nil {
		internalError(s, w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"projects": items, "pagination": paginationOf(limit, next)})
}

type projectRequest struct {
	Name string `json:"name"`
}

func (s *Server) createProject(w http.ResponseWriter, r *http.Request) {
	orgID, ok := pathUUID(w, r, "organizationID")
	if !ok {
		return
	}
	var req projectRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	name, err := validate.Slug(req.Name, "name")
	if err != nil {
		writeError(w, 422, "validation_error", err.Error())
		return
	}
	item, err := s.repo.CreateProject(r.Context(), uuid.Must(uuid.NewV7()), orgID, uuid.Must(uuid.Parse(accountFrom(r).ID)), name)
	if authzError(w, err) {
		return
	}
	if err != nil {
		if errors.Is(err, repository.ErrConflict) {
			writeError(w, 409, "conflict", "a project with this name already exists in the organization")
			return
		}
		internalError(s, w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]domain.Project{"project": item})
}
func (s *Server) getProject(w http.ResponseWriter, r *http.Request) {
	projectID, ok := pathUUID(w, r, "projectID")
	if !ok {
		return
	}
	item, err := s.repo.ProjectByID(r.Context(), projectID, uuid.Must(uuid.Parse(accountFrom(r).ID)))
	if errors.Is(err, repository.ErrNotFound) {
		writeError(w, 404, "not_found", "project was not found")
		return
	}
	if err != nil {
		internalError(s, w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]domain.Project{"project": item})
}

func (s *Server) updateProject(w http.ResponseWriter, r *http.Request) {
	projectID, ok := pathUUID(w, r, "projectID")
	if !ok {
		return
	}
	var req projectRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	name, err := validate.Slug(req.Name, "name")
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "validation_error", err.Error())
		return
	}
	item, err := s.repo.UpdateProject(r.Context(), projectID, uuid.Must(uuid.Parse(accountFrom(r).ID)), name)
	if projectUpdateError(w, err) {
		return
	}
	if errors.Is(err, repository.ErrConflict) {
		writeError(w, http.StatusConflict, "conflict", "a project with this name already exists in the organization")
		return
	}
	if err != nil {
		internalError(s, w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]domain.Project{"project": item})
}

type deleteProjectRequest struct {
	ConfirmName string `json:"confirm_name"`
}

// deleteProject permanently removes a project. Requiring the exact current
// project name in the request body makes destructive automation explicit while
// keeping the authorization decision in the repository transaction.
func (s *Server) deleteProject(w http.ResponseWriter, r *http.Request) {
	projectID, ok := pathUUID(w, r, "projectID")
	if !ok {
		return
	}
	var req deleteProjectRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if strings.TrimSpace(req.ConfirmName) == "" {
		writeError(w, http.StatusUnprocessableEntity, "validation_error", "confirm_name must be the exact project name")
		return
	}
	accountID := uuid.Must(uuid.Parse(accountFrom(r).ID))
	if err := s.repo.DeleteProject(r.Context(), projectID, accountID, req.ConfirmName); err != nil {
		switch {
		case errors.Is(err, repository.ErrNotFound):
			writeError(w, http.StatusNotFound, "not_found", "project was not found")
		case errors.Is(err, repository.ErrForbidden):
			writeError(w, http.StatusForbidden, "forbidden", "only the project owner can delete this project")
		case errors.Is(err, repository.ErrConfirmationRequired):
			writeError(w, http.StatusUnprocessableEntity, "validation_error", "confirm_name must be the exact project name")
		default:
			internalError(s, w, err)
		}
		return
	}
	// Database deletion is already committed. Filesystem cleanup is deliberately
	// best-effort: an orphaned opaque artifact is unreachable without a live
	// project row, while returning a 500 would make clients retry a completed
	// destructive operation and obscure the actual state.
	if s.storage != nil {
		if err := s.storage.RemoveProject(projectID); err != nil {
			s.logger.Warn("project storage cleanup failed", "project_id", projectID, "error", err)
		}
	}
	if s.functions != nil {
		if err := s.functions.RemoveProject(projectID); err != nil {
			s.logger.Warn("project function artifact cleanup failed", "project_id", projectID, "error", err)
		}
	}
	if s.siteArchives != nil {
		if err := s.siteArchives.RemoveProject(projectID); err != nil {
			s.logger.Warn("project site source cleanup failed", "project_id", projectID, "error", err)
		}
	}
	if s.sites != nil {
		if err := s.sites.RemoveProject(projectID); err != nil {
			s.logger.Warn("project site artifact cleanup failed", "project_id", projectID, "error", err)
		}
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) listProjectUsers(w http.ResponseWriter, r *http.Request) {
	projectID, ok := pathUUID(w, r, "projectID")
	if !ok {
		return
	}
	limit, cursor, ok := page(w, r)
	if !ok {
		return
	}
	var cursorID *uuid.UUID
	if cursor != "" {
		parsed := uuid.Must(uuid.Parse(cursor))
		cursorID = &parsed
	}
	actor := projectActorFrom(r)
	if actor.kind == apiKeyProjectActor && !apikey.HasScope(actor.scopes, "users.read") {
		writeError(w, http.StatusForbidden, "forbidden", "API key is missing the users.read scope")
		return
	}
	var items []domain.ApplicationUser
	var next string
	var canManage bool
	var err error
	if actor.kind == apiKeyProjectActor {
		items, next, err = s.repo.ListProjectUsersByAPIKey(r.Context(), projectID, limit, cursorID)
		canManage = apikey.HasScope(actor.scopes, "users.write")
	} else {
		items, next, canManage, err = s.repo.ListProjectUsers(r.Context(), projectID, uuid.Must(uuid.Parse(accountFrom(r).ID)), limit, cursorID)
	}
	if projectResourceError(w, err) {
		return
	}
	if err != nil {
		internalError(s, w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"users": items, "pagination": paginationOf(limit, next), "can_manage": canManage})
}

type projectUserRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

func (s *Server) createProjectUser(w http.ResponseWriter, r *http.Request) {
	projectID, ok := pathUUID(w, r, "projectID")
	if !ok {
		return
	}
	var req projectUserRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	email, err := validate.Email(req.Email)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "validation_error", err.Error())
		return
	}
	if err := auth.ValidatePassword(req.Password); err != nil {
		writeError(w, http.StatusUnprocessableEntity, "validation_error", err.Error())
		return
	}
	var name *string
	if strings.TrimSpace(req.Name) != "" {
		validated, err := validate.Name(req.Name, "name")
		if err != nil {
			writeError(w, http.StatusUnprocessableEntity, "validation_error", err.Error())
			return
		}
		name = &validated
	}
	actor := projectActorFrom(r)
	if actor.kind == apiKeyProjectActor {
		if !apikey.HasScope(actor.scopes, "users.write") {
			writeError(w, http.StatusForbidden, "forbidden", "API key is missing the users.write scope")
			return
		}
	} else {
		if err := s.repo.AuthorizeProjectUserWrite(r.Context(), projectID, uuid.Must(uuid.Parse(accountFrom(r).ID))); projectResourceError(w, err) {
			return
		} else if err != nil {
			internalError(s, w, err)
			return
		}
	}
	passwordHash, err := auth.HashPassword(req.Password)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "unable to create application user")
		return
	}
	var item domain.ApplicationUser
	if actor.kind == apiKeyProjectActor {
		item, err = s.repo.CreateProjectUserByAPIKey(r.Context(), uuid.Must(uuid.NewV7()), projectID, actor.apiKeyID, email, passwordHash, name)
	} else {
		item, err = s.repo.CreateProjectUser(r.Context(), uuid.Must(uuid.NewV7()), projectID, uuid.Must(uuid.Parse(accountFrom(r).ID)), email, passwordHash, name)
	}
	if projectResourceError(w, err) {
		return
	}
	if errors.Is(err, repository.ErrConflict) {
		writeError(w, http.StatusConflict, "conflict", "an application user with this email already exists in the project")
		return
	}
	if err != nil {
		internalError(s, w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]domain.ApplicationUser{"user": item})
}

func (s *Server) getProjectUser(w http.ResponseWriter, r *http.Request) {
	projectID, ok := pathUUID(w, r, "projectID")
	if !ok {
		return
	}
	userID, ok := pathUUID(w, r, "userID")
	if !ok {
		return
	}
	actor := projectActorFrom(r)
	if actor.kind == apiKeyProjectActor && !apikey.HasScope(actor.scopes, "users.read") {
		writeError(w, http.StatusForbidden, "forbidden", "API key is missing the users.read scope")
		return
	}
	var item domain.ApplicationUser
	var err error
	if actor.kind == apiKeyProjectActor {
		item, err = s.repo.ProjectUserByIDForAPIKey(r.Context(), projectID, userID)
	} else {
		item, err = s.repo.ProjectUserByID(r.Context(), projectID, userID, uuid.Must(uuid.Parse(accountFrom(r).ID)))
	}
	if projectResourceError(w, err) {
		return
	}
	if err != nil {
		internalError(s, w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]domain.ApplicationUser{"user": item})
}

type projectUserStatusRequest struct {
	Status string `json:"status"`
}

func (s *Server) updateProjectUserStatus(w http.ResponseWriter, r *http.Request) {
	projectID, ok := pathUUID(w, r, "projectID")
	if !ok {
		return
	}
	userID, ok := pathUUID(w, r, "userID")
	if !ok {
		return
	}
	var req projectUserStatusRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if req.Status != "active" && req.Status != "blocked" {
		writeError(w, http.StatusUnprocessableEntity, "validation_error", "status must be active or blocked")
		return
	}
	actor := projectActorFrom(r)
	if actor.kind == apiKeyProjectActor && !apikey.HasScope(actor.scopes, "users.write") {
		writeError(w, http.StatusForbidden, "forbidden", "API key is missing the users.write scope")
		return
	}
	var item domain.ApplicationUser
	var err error
	if actor.kind == apiKeyProjectActor {
		item, err = s.repo.UpdateProjectUserStatusByAPIKey(r.Context(), projectID, userID, actor.apiKeyID, req.Status)
	} else {
		item, err = s.repo.UpdateProjectUserStatus(r.Context(), projectID, userID, uuid.Must(uuid.Parse(accountFrom(r).ID)), req.Status)
	}
	if projectResourceError(w, err) {
		return
	}
	if err != nil {
		internalError(s, w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]domain.ApplicationUser{"user": item})
}

func (s *Server) deleteProjectUser(w http.ResponseWriter, r *http.Request) {
	projectID, ok := pathUUID(w, r, "projectID")
	if !ok {
		return
	}
	userID, ok := pathUUID(w, r, "userID")
	if !ok {
		return
	}
	actor := projectActorFrom(r)
	var err error
	if actor.kind == apiKeyProjectActor {
		if !apikey.HasScope(actor.scopes, "users.write") {
			writeError(w, http.StatusForbidden, "forbidden", "API key is missing the users.write scope")
			return
		}
		err = s.repo.DeleteProjectUserByAPIKey(r.Context(), projectID, userID, actor.apiKeyID)
	} else {
		err = s.repo.DeleteProjectUser(r.Context(), projectID, userID, uuid.Must(uuid.Parse(accountFrom(r).ID)))
	}
	if projectResourceError(w, err) {
		return
	}
	if err != nil {
		internalError(s, w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type projectAPIKeyRequest struct {
	Name      string   `json:"name"`
	Scopes    []string `json:"scopes"`
	ExpiresAt *string  `json:"expires_at"`
}

func (s *Server) listProjectAPIKeys(w http.ResponseWriter, r *http.Request) {
	projectID, ok := pathUUID(w, r, "projectID")
	if !ok {
		return
	}
	limit, cursor, ok := page(w, r)
	if !ok {
		return
	}
	var cursorID *uuid.UUID
	if cursor != "" {
		parsed := uuid.Must(uuid.Parse(cursor))
		cursorID = &parsed
	}
	items, next, canManage, err := s.repo.ListProjectAPIKeys(r.Context(), projectID, uuid.Must(uuid.Parse(accountFrom(r).ID)), limit, cursorID)
	if projectAPIKeyResourceError(w, err) {
		return
	}
	if err != nil {
		internalError(s, w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"keys": items, "pagination": paginationOf(limit, next), "can_manage": canManage})
}

func (s *Server) createProjectAPIKey(w http.ResponseWriter, r *http.Request) {
	projectID, ok := pathUUID(w, r, "projectID")
	if !ok {
		return
	}
	var req projectAPIKeyRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	name, err := validate.Name(req.Name, "name")
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "validation_error", err.Error())
		return
	}
	scopes, err := apikey.NormalizeProjectScopes(req.Scopes)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "validation_error", "scopes must contain supported users.read, users.write, databases.read, databases.write, storage.read, storage.write, functions.read, functions.write, sites.read, sites.write, webhooks.read, webhooks.write, realtime.read, messaging.read, or messaging.write values")
		return
	}
	expiresAt, err := parseAPIKeyExpiry(req.ExpiresAt, time.Now().UTC())
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "validation_error", err.Error())
		return
	}
	secret, prefix, secretHash, err := apikey.NewSecret()
	if err != nil {
		internalError(s, w, err)
		return
	}
	item, err := s.repo.CreateProjectAPIKey(r.Context(), uuid.Must(uuid.NewV7()), projectID, uuid.Must(uuid.Parse(accountFrom(r).ID)), name, prefix, secretHash, scopes, expiresAt)
	if projectAPIKeyResourceError(w, err) {
		return
	}
	if errors.Is(err, repository.ErrConflict) {
		writeError(w, http.StatusConflict, "conflict", "the API key could not be created")
		return
	}
	if err != nil {
		internalError(s, w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"key": item, "secret": secret})
}

func (s *Server) getProjectAPIKey(w http.ResponseWriter, r *http.Request) {
	projectID, ok := pathUUID(w, r, "projectID")
	if !ok {
		return
	}
	keyID, ok := pathUUID(w, r, "keyID")
	if !ok {
		return
	}
	item, err := s.repo.ProjectAPIKeyByID(r.Context(), projectID, keyID, uuid.Must(uuid.Parse(accountFrom(r).ID)))
	if projectAPIKeyResourceError(w, err) {
		return
	}
	if err != nil {
		internalError(s, w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]domain.ProjectAPIKey{"key": item})
}

func (s *Server) revokeProjectAPIKey(w http.ResponseWriter, r *http.Request) {
	projectID, ok := pathUUID(w, r, "projectID")
	if !ok {
		return
	}
	keyID, ok := pathUUID(w, r, "keyID")
	if !ok {
		return
	}
	err := s.repo.RevokeProjectAPIKey(r.Context(), projectID, keyID, uuid.Must(uuid.Parse(accountFrom(r).ID)))
	if projectAPIKeyResourceError(w, err) {
		return
	}
	if err != nil {
		internalError(s, w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func parseAPIKeyExpiry(raw *string, now time.Time) (*time.Time, error) {
	if raw == nil || strings.TrimSpace(*raw) == "" {
		if raw != nil {
			return nil, errors.New("expires_at must be a future RFC3339 timestamp when provided")
		}
		return nil, nil
	}
	expiresAt, err := time.Parse(time.RFC3339, strings.TrimSpace(*raw))
	if err != nil {
		return nil, errors.New("expires_at must be a future RFC3339 timestamp")
	}
	expiresAt = expiresAt.UTC()
	if err := apikey.ValidateExpiry(&expiresAt, now); err != nil {
		return nil, errors.New("expires_at must be within 365 days")
	}
	return &expiresAt, nil
}

type projectAuthSettingsRequest struct {
	RegistrationEnabled *bool     `json:"registration_enabled"`
	CORSOrigins         *[]string `json:"cors_origins"`
}

func (s *Server) getProjectAuthSettings(w http.ResponseWriter, r *http.Request) {
	projectID, ok := pathUUID(w, r, "projectID")
	if !ok {
		return
	}
	item, canManage, err := s.repo.ProjectAuthSettings(r.Context(), projectID, uuid.Must(uuid.Parse(accountFrom(r).ID)))
	if projectSettingsError(w, err) {
		return
	}
	if err != nil {
		internalError(s, w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"settings": item, "can_manage": canManage})
}

func (s *Server) updateProjectAuthSettings(w http.ResponseWriter, r *http.Request) {
	projectID, ok := pathUUID(w, r, "projectID")
	if !ok {
		return
	}
	var req projectAuthSettingsRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if req.RegistrationEnabled == nil && req.CORSOrigins == nil {
		writeError(w, http.StatusUnprocessableEntity, "validation_error", "registration_enabled or cors_origins is required")
		return
	}
	var origins *[]string
	if req.CORSOrigins != nil {
		normalized, normalizeErr := repository.NormalizeCORSOrigins(*req.CORSOrigins)
		if normalizeErr != nil {
			writeError(w, http.StatusUnprocessableEntity, "validation_error", "cors_origins must contain up to 32 valid HTTP(S) origins without paths or wildcards")
			return
		}
		origins = &normalized
	}
	item, err := s.repo.UpdateProjectAuthSettings(r.Context(), projectID, uuid.Must(uuid.Parse(accountFrom(r).ID)), req.RegistrationEnabled, origins)
	if projectSettingsError(w, err) {
		return
	}
	if err != nil {
		internalError(s, w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"settings": item, "can_manage": true})
}

func optionalProjectUserName(value string) (*string, error) {
	if strings.TrimSpace(value) == "" {
		return nil, nil
	}
	validated, err := validate.Name(value, "name")
	if err != nil {
		return nil, err
	}
	return &validated, nil
}

func (s *Server) requireProjectManagement(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		projectID, err := repository.ParseUUID(chi.URLParam(r, "projectID"))
		if err != nil {
			writeError(w, http.StatusBadRequest, "validation_error", "projectID must be a UUID")
			return
		}
		// An explicit server key takes precedence over any ambient Console
		// cookie, so its project binding and scopes can never be bypassed by a
		// browser session. The application-user cookie is intentionally ignored.
		secret := r.Header.Get("X-Stealth-Key")
		if secret != "" {
			if err := apikey.ValidateSecret(secret); err != nil {
				if !s.allowFailedProjectAPIKeyAuth(w, r, projectID) {
					return
				}
				writeError(w, http.StatusUnauthorized, "unauthorized", "authentication is required")
				return
			}
			key, err := s.repo.AuthenticateProjectAPIKey(r.Context(), projectID, apikey.HashSecret(secret))
			if errors.Is(err, repository.ErrNotFound) {
				if !s.allowFailedProjectAPIKeyAuth(w, r, projectID) {
					return
				}
				writeError(w, http.StatusUnauthorized, "unauthorized", "authentication is required")
				return
			}
			if err != nil {
				internalError(s, w, err)
				return
			}
			keyID, err := repository.ParseUUID(key.ID)
			if err != nil {
				internalError(s, w, err)
				return
			}
			if err := s.repo.TouchProjectAPIKey(r.Context(), keyID); err != nil {
				internalError(s, w, err)
				return
			}
			ctx := context.WithValue(r.Context(), projectActorContextKey, projectActor{kind: apiKeyProjectActor, apiKeyID: keyID, scopes: key.Scopes})
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}

		if cookie, err := r.Cookie(s.config.SessionCookieName); err == nil && cookie.Value != "" {
			account, sessionID, err := s.repo.AccountBySession(r.Context(), auth.HashSessionToken(cookie.Value))
			if err != nil {
				writeError(w, http.StatusUnauthorized, "unauthorized", "authentication is required")
				return
			}
			ctx := context.WithValue(r.Context(), accountContextKey, account)
			ctx = context.WithValue(ctx, sessionContextKey, sessionID)
			ctx = context.WithValue(ctx, projectActorContextKey, projectActor{kind: consoleProjectActor})
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}
		writeError(w, http.StatusUnauthorized, "unauthorized", "authentication is required")
	})
}

// requireFunctionExecutionActor accepts the three actors that may invoke a
// function: a Console/API-key management actor, an authenticated project
// user, or an anonymous caller when the function grants "any". Credentials
// are explicit and ordered; a malformed credential never falls through to a
// weaker actor.
func (s *Server) requireFunctionExecutionActor(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		projectID, err := repository.ParseUUID(chi.URLParam(r, "projectID"))
		if err != nil {
			writeError(w, http.StatusBadRequest, "validation_error", "projectID must be a UUID")
			return
		}
		if secret := r.Header.Get("X-Stealth-Key"); secret != "" {
			if err := apikey.ValidateSecret(secret); err != nil {
				if !s.allowFailedProjectAPIKeyAuth(w, r, projectID) {
					return
				}
				writeError(w, http.StatusUnauthorized, "unauthorized", "authentication is required")
				return
			}
			key, err := s.repo.AuthenticateProjectAPIKey(r.Context(), projectID, apikey.HashSecret(secret))
			if errors.Is(err, repository.ErrNotFound) {
				if !s.allowFailedProjectAPIKeyAuth(w, r, projectID) {
					return
				}
				writeError(w, http.StatusUnauthorized, "unauthorized", "authentication is required")
				return
			}
			if err != nil {
				internalError(s, w, err)
				return
			}
			keyID, err := repository.ParseUUID(key.ID)
			if err != nil {
				internalError(s, w, err)
				return
			}
			if err := s.repo.TouchProjectAPIKey(r.Context(), keyID); err != nil {
				internalError(s, w, err)
				return
			}
			ctx := context.WithValue(r.Context(), projectActorContextKey, projectActor{kind: apiKeyProjectActor, apiKeyID: keyID, scopes: key.Scopes})
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}
		if cookie, err := r.Cookie(projectSessionCookieName(projectID)); err == nil && cookie.Value != "" {
			user, _, err := s.repo.ApplicationUserBySession(r.Context(), projectID, auth.HashSessionToken(cookie.Value))
			if errors.Is(err, repository.ErrNotFound) {
				writeError(w, http.StatusUnauthorized, "unauthorized", "application authentication is required")
				return
			}
			if err != nil {
				internalError(s, w, err)
				return
			}
			ctx := context.WithValue(r.Context(), projectUserContextKey, user)
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}
		if cookie, err := r.Cookie(s.config.SessionCookieName); err == nil && cookie.Value != "" {
			account, sessionID, err := s.repo.AccountBySession(r.Context(), auth.HashSessionToken(cookie.Value))
			if err != nil {
				writeError(w, http.StatusUnauthorized, "unauthorized", "authentication is required")
				return
			}
			ctx := context.WithValue(r.Context(), accountContextKey, account)
			ctx = context.WithValue(ctx, sessionContextKey, sessionID)
			ctx = context.WithValue(ctx, projectActorContextKey, projectActor{kind: consoleProjectActor})
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}
		// No cookie is an intentional anonymous application invocation. The
		// repository checks execute_permissions before accepting it.
		next.ServeHTTP(w, r)
	})
}

func (s *Server) allowFailedProjectAPIKeyAuth(w http.ResponseWriter, r *http.Request, projectID uuid.UUID) bool {
	decision, err := s.limiter.Allow(r.Context(), ratelimit.ProjectIPKey("api_key_auth", projectID.String(), requestClientIP(r)), s.config.AuthRateLimit, s.config.AuthRateWindow)
	if err != nil {
		s.logger.Error("API key rate limiter failed", "error", err)
		writeError(w, http.StatusServiceUnavailable, "service_unavailable", "authentication protection is temporarily unavailable")
		return false
	}
	if !decision.Allowed {
		return writeRateLimited(w, decision.RetryAfter)
	}
	return true
}

func projectActorFrom(r *http.Request) projectActor {
	return r.Context().Value(projectActorContextKey).(projectActor)
}

func (s *Server) requireProjectAppSession(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		projectID, err := repository.ParseUUID(chi.URLParam(r, "projectID"))
		if err != nil {
			writeError(w, http.StatusBadRequest, "validation_error", "projectID must be a UUID")
			return
		}
		cookie, err := r.Cookie(projectSessionCookieName(projectID))
		if err != nil || cookie.Value == "" {
			writeError(w, http.StatusUnauthorized, "unauthorized", "application authentication is required")
			return
		}
		item, sessionID, err := s.repo.ApplicationUserBySession(r.Context(), projectID, auth.HashSessionToken(cookie.Value))
		if errors.Is(err, repository.ErrNotFound) {
			writeError(w, http.StatusUnauthorized, "unauthorized", "application authentication is required")
			return
		}
		if err != nil {
			internalError(s, w, err)
			return
		}
		ctx := context.WithValue(r.Context(), projectUserContextKey, item)
		ctx = context.WithValue(ctx, projectUserSessionContextKey, sessionID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func projectUserFrom(r *http.Request) domain.ApplicationUser {
	return r.Context().Value(projectUserContextKey).(domain.ApplicationUser)
}

func projectUserSessionFrom(r *http.Request) uuid.UUID {
	return r.Context().Value(projectUserSessionContextKey).(uuid.UUID)
}

func projectSessionCookieName(projectID uuid.UUID) string {
	return "stealth_app_" + strings.ReplaceAll(projectID.String(), "-", "")
}

func projectSessionCookiePath(projectID uuid.UUID) string {
	return "/v1/projects/" + projectID.String()
}

func (s *Server) setProjectSessionCookie(w http.ResponseWriter, projectID uuid.UUID, token string) {
	expires := time.Now().UTC().Add(s.config.AppSessionTTL)
	http.SetCookie(w, &http.Cookie{
		Name:     projectSessionCookieName(projectID),
		Value:    token,
		Path:     projectSessionCookiePath(projectID),
		HttpOnly: true,
		Secure:   s.config.CookieSecure,
		SameSite: projectSessionSameSite(s.config.CookieSecure),
		MaxAge:   int(s.config.AppSessionTTL.Seconds()),
		Expires:  expires,
	})
}

func (s *Server) clearProjectSessionCookie(w http.ResponseWriter, projectID uuid.UUID) {
	http.SetCookie(w, &http.Cookie{
		Name:     projectSessionCookieName(projectID),
		Value:    "",
		Path:     projectSessionCookiePath(projectID),
		HttpOnly: true,
		Secure:   s.config.CookieSecure,
		SameSite: projectSessionSameSite(s.config.CookieSecure),
		MaxAge:   -1,
		Expires:  time.Unix(1, 0),
	})
}

// Cross-origin browser clients need the project session cookie on credentialed
// requests. SameSite=None is only emitted alongside Secure; local HTTP
// development keeps Lax so browsers do not discard the cookie outright.
func projectSessionSameSite(secure bool) http.SameSite {
	if secure {
		return http.SameSiteNoneMode
	}
	return http.SameSiteLaxMode
}

func (s *Server) allowPublicAuth(w http.ResponseWriter, r *http.Request, operation string, projectID uuid.UUID, normalizedEmail string) bool {
	clientIP := requestClientIP(r)
	keys := []string{
		ratelimit.ProjectIPKey(operation, projectID.String(), clientIP),
		ratelimit.Key(operation, projectID.String(), normalizedEmail, clientIP),
	}
	for _, key := range keys {
		decision, err := s.limiter.Allow(r.Context(), key, s.config.AuthRateLimit, s.config.AuthRateWindow)
		if err != nil {
			s.logger.Error("public auth rate limiter failed", "operation", operation, "error", err)
			writeError(w, http.StatusServiceUnavailable, "service_unavailable", "authentication protection is temporarily unavailable")
			return false
		}
		if decision.Allowed {
			continue
		}
		return writeRateLimited(w, decision.RetryAfter)
	}
	return true
}

// allowAccountAuth applies the same two-dimensional protection used by
// project Auth to the Console's public recovery/verification endpoints. The
// literal namespace keeps account addresses and project addresses separate in
// Redis without putting raw PII in keys.
func (s *Server) allowAccountAuth(w http.ResponseWriter, r *http.Request, operation, normalizedEmail string) bool {
	clientIP := requestClientIP(r)
	keys := []string{
		ratelimit.ProjectIPKey(operation, "console", clientIP),
		ratelimit.Key(operation, "console", normalizedEmail, clientIP),
	}
	for _, key := range keys {
		decision, err := s.limiter.Allow(r.Context(), key, s.config.AuthRateLimit, s.config.AuthRateWindow)
		if err != nil {
			s.logger.Error("account auth rate limiter failed", "operation", operation, "error", err)
			writeError(w, http.StatusServiceUnavailable, "service_unavailable", "authentication protection is temporarily unavailable")
			return false
		}
		if decision.Allowed {
			continue
		}
		return writeRateLimited(w, decision.RetryAfter)
	}
	return true
}

func writeRateLimited(w http.ResponseWriter, retryAfter time.Duration) bool {
	retryAfterSeconds := int(retryAfter / time.Second)
	if retryAfter%time.Second != 0 {
		retryAfterSeconds++
	}
	if retryAfterSeconds < 1 {
		retryAfterSeconds = 1
	}
	w.Header().Set("Retry-After", strconv.Itoa(retryAfterSeconds))
	writeError(w, http.StatusTooManyRequests, "rate_limited", "too many authentication attempts; retry later")
	return false
}

func requestClientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err == nil && host != "" {
		return host
	}
	return strings.TrimSpace(r.RemoteAddr)
}

func (s *Server) requireSession(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(s.config.SessionCookieName)
		if err != nil || cookie.Value == "" {
			writeError(w, 401, "unauthorized", "authentication is required")
			return
		}
		account, sessionID, err := s.repo.AccountBySession(r.Context(), auth.HashSessionToken(cookie.Value))
		if err != nil {
			writeError(w, 401, "unauthorized", "authentication is required")
			return
		}
		ctx := context.WithValue(r.Context(), accountContextKey, account)
		ctx = context.WithValue(ctx, sessionContextKey, sessionID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
func accountFrom(r *http.Request) domain.Account {
	return r.Context().Value(accountContextKey).(domain.Account)
}
func sessionFrom(r *http.Request) uuid.UUID { return r.Context().Value(sessionContextKey).(uuid.UUID) }
func (s *Server) setSessionCookie(w http.ResponseWriter, token string) {
	http.SetCookie(w, &http.Cookie{Name: s.config.SessionCookieName, Value: token, Path: "/", HttpOnly: true, Secure: s.config.CookieSecure, SameSite: projectSessionSameSite(s.config.CookieSecure), MaxAge: int(s.config.SessionTTL.Seconds()), Expires: time.Now().UTC().Add(s.config.SessionTTL)})
}
func (s *Server) clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{Name: s.config.SessionCookieName, Value: "", Path: "/", HttpOnly: true, Secure: s.config.CookieSecure, SameSite: projectSessionSameSite(s.config.CookieSecure), MaxAge: -1, Expires: time.Unix(1, 0)})
}
func limitBody(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
		next.ServeHTTP(w, r)
	})
}

// limitRequestBody keeps the strict JSON limit while allowing streamed
// multipart uploads up to the configured per-file maximum plus bounded form
// overhead. A Content-Length check rejects obviously oversized bodies before
// any multipart parser or filesystem work starts; MaxBytesReader remains the
// authoritative limit for chunked requests.
func (s *Server) limitRequestBody(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		limit := int64(maxBodyBytes)
		contentType := strings.ToLower(r.Header.Get("Content-Type"))
		if strings.HasPrefix(contentType, "multipart/form-data") && (strings.Contains(r.URL.Path, "/storage/") || strings.Contains(r.URL.Path, "/functions/") && strings.Contains(r.URL.Path, "/deployments") || strings.Contains(r.URL.Path, "/sites/") && strings.Contains(r.URL.Path, "/deployments")) {
			configured := s.config.StorageMaxFileSize
			if strings.Contains(r.URL.Path, "/functions/") {
				configured = s.config.FunctionsMaxArtifactSize
			}
			if strings.Contains(r.URL.Path, "/sites/") {
				configured = s.config.SitesMaxArtifactSize
			}
			limit = configured + maxMultipartOverhead
			if limit < configured || limit <= 0 {
				limit = int64(maxBodyBytes)
			}
		}
		if r.ContentLength > limit {
			writeError(w, http.StatusRequestEntityTooLarge, "payload_too_large", "request body exceeds the configured upload limit")
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, limit)
		next.ServeHTTP(w, r)
	})
}
func (s *Server) recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if recovered := recover(); recovered != nil {
				s.logger.Error("panic recovered", "path", r.URL.Path, "panic", fmt.Sprint(recovered))
				writeError(w, 500, "internal_error", "internal server error")
			}
		}()
		next.ServeHTTP(w, r)
	})
}
func (s *Server) requestLog(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		started := time.Now()
		recorder := newMetricsResponseWriter(w)
		if s.metrics != nil {
			s.metrics.InFlight.Inc()
			defer s.metrics.InFlight.Dec()
		}
		next.ServeHTTP(recorder, r)
		duration := time.Since(started)
		route := metricRoute(r)
		status := strconv.Itoa(recorder.Status())
		if s.metrics != nil {
			s.metrics.Requests.WithLabelValues(r.Method, route, status).Inc()
			s.metrics.RequestDuration.WithLabelValues(r.Method, route).Observe(duration.Seconds())
			s.metrics.ResponseBytes.WithLabelValues(r.Method, route, status).Add(float64(recorder.BytesWritten()))
		}
		s.logger.Info("request", "method", r.Method, "path", r.URL.Path, "route", route, "status", recorder.Status(), "bytes", recorder.BytesWritten(), "duration", duration.String())
	})
}

// recordHTTPTrace stores a tenant-scoped root request index after the
// response has been selected. Full nested spans stay in the private OTLP
// backend; a persistence failure is observable but never changes the caller's
// already-written response.
func (s *Server) recordHTTPTrace(requestContext context.Context, observation observability.HTTPTraceRecord) {
	// Authentication and authorization failures do not belong to the tenant's
	// trace index. Apart from avoiding noisy rows, this prevents an outsider
	// from manufacturing organization-scoped observations through a guessed
	// route identifier.
	if s.repo == nil || observation.TraceID == "" || observation.Status == http.StatusUnauthorized || observation.Status == http.StatusForbidden {
		return
	}
	routeContext := chi.RouteContext(requestContext)
	if routeContext == nil {
		return
	}
	var organizationID, projectID, accountID *uuid.UUID
	if raw := strings.TrimSpace(routeContext.URLParam("organizationID")); raw != "" {
		parsed, err := repository.ParseUUID(raw)
		if err != nil {
			return
		}
		organizationID = &parsed
	}
	if raw := strings.TrimSpace(routeContext.URLParam("projectID")); raw != "" {
		parsed, err := repository.ParseUUID(raw)
		if err != nil {
			return
		}
		projectID = &parsed
	}
	if account, ok := requestContext.Value(accountContextKey).(domain.Account); ok {
		parsed, err := repository.ParseUUID(account.ID)
		if err == nil {
			accountID = &parsed
		}
	}
	if organizationID == nil && projectID == nil {
		return
	}
	traceID, err := uuid.NewV7()
	if err != nil {
		s.logger.Warn("trace index id generation failed", "error", err)
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := s.repo.RecordHTTPTrace(ctx, traceID, repository.HTTPTraceInput{
		TraceID: observation.TraceID, SpanID: observation.SpanID, OrganizationID: organizationID,
		ProjectID: projectID, AccountID: accountID, Method: observation.Method, Route: observation.Route,
		Status: observation.Status, Duration: observation.Duration, ResponseBytes: observation.ResponseBytes,
		StartedAt: observation.StartedAt, FinishedAt: observation.FinishedAt,
	}); err != nil {
		s.logger.Warn("trace index write failed", "error", err, "route", observation.Route)
	}
}

// metricRoute obtains Chi's route template only after the handler has run.
// This prevents UUIDs, object names, and arbitrary 404 paths from becoming
// Prometheus label values. A missing template has one stable fallback.
func metricRoute(r *http.Request) string {
	if routeContext := chi.RouteContext(r.Context()); routeContext != nil {
		if pattern := strings.TrimSpace(routeContext.RoutePattern()); pattern != "" {
			return pattern
		}
	}
	return "unmatched"
}

// metricsResponseWriter retains the standard optional ResponseWriter
// interfaces used by streaming handlers while recording the final HTTP
// status and body bytes for Prometheus. Its Unwrap method also keeps it
// compatible with net/http ResponseController.
type metricsResponseWriter struct {
	http.ResponseWriter
	status      int
	bytes       int64
	wroteHeader bool
}

func newMetricsResponseWriter(writer http.ResponseWriter) *metricsResponseWriter {
	return &metricsResponseWriter{ResponseWriter: writer, status: http.StatusOK}
}

func (w *metricsResponseWriter) WriteHeader(status int) {
	if w.wroteHeader {
		return
	}
	w.status = status
	w.wroteHeader = true
	w.ResponseWriter.WriteHeader(status)
}

func (w *metricsResponseWriter) Write(value []byte) (int, error) {
	if !w.wroteHeader {
		w.WriteHeader(http.StatusOK)
	}
	n, err := w.ResponseWriter.Write(value)
	w.bytes += int64(n)
	return n, err
}

func (w *metricsResponseWriter) ReadFrom(source io.Reader) (int64, error) {
	if !w.wroteHeader {
		w.WriteHeader(http.StatusOK)
	}
	if readerFrom, ok := w.ResponseWriter.(io.ReaderFrom); ok {
		n, err := readerFrom.ReadFrom(source)
		w.bytes += n
		return n, err
	}
	n, err := io.Copy(w.ResponseWriter, source)
	w.bytes += n
	return n, err
}

func (w *metricsResponseWriter) Flush() {
	if !w.wroteHeader {
		w.WriteHeader(http.StatusOK)
	}
	if flusher, ok := w.ResponseWriter.(http.Flusher); ok {
		flusher.Flush()
	}
}

func (w *metricsResponseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	hijacker, ok := w.ResponseWriter.(http.Hijacker)
	if !ok {
		return nil, nil, http.ErrNotSupported
	}
	return hijacker.Hijack()
}

func (w *metricsResponseWriter) Push(target string, options *http.PushOptions) error {
	pusher, ok := w.ResponseWriter.(http.Pusher)
	if !ok {
		return http.ErrNotSupported
	}
	return pusher.Push(target, options)
}

func (w *metricsResponseWriter) Unwrap() http.ResponseWriter { return w.ResponseWriter }

func (w *metricsResponseWriter) Status() int { return w.status }

func (w *metricsResponseWriter) BytesWritten() int64 { return w.bytes }
func decodeJSON(w http.ResponseWriter, r *http.Request, target any) bool {
	mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || mediaType != "application/json" {
		writeError(w, http.StatusUnsupportedMediaType, "unsupported_media_type", "Content-Type must be application/json")
		return false
	}
	de := json.NewDecoder(r.Body)
	de.DisallowUnknownFields()
	if err := de.Decode(target); err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			writeError(w, http.StatusRequestEntityTooLarge, "payload_too_large", "request body exceeds the 1 MiB limit")
			return false
		}
		writeError(w, 400, "invalid_request", "request body must be valid JSON")
		return false
	}
	if err := de.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		writeError(w, 400, "invalid_request", "request body must contain one JSON value")
		return false
	}
	return true
}
func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, errorEnvelope{Error: apiError{Code: code, Message: message}})
}
func page(w http.ResponseWriter, r *http.Request) (int, string, bool) {
	limit := 20
	if value := r.URL.Query().Get("limit"); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil || parsed < 1 || parsed > 100 {
			writeError(w, http.StatusBadRequest, "validation_error", "limit must be an integer between 1 and 100")
			return 0, "", false
		}
		limit = parsed
	}
	cursor := r.URL.Query().Get("cursor")
	if cursor != "" {
		if _, err := repository.ParseUUID(cursor); err != nil {
			writeError(w, http.StatusBadRequest, "validation_error", "cursor must be a UUID")
			return 0, "", false
		}
	}
	return limit, cursor, true
}
func paginationOf(limit int, next string) pagination {
	if next == "" {
		return pagination{Limit: limit}
	}
	return pagination{Limit: limit, NextCursor: &next}
}
func pathUUID(w http.ResponseWriter, r *http.Request, key string) (uuid.UUID, bool) {
	id, err := repository.ParseUUID(chi.URLParam(r, key))
	if err != nil {
		writeError(w, 400, "validation_error", fmt.Sprintf("%s must be a UUID", key))
		return uuid.Nil, false
	}
	return id, true
}
func authzError(w http.ResponseWriter, err error) bool {
	if errors.Is(err, repository.ErrForbidden) {
		writeError(w, 403, "forbidden", "you do not have access to this organization")
		return true
	}
	return false
}

func projectResourceError(w http.ResponseWriter, err error) bool {
	if errors.Is(err, repository.ErrNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "project or user was not found")
		return true
	}
	if errors.Is(err, repository.ErrForbidden) {
		writeError(w, http.StatusForbidden, "forbidden", "you do not have permission to manage project users")
		return true
	}
	return false
}

func projectAPIKeyResourceError(w http.ResponseWriter, err error) bool {
	if errors.Is(err, repository.ErrNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "project or API key was not found")
		return true
	}
	if errors.Is(err, repository.ErrForbidden) {
		writeError(w, http.StatusForbidden, "forbidden", "you do not have permission to manage project API keys")
		return true
	}
	return false
}

func projectSettingsError(w http.ResponseWriter, err error) bool {
	if errors.Is(err, repository.ErrNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "project was not found")
		return true
	}
	if errors.Is(err, repository.ErrForbidden) {
		writeError(w, http.StatusForbidden, "forbidden", "you do not have permission to change project Auth settings")
		return true
	}
	return false
}

func projectUpdateError(w http.ResponseWriter, err error) bool {
	if errors.Is(err, repository.ErrNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "project was not found")
		return true
	}
	if errors.Is(err, repository.ErrForbidden) {
		writeError(w, http.StatusForbidden, "forbidden", "only project owners and admins can change project settings")
		return true
	}
	return false
}

func internalError(s *Server, w http.ResponseWriter, err error) {
	s.logger.Error("request failed", "error", err)
	writeError(w, 500, "internal_error", "internal server error")
}
