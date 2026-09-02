package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
)

func TestProjectIDFromCORSPath(t *testing.T) {
	projectID := uuid.Must(uuid.NewV7())
	got, ok := projectIDFromCORSPath("/v1/projects/" + projectID.String() + "/realtime")
	if !ok || got != projectID {
		t.Fatalf("projectIDFromCORSPath() = %v, %v", got, ok)
	}
	if _, ok := projectIDFromCORSPath("/v1/organizations/" + projectID.String() + "/projects"); ok {
		t.Fatal("organization path was treated as a project path")
	}
}

func TestCORSMethodAllowed(t *testing.T) {
	for _, method := range []string{"GET", "post", "PATCH", "delete"} {
		if !corsMethodAllowed(method) {
			t.Errorf("corsMethodAllowed(%q) = false", method)
		}
	}
	for _, method := range []string{"", "PUT", "TRACE", "OPTIONS"} {
		if corsMethodAllowed(method) {
			t.Errorf("corsMethodAllowed(%q) = true", method)
		}
	}
}

func TestSetCORSHeadersAndDeniedRequest(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/v1/projects/example", nil)
	recorder := httptest.NewRecorder()
	setCORSHeaders(recorder, "https://app.example.com", request)
	if got := recorder.Header().Get("Access-Control-Allow-Origin"); got != "https://app.example.com" {
		t.Fatalf("allow origin = %q", got)
	}
	if got := recorder.Header().Get("Access-Control-Allow-Credentials"); got != "true" {
		t.Fatalf("allow credentials = %q", got)
	}

	denied := httptest.NewRecorder()
	corsDenied(denied, request)
	if denied.Code != http.StatusForbidden {
		t.Fatalf("corsDenied status = %d", denied.Code)
	}
}
