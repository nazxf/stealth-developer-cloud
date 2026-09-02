package httpapi

import (
	"errors"
	"net/http"

	"github.com/stealth-cloud/stealth/services/api/internal/repository"
)

func (s *Server) listOrganizationTraces(w http.ResponseWriter, r *http.Request) {
	organizationID, ok := pathUUID(w, r, "organizationID")
	if !ok {
		return
	}
	limit, cursor, ok := page(w, r)
	if !ok {
		return
	}
	items, next, err := s.repo.ListOrganizationHTTPTraces(r.Context(), organizationID, mustUUID(accountFrom(r).ID), limit, cursor)
	if organizationTraceError(w, err) {
		return
	}
	if err != nil {
		internalError(s, w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"traces": items, "pagination": paginationOf(limit, next)})
}

func organizationTraceError(w http.ResponseWriter, err error) bool {
	switch {
	case errors.Is(err, repository.ErrForbidden):
		writeError(w, http.StatusForbidden, "forbidden", "you do not have access to this organization")
		return true
	case errors.Is(err, repository.ErrInvalidHTTPTrace):
		writeError(w, http.StatusUnprocessableEntity, "validation_error", "trace query is invalid")
		return true
	default:
		return false
	}
}
