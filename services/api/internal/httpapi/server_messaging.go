package httpapi

import (
	"errors"
	"net/http"

	"github.com/google/uuid"
	"github.com/stealth-cloud/stealth/services/api/internal/domain"
	"github.com/stealth-cloud/stealth/services/api/internal/repository"
)

func messagingActorFrom(r *http.Request) repository.MessagingActor {
	actor := projectActorFrom(r)
	if actor.kind == apiKeyProjectActor {
		return repository.MessagingActor{Kind: repository.MessagingAPIKeyActor, APIKeyID: actor.apiKeyID, APIKeyScopes: actor.scopes}
	}
	account, ok := r.Context().Value(accountContextKey).(domain.Account)
	if !ok {
		return repository.MessagingActor{}
	}
	return repository.MessagingActor{Kind: repository.MessagingConsoleActor, AccountID: mustUUID(account.ID)}
}

type messagingProviderRequest struct {
	Name        string            `json:"name"`
	Channel     string            `json:"channel"`
	Provider    string            `json:"provider"`
	Credentials map[string]string `json:"credentials"`
	Enabled     *bool             `json:"enabled"`
}

type messagingProviderPatchRequest struct {
	Name        *string            `json:"name"`
	Channel     *string            `json:"channel"`
	Provider    *string            `json:"provider"`
	Credentials *map[string]string `json:"credentials"`
	Enabled     *bool              `json:"enabled"`
}

type messagingTopicRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Enabled     *bool  `json:"enabled"`
}

type messagingTopicPatchRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Enabled     *bool   `json:"enabled"`
}

type messagingSubscriberRequest struct {
	Channel string `json:"channel"`
	Address string `json:"address"`
	Enabled *bool  `json:"enabled"`
}

func (s *Server) listMessagingProviders(w http.ResponseWriter, r *http.Request) {
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
		parsed := mustUUID(cursor)
		cursorID = &parsed
	}
	items, next, canManage, err := s.repo.ListMessagingProviders(r.Context(), projectID, messagingActorFrom(r), limit, cursorID)
	if messagingResourceError(w, err) {
		return
	}
	if err != nil {
		internalError(s, w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"providers": items, "pagination": paginationOf(limit, next), "can_manage": canManage})
}

func (s *Server) createMessagingProvider(w http.ResponseWriter, r *http.Request) {
	projectID, ok := pathUUID(w, r, "projectID")
	if !ok {
		return
	}
	var req messagingProviderRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	item, err := s.repo.CreateMessagingProvider(r.Context(), uuid.Must(uuid.NewV7()), projectID, messagingActorFrom(r), repository.MessagingProviderInput{Name: req.Name, Channel: req.Channel, Provider: req.Provider, Credentials: req.Credentials, Enabled: enabled})
	if messagingResourceError(w, err) {
		return
	}
	if err != nil {
		internalError(s, w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]domain.MessagingProvider{"provider": item})
}

func (s *Server) getMessagingProvider(w http.ResponseWriter, r *http.Request) {
	projectID, providerID, ok := messagingProviderPathIDs(w, r)
	if !ok {
		return
	}
	item, err := s.repo.GetMessagingProvider(r.Context(), projectID, providerID, messagingActorFrom(r))
	if messagingResourceError(w, err) {
		return
	}
	if err != nil {
		internalError(s, w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]domain.MessagingProvider{"provider": item})
}

func (s *Server) updateMessagingProvider(w http.ResponseWriter, r *http.Request) {
	projectID, providerID, ok := messagingProviderPathIDs(w, r)
	if !ok {
		return
	}
	var req messagingProviderPatchRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if req.Name == nil && req.Channel == nil && req.Provider == nil && req.Credentials == nil && req.Enabled == nil {
		writeError(w, http.StatusUnprocessableEntity, "validation_error", "at least one provider field must be provided")
		return
	}
	item, err := s.repo.UpdateMessagingProvider(r.Context(), projectID, providerID, messagingActorFrom(r), repository.MessagingProviderPatch{Name: req.Name, Channel: req.Channel, Provider: req.Provider, Credentials: req.Credentials, Enabled: req.Enabled})
	if messagingResourceError(w, err) {
		return
	}
	if err != nil {
		internalError(s, w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]domain.MessagingProvider{"provider": item})
}

func (s *Server) deleteMessagingProvider(w http.ResponseWriter, r *http.Request) {
	projectID, providerID, ok := messagingProviderPathIDs(w, r)
	if !ok {
		return
	}
	if err := s.repo.DeleteMessagingProvider(r.Context(), projectID, providerID, messagingActorFrom(r)); messagingResourceError(w, err) {
		return
	} else if err != nil {
		internalError(s, w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) listMessagingTopics(w http.ResponseWriter, r *http.Request) {
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
		parsed := mustUUID(cursor)
		cursorID = &parsed
	}
	items, next, canManage, err := s.repo.ListMessagingTopics(r.Context(), projectID, messagingActorFrom(r), limit, cursorID)
	if messagingResourceError(w, err) {
		return
	}
	if err != nil {
		internalError(s, w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"topics": items, "pagination": paginationOf(limit, next), "can_manage": canManage})
}

func (s *Server) createMessagingTopic(w http.ResponseWriter, r *http.Request) {
	projectID, ok := pathUUID(w, r, "projectID")
	if !ok {
		return
	}
	var req messagingTopicRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	item, err := s.repo.CreateMessagingTopic(r.Context(), uuid.Must(uuid.NewV7()), projectID, messagingActorFrom(r), repository.MessagingTopicInput{Name: req.Name, Description: req.Description, Enabled: enabled})
	if messagingResourceError(w, err) {
		return
	}
	if err != nil {
		internalError(s, w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]domain.MessagingTopic{"topic": item})
}

func (s *Server) getMessagingTopic(w http.ResponseWriter, r *http.Request) {
	projectID, topicID, ok := messagingTopicPathIDs(w, r)
	if !ok {
		return
	}
	item, err := s.repo.GetMessagingTopic(r.Context(), projectID, topicID, messagingActorFrom(r))
	if messagingResourceError(w, err) {
		return
	}
	if err != nil {
		internalError(s, w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]domain.MessagingTopic{"topic": item})
}

func (s *Server) updateMessagingTopic(w http.ResponseWriter, r *http.Request) {
	projectID, topicID, ok := messagingTopicPathIDs(w, r)
	if !ok {
		return
	}
	var req messagingTopicPatchRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if req.Name == nil && req.Description == nil && req.Enabled == nil {
		writeError(w, http.StatusUnprocessableEntity, "validation_error", "at least one topic field must be provided")
		return
	}
	item, err := s.repo.UpdateMessagingTopic(r.Context(), projectID, topicID, messagingActorFrom(r), repository.MessagingTopicPatch{Name: req.Name, Description: req.Description, Enabled: req.Enabled})
	if messagingResourceError(w, err) {
		return
	}
	if err != nil {
		internalError(s, w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]domain.MessagingTopic{"topic": item})
}

func (s *Server) deleteMessagingTopic(w http.ResponseWriter, r *http.Request) {
	projectID, topicID, ok := messagingTopicPathIDs(w, r)
	if !ok {
		return
	}
	if err := s.repo.DeleteMessagingTopic(r.Context(), projectID, topicID, messagingActorFrom(r)); messagingResourceError(w, err) {
		return
	} else if err != nil {
		internalError(s, w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) listMessagingSubscribers(w http.ResponseWriter, r *http.Request) {
	projectID, topicID, ok := messagingTopicPathIDs(w, r)
	if !ok {
		return
	}
	limit, cursor, ok := page(w, r)
	if !ok {
		return
	}
	var cursorID *uuid.UUID
	if cursor != "" {
		parsed := mustUUID(cursor)
		cursorID = &parsed
	}
	items, next, canManage, err := s.repo.ListMessagingSubscribers(r.Context(), projectID, topicID, messagingActorFrom(r), limit, cursorID)
	if messagingResourceError(w, err) {
		return
	}
	if err != nil {
		internalError(s, w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"subscribers": items, "pagination": paginationOf(limit, next), "can_manage": canManage})
}

func (s *Server) createMessagingSubscriber(w http.ResponseWriter, r *http.Request) {
	projectID, topicID, ok := messagingTopicPathIDs(w, r)
	if !ok {
		return
	}
	var req messagingSubscriberRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	item, err := s.repo.CreateMessagingSubscriber(r.Context(), uuid.Must(uuid.NewV7()), projectID, topicID, messagingActorFrom(r), repository.MessagingSubscriberInput{Channel: req.Channel, Address: req.Address, Enabled: enabled})
	if messagingResourceError(w, err) {
		return
	}
	if err != nil {
		internalError(s, w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]domain.MessagingSubscriber{"subscriber": item})
}

func (s *Server) getMessagingSubscriber(w http.ResponseWriter, r *http.Request) {
	projectID, topicID, subscriberID, ok := messagingSubscriberPathIDs(w, r)
	if !ok {
		return
	}
	item, err := s.repo.GetMessagingSubscriber(r.Context(), projectID, topicID, subscriberID, messagingActorFrom(r))
	if messagingResourceError(w, err) {
		return
	}
	if err != nil {
		internalError(s, w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]domain.MessagingSubscriber{"subscriber": item})
}

func (s *Server) deleteMessagingSubscriber(w http.ResponseWriter, r *http.Request) {
	projectID, topicID, subscriberID, ok := messagingSubscriberPathIDs(w, r)
	if !ok {
		return
	}
	if err := s.repo.DeleteMessagingSubscriber(r.Context(), projectID, topicID, subscriberID, messagingActorFrom(r)); messagingResourceError(w, err) {
		return
	} else if err != nil {
		internalError(s, w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func messagingProviderPathIDs(w http.ResponseWriter, r *http.Request) (uuid.UUID, uuid.UUID, bool) {
	projectID, ok := pathUUID(w, r, "projectID")
	if !ok {
		return uuid.Nil, uuid.Nil, false
	}
	providerID, ok := pathUUID(w, r, "providerID")
	if !ok {
		return uuid.Nil, uuid.Nil, false
	}
	return projectID, providerID, true
}

func messagingTopicPathIDs(w http.ResponseWriter, r *http.Request) (uuid.UUID, uuid.UUID, bool) {
	projectID, ok := pathUUID(w, r, "projectID")
	if !ok {
		return uuid.Nil, uuid.Nil, false
	}
	topicID, ok := pathUUID(w, r, "topicID")
	if !ok {
		return uuid.Nil, uuid.Nil, false
	}
	return projectID, topicID, true
}

func messagingSubscriberPathIDs(w http.ResponseWriter, r *http.Request) (uuid.UUID, uuid.UUID, uuid.UUID, bool) {
	projectID, topicID, ok := messagingTopicPathIDs(w, r)
	if !ok {
		return uuid.Nil, uuid.Nil, uuid.Nil, false
	}
	subscriberID, ok := pathUUID(w, r, "subscriberID")
	if !ok {
		return uuid.Nil, uuid.Nil, uuid.Nil, false
	}
	return projectID, topicID, subscriberID, true
}

func messagingResourceError(w http.ResponseWriter, err error) bool {
	switch {
	case errors.Is(err, repository.ErrNotFound):
		writeError(w, http.StatusNotFound, "not_found", "project or messaging resource was not found")
		return true
	case errors.Is(err, repository.ErrForbidden):
		writeError(w, http.StatusForbidden, "forbidden", "you do not have permission to manage project messaging")
		return true
	case errors.Is(err, repository.ErrConflict):
		writeError(w, http.StatusConflict, "conflict", "a messaging resource with this identity already exists")
		return true
	case errors.Is(err, repository.ErrInvalidMessaging), errors.Is(err, repository.ErrMessagingAddressInvalid):
		writeError(w, http.StatusUnprocessableEntity, "validation_error", "messaging settings are invalid")
		return true
	case errors.Is(err, repository.ErrMessagingNotReady):
		writeError(w, http.StatusServiceUnavailable, "not_ready", "messaging encryption is not configured")
		return true
	default:
		return false
	}
}
