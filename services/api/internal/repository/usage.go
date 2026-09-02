package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/stealth-cloud/stealth/services/api/internal/domain"
)

// ProjectUsage returns only aggregates for a project the Console account can
// access. Each subsystem is counted independently so an empty subsystem
// contributes zero rather than causing a missing-row error.
func (r *Repository) ProjectUsage(ctx context.Context, projectID, accountID uuid.UUID) (domain.ProjectUsage, error) {
	if err := r.requireProjectAccess(ctx, projectID, accountID); err != nil {
		return domain.ProjectUsage{}, err
	}
	var item domain.ProjectUsage
	err := r.pool.QueryRow(ctx, `
		SELECT
			(SELECT count(*) FROM project_users WHERE project_id=$1),
			(SELECT count(*) FROM project_databases WHERE project_id=$1),
			(SELECT count(*) FROM database_tables WHERE project_id=$1),
			(SELECT count(*) FROM database_rows WHERE project_id=$1),
			(SELECT count(*) FROM storage_files WHERE project_id=$1),
			COALESCE((SELECT sum(used_bytes) FROM storage_buckets WHERE project_id=$1), 0),
			COALESCE((SELECT sum(quota_bytes) FROM storage_buckets WHERE project_id=$1), 0),
			(SELECT count(*) FROM project_functions WHERE project_id=$1),
			COALESCE((SELECT sum(artifact_used_bytes) FROM project_functions WHERE project_id=$1), 0),
			COALESCE((SELECT sum(artifact_quota_bytes) FROM project_functions WHERE project_id=$1), 0),
			(SELECT count(*) FROM project_sites WHERE project_id=$1),
			COALESCE((SELECT sum(artifact_used_bytes) FROM project_sites WHERE project_id=$1), 0),
			COALESCE((SELECT sum(artifact_reserved_bytes) FROM project_sites WHERE project_id=$1), 0),
			COALESCE((SELECT sum(artifact_quota_bytes) FROM project_sites WHERE project_id=$1), 0),
			(SELECT count(*) FROM webhook_events WHERE project_id=$1 AND expires_at > now()),
			(SELECT count(*) FROM webhook_deliveries d JOIN webhook_events e ON e.id=d.event_id WHERE e.project_id=$1 AND e.created_at >= now() - interval '7 days'),
			now()
	`, projectID).Scan(
		&item.ApplicationUsers,
		&item.DatabaseCount,
		&item.DatabaseTableCount,
		&item.DatabaseRowCount,
		&item.StorageFileCount,
		&item.StorageBytes,
		&item.StorageQuotaBytes,
		&item.FunctionCount,
		&item.FunctionArtifactBytes,
		&item.FunctionQuotaBytes,
		&item.SiteCount,
		&item.SiteArtifactBytes,
		&item.SiteReservedBytes,
		&item.SiteQuotaBytes,
		&item.RealtimeEventCount,
		&item.WebhookDeliveryCount7,
		&item.CapturedAt,
	)
	item.ProjectID = projectID.String()
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ProjectUsage{}, ErrNotFound
	}
	return item, err
}
