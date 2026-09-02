package httpapi

import (
	"errors"
	"net/http"

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
