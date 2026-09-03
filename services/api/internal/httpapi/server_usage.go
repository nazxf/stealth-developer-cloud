package httpapi

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/stealth-cloud/stealth/services/api/internal/repository"
)

func (s *Server) getProjectUsage(w http.ResponseWriter, r *http.Request) {
	projectID, ok := pathUUID(w, r, "projectID")
	if !ok {
		return
	}
	item, err := s.repo.ProjectUsage(r.Context(), projectID, uuid.Must(uuid.Parse(accountFrom(r).ID)))
	if errors.Is(err, repository.ErrNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "project was not found")
		return
	}
	if errors.Is(err, repository.ErrForbidden) {
		writeError(w, http.StatusForbidden, "forbidden", "you do not have access to this project")
		return
	}
	if err != nil {
		internalError(s, w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"usage": item})
}

func (s *Server) getProjectUsageMetering(w http.ResponseWriter, r *http.Request) {
	projectID, ok := pathUUID(w, r, "projectID")
	if !ok {
		return
	}
	now := time.Now().UTC()
	from, err := parseUsageDate(r.URL.Query().Get("from"), now.AddDate(0, 0, -29))
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "validation_error", "from must use YYYY-MM-DD")
		return
	}
	to, err := parseUsageDate(r.URL.Query().Get("to"), now)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "validation_error", "to must use YYYY-MM-DD")
		return
	}
	item, err := s.repo.ProjectUsageMetering(r.Context(), projectID, uuid.Must(uuid.Parse(accountFrom(r).ID)), from, to)
	if errors.Is(err, repository.ErrNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "project was not found")
		return
	}
	if errors.Is(err, repository.ErrForbidden) {
		writeError(w, http.StatusForbidden, "forbidden", "you do not have access to this project")
		return
	}
	if errors.Is(err, repository.ErrInvalidUsageWindow) {
		writeError(w, http.StatusUnprocessableEntity, "validation_error", "usage window must be between one and 367 calendar days")
		return
	}
	if err != nil {
		internalError(s, w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"metering": item})
}

func parseUsageDate(raw string, fallback time.Time) (time.Time, error) {
	if strings.TrimSpace(raw) == "" {
		return fallback, nil
	}
	parsed, err := time.Parse("2006-01-02", raw)
	if err != nil {
		return time.Time{}, err
	}
	return parsed.UTC(), nil
}
