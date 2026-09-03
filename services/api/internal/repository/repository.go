package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stealth-cloud/stealth/services/api/internal/domain"
	"github.com/stealth-cloud/stealth/services/api/internal/functionsecret"
)

var (
	ErrNotFound             = errors.New("not found")
	ErrConflict             = errors.New("conflict")
	ErrForbidden            = errors.New("forbidden")
	ErrConfirmationRequired = errors.New("confirmation required")
	ErrRegistrationDisabled = errors.New("registration disabled")
)

type Repository struct {
	pool          *pgxpool.Pool
	txtResolver   SiteTXTResolver
	webhookCipher *functionsecret.Cipher
}

func New(pool *pgxpool.Pool) *Repository { return &Repository{pool: pool} }
func NewWithTXTResolver(pool *pgxpool.Pool, resolver SiteTXTResolver) *Repository {
	return &Repository{pool: pool, txtResolver: resolver}
}
func NewWithWebhookCipher(pool *pgxpool.Pool, cipher *functionsecret.Cipher) *Repository {
	return &Repository{pool: pool, webhookCipher: cipher}
}
func NewWithTXTResolverAndWebhookCipher(pool *pgxpool.Pool, resolver SiteTXTResolver, cipher *functionsecret.Cipher) *Repository {
	return &Repository{pool: pool, txtResolver: resolver, webhookCipher: cipher}
}
func (r *Repository) Ping(ctx context.Context) error { return r.pool.Ping(ctx) }

type SignupInput struct {
	AccountID, OrganizationID, SessionID                    uuid.UUID
	Email, PasswordHash, OrganizationName, OrganizationSlug string
	TokenHash                                               []byte
	SessionExpiresAt                                        time.Time
}

func (r *Repository) Signup(ctx context.Context, input SignupInput) (domain.Account, domain.Organization, error) {
	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return domain.Account{}, domain.Organization{}, err
	}
	defer tx.Rollback(ctx)
	account := domain.Account{ID: input.AccountID.String(), Email: input.Email, EmailVerified: false}
	organization := domain.Organization{ID: input.OrganizationID.String(), Name: input.OrganizationName, Slug: input.OrganizationSlug}
	if err := tx.QueryRow(ctx, `INSERT INTO accounts (id,email,password_hash) VALUES ($1,$2,$3) RETURNING created_at`, input.AccountID, input.Email, input.PasswordHash).Scan(&account.CreatedAt); err != nil {
		return domain.Account{}, domain.Organization{}, mapError(err)
	}
	if err := tx.QueryRow(ctx, `INSERT INTO organizations (id,name,slug) VALUES ($1,$2,$3) RETURNING created_at`, input.OrganizationID, input.OrganizationName, input.OrganizationSlug).Scan(&organization.CreatedAt); err != nil {
		return domain.Account{}, domain.Organization{}, mapError(err)
	}
	if _, err := tx.Exec(ctx, `INSERT INTO organization_memberships (organization_id,account_id,role) VALUES ($1,$2,'owner')`, input.OrganizationID, input.AccountID); err != nil {
		return domain.Account{}, domain.Organization{}, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO sessions (id,account_id,token_hash,expires_at) VALUES ($1,$2,$3,$4)`, input.SessionID, input.AccountID, input.TokenHash, input.SessionExpiresAt); err != nil {
		return domain.Account{}, domain.Organization{}, err
	}
	if err := writeAudit(ctx, tx, uuid.Nil, input.AccountID, "account.signup", "account", input.AccountID); err != nil {
		return domain.Account{}, domain.Organization{}, err
	}
	if err := writeAudit(ctx, tx, input.OrganizationID, input.AccountID, "organization.create", "organization", input.OrganizationID); err != nil {
		return domain.Account{}, domain.Organization{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.Account{}, domain.Organization{}, err
	}
	return account, organization, nil
}

func (r *Repository) AccountBySession(ctx context.Context, tokenHash []byte) (domain.Account, uuid.UUID, error) {
	var account domain.Account
	var sessionID uuid.UUID
	err := r.pool.QueryRow(ctx, `SELECT a.id,a.email,a.email_verified,a.created_at,s.id FROM sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=$1 AND s.expires_at > now()`, tokenHash).Scan(&account.ID, &account.Email, &account.EmailVerified, &account.CreatedAt, &sessionID)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Account{}, uuid.Nil, ErrNotFound
	}
	return account, sessionID, err
}
func (r *Repository) AccountPassword(ctx context.Context, email string) (uuid.UUID, string, error) {
	var id uuid.UUID
	var hash string
	err := r.pool.QueryRow(ctx, `SELECT id,password_hash FROM accounts WHERE email=$1`, email).Scan(&id, &hash)
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, "", ErrNotFound
	}
	return id, hash, err
}
func (r *Repository) CreateSession(ctx context.Context, sessionID, accountID uuid.UUID, tokenHash []byte, expires time.Time) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `INSERT INTO sessions (id,account_id,token_hash,expires_at) VALUES ($1,$2,$3,$4)`, sessionID, accountID, tokenHash, expires); err != nil {
		return err
	}
	if err = writeAudit(ctx, tx, uuid.Nil, accountID, "session.login", "session", sessionID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
func (r *Repository) DeleteSession(ctx context.Context, sessionID uuid.UUID, accountID uuid.UUID) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `DELETE FROM sessions WHERE id=$1 AND account_id=$2`, sessionID, accountID); err != nil {
		return err
	}
	if err = writeAudit(ctx, tx, uuid.Nil, accountID, "session.logout", "session", sessionID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// ListConsoleSessions returns active Console sessions for an account. Only
// safe metadata is projected; bearer tokens remain write-only secrets.
func (r *Repository) ListConsoleSessions(ctx context.Context, accountID, currentSessionID uuid.UUID) ([]domain.ConsoleSession, error) {
	rows, err := r.pool.Query(ctx, `SELECT id,(id=$2),expires_at,created_at FROM sessions WHERE account_id=$1 AND expires_at > now() ORDER BY created_at DESC`, accountID, currentSessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]domain.ConsoleSession, 0)
	for rows.Next() {
		var item domain.ConsoleSession
		if err := rows.Scan(&item.ID, &item.IsCurrent, &item.ExpiresAt, &item.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

// RevokeConsoleSession removes one session owned by accountID. A missing
// session is reported as ErrNotFound so the HTTP layer does not claim success
// for another account's session ID.
func (r *Repository) RevokeConsoleSession(ctx context.Context, accountID, sessionID uuid.UUID) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	result, err := tx.Exec(ctx, `DELETE FROM sessions WHERE id=$1 AND account_id=$2`, sessionID, accountID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrNotFound
	}
	if err := writeAudit(ctx, tx, uuid.Nil, accountID, "session.revoke", "session", sessionID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// RevokeOtherConsoleSessions revokes every active and expired session except
// the one currently being used. Keeping the current session alive lets a user
// safely sign out old devices without losing the page that performed the
// action.
func (r *Repository) RevokeOtherConsoleSessions(ctx context.Context, accountID, currentSessionID uuid.UUID) (int64, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)
	result, err := tx.Exec(ctx, `DELETE FROM sessions WHERE account_id=$1 AND id<>$2`, accountID, currentSessionID)
	if err != nil {
		return 0, err
	}
	if result.RowsAffected() > 0 {
		if err := writeAudit(ctx, tx, uuid.Nil, accountID, "session.revoke_others", "account", accountID); err != nil {
			return 0, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}

// UpdateAccountPassword changes the password and revokes every other Console
// session in one transaction. The caller's session remains valid so the
// account can continue using the Settings page after a successful update.
func (r *Repository) UpdateAccountPassword(ctx context.Context, accountID, currentSessionID uuid.UUID, passwordHash string) (int64, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)
	var lockedAccountID uuid.UUID
	if err := tx.QueryRow(ctx, `SELECT id FROM accounts WHERE id=$1 FOR UPDATE`, accountID).Scan(&lockedAccountID); errors.Is(err, pgx.ErrNoRows) {
		return 0, ErrNotFound
	} else if err != nil {
		return 0, err
	}
	if _, err := tx.Exec(ctx, `UPDATE accounts SET password_hash=$2,updated_at=now() WHERE id=$1`, accountID, passwordHash); err != nil {
		return 0, err
	}
	result, err := tx.Exec(ctx, `DELETE FROM sessions WHERE account_id=$1 AND id<>$2`, accountID, currentSessionID)
	if err != nil {
		return 0, err
	}
	if err := writeAudit(ctx, tx, uuid.Nil, accountID, "account.password_update", "account", accountID); err != nil {
		return 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}
func (r *Repository) ListOrganizations(ctx context.Context, accountID uuid.UUID, limit int, cursor string) ([]domain.Organization, string, error) {
	rows, err := r.pool.Query(ctx, `SELECT o.id,o.name,o.slug,o.created_at FROM organizations o JOIN organization_memberships m ON m.organization_id=o.id WHERE m.account_id=$1 AND ($2='' OR o.id::text > $2) ORDER BY o.id LIMIT $3`, accountID, cursor, limit+1)
	if err != nil {
		return nil, "", err
	}
	defer rows.Close()
	items := make([]domain.Organization, 0, limit)
	for rows.Next() {
		var item domain.Organization
		if err := rows.Scan(&item.ID, &item.Name, &item.Slug, &item.CreatedAt); err != nil {
			return nil, "", err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, "", err
	}
	next := ""
	if len(items) > limit {
		next = items[limit-1].ID
		items = items[:limit]
	}
	return items, next, nil
}
func (r *Repository) CreateOrganization(ctx context.Context, id, accountID uuid.UUID, name, slug string) (domain.Organization, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.Organization{}, err
	}
	defer tx.Rollback(ctx)
	item := domain.Organization{ID: id.String(), Name: name, Slug: slug}
	if err = tx.QueryRow(ctx, `INSERT INTO organizations (id,name,slug) VALUES ($1,$2,$3) RETURNING created_at`, id, name, slug).Scan(&item.CreatedAt); err != nil {
		return domain.Organization{}, mapError(err)
	}
	if _, err = tx.Exec(ctx, `INSERT INTO organization_memberships (organization_id,account_id,role) VALUES ($1,$2,'owner')`, id, accountID); err != nil {
		return domain.Organization{}, err
	}
	if err = writeAudit(ctx, tx, id, accountID, "organization.create", "organization", id); err != nil {
		return domain.Organization{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return domain.Organization{}, err
	}
	return item, nil
}

// UpdateOrganization changes organization identity metadata. Owners and
// admins may edit the name and slug, while the immutable organization ID keeps
// SDK configuration and audit history stable.
func (r *Repository) UpdateOrganization(ctx context.Context, organizationID, accountID uuid.UUID, name, slug string) (domain.Organization, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.Organization{}, err
	}
	defer tx.Rollback(ctx)
	var item domain.Organization
	if err := tx.QueryRow(ctx, `SELECT id,name,slug,created_at FROM organizations WHERE id=$1 FOR UPDATE`, organizationID).Scan(&item.ID, &item.Name, &item.Slug, &item.CreatedAt); errors.Is(err, pgx.ErrNoRows) {
		return domain.Organization{}, ErrNotFound
	} else if err != nil {
		return domain.Organization{}, err
	}
	if err := requireRoleTx(ctx, tx, organizationID, accountID, "owner", "admin"); err != nil {
		return domain.Organization{}, err
	}
	previousName, previousSlug := item.Name, item.Slug
	if previousName == name && previousSlug == slug {
		if err := tx.Commit(ctx); err != nil {
			return domain.Organization{}, err
		}
		return item, nil
	}
	if err := tx.QueryRow(ctx, `UPDATE organizations SET name=$2,slug=$3,updated_at=now() WHERE id=$1 RETURNING id,name,slug,created_at`, organizationID, name, slug).Scan(&item.ID, &item.Name, &item.Slug, &item.CreatedAt); err != nil {
		return domain.Organization{}, mapError(err)
	}
	metadata := map[string]any{
		"organization_id": organizationID.String(),
		"fields":          []string{"name", "slug"},
		"from":            map[string]string{"name": previousName, "slug": previousSlug},
		"to":              map[string]string{"name": name, "slug": slug},
	}
	if err := writeAuditMetadata(ctx, tx, organizationID, accountID, "organization.update", "organization", organizationID, metadata); err != nil {
		return domain.Organization{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.Organization{}, err
	}
	return item, nil
}
func (r *Repository) ListMemberships(ctx context.Context, organizationID, accountID uuid.UUID, limit int, cursor string) ([]domain.Membership, string, bool, error) {
	if err := r.requireMembership(ctx, organizationID, accountID); err != nil {
		return nil, "", false, err
	}
	var role string
	if err := r.pool.QueryRow(ctx, `SELECT role FROM organization_memberships WHERE organization_id=$1 AND account_id=$2`, organizationID, accountID).Scan(&role); err != nil {
		return nil, "", false, err
	}
	rows, err := r.pool.Query(ctx, `SELECT m.organization_id,m.account_id,a.email,m.role,m.created_at FROM organization_memberships m JOIN accounts a ON a.id=m.account_id WHERE m.organization_id=$1 AND ($2='' OR m.account_id::text>$2) ORDER BY m.account_id LIMIT $3`, organizationID, cursor, limit+1)
	if err != nil {
		return nil, "", false, err
	}
	defer rows.Close()
	items := make([]domain.Membership, 0, limit)
	for rows.Next() {
		var item domain.Membership
		if err := rows.Scan(&item.OrganizationID, &item.AccountID, &item.Email, &item.Role, &item.CreatedAt); err != nil {
			return nil, "", false, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, "", false, err
	}
	next := ""
	if len(items) > limit {
		next = items[limit-1].AccountID
		items = items[:limit]
	}
	return items, next, role == "owner" || role == "admin", nil
}
func (r *Repository) ListProjects(ctx context.Context, organizationID, accountID uuid.UUID, limit int, cursor string) ([]domain.Project, string, error) {
	if err := r.requireMembership(ctx, organizationID, accountID); err != nil {
		return nil, "", err
	}
	rows, err := r.pool.Query(ctx, `SELECT id,organization_id,name,created_at FROM projects WHERE organization_id=$1 AND ($2='' OR id::text>$2) ORDER BY id LIMIT $3`, organizationID, cursor, limit+1)
	if err != nil {
		return nil, "", err
	}
	defer rows.Close()
	items := make([]domain.Project, 0, limit)
	for rows.Next() {
		var item domain.Project
		if err := rows.Scan(&item.ID, &item.OrganizationID, &item.Name, &item.CreatedAt); err != nil {
			return nil, "", err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, "", err
	}
	next := ""
	if len(items) > limit {
		next = items[limit-1].ID
		items = items[:limit]
	}
	return items, next, nil
}
func (r *Repository) CreateProject(ctx context.Context, id, organizationID, accountID uuid.UUID, name string) (domain.Project, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.Project{}, err
	}
	defer tx.Rollback(ctx)
	if err := requireRoleTx(ctx, tx, organizationID, accountID, "owner", "admin", "developer"); err != nil {
		return domain.Project{}, err
	}
	item := domain.Project{ID: id.String(), OrganizationID: organizationID.String(), Name: name}
	if err = tx.QueryRow(ctx, `INSERT INTO projects (id,organization_id,name) VALUES ($1,$2,$3) RETURNING created_at`, id, organizationID, name).Scan(&item.CreatedAt); err != nil {
		return domain.Project{}, mapError(err)
	}
	if _, err = tx.Exec(ctx, `INSERT INTO project_auth_settings (project_id) VALUES ($1)`, id); err != nil {
		return domain.Project{}, err
	}
	if err = writeAuditMetadata(ctx, tx, organizationID, accountID, "project.create", "project", id, map[string]any{"project_id": id.String()}); err != nil {
		return domain.Project{}, err
	}
	if err = r.enqueueWebhookEventTx(ctx, tx, id, "project.create", "project", id, map[string]any{"name": name}); err != nil {
		return domain.Project{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return domain.Project{}, err
	}
	return item, nil
}
func (r *Repository) ProjectByID(ctx context.Context, id, accountID uuid.UUID) (domain.Project, error) {
	var item domain.Project
	err := r.pool.QueryRow(ctx, `SELECT p.id,p.organization_id,p.name,p.created_at FROM projects p JOIN organization_memberships m ON m.organization_id=p.organization_id WHERE p.id=$1 AND m.account_id=$2`, id, accountID).Scan(&item.ID, &item.OrganizationID, &item.Name, &item.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Project{}, ErrNotFound
	}
	return item, err
}

// UpdateProject changes the mutable project metadata while holding the
// project row lock. A repeated name is deliberately idempotent and does not
// emit an audit event or webhook notification.
func (r *Repository) UpdateProject(ctx context.Context, projectID, accountID uuid.UUID, name string) (domain.Project, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.Project{}, err
	}
	defer tx.Rollback(ctx)

	var item domain.Project
	err = tx.QueryRow(ctx, `
		SELECT id,organization_id,name,created_at
		FROM projects
		WHERE id=$1
		FOR UPDATE`, projectID).
		Scan(&item.ID, &item.OrganizationID, &item.Name, &item.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Project{}, ErrNotFound
	}
	if err != nil {
		return domain.Project{}, err
	}
	if err := requireProjectRoleTx(ctx, tx, projectID, accountID, "owner", "admin"); err != nil {
		return domain.Project{}, err
	}
	previousName := item.Name
	if previousName == name {
		if err := tx.Commit(ctx); err != nil {
			return domain.Project{}, err
		}
		return item, nil
	}

	orgID, err := uuid.Parse(item.OrganizationID)
	if err != nil {
		return domain.Project{}, err
	}
	err = tx.QueryRow(ctx, `
		UPDATE projects
		SET name=$2,updated_at=now()
		WHERE id=$1
		RETURNING id,organization_id,name,created_at`, projectID, name).
		Scan(&item.ID, &item.OrganizationID, &item.Name, &item.CreatedAt)
	if err != nil {
		return domain.Project{}, mapError(err)
	}
	metadata := map[string]any{
		"project_id": projectID.String(),
		"fields":     []string{"name"},
		"from":       previousName,
		"to":         name,
	}
	if err := writeAuditMetadata(ctx, tx, orgID, accountID, "project.update", "project", projectID, metadata); err != nil {
		return domain.Project{}, err
	}
	if err := r.enqueueWebhookEventTx(ctx, tx, projectID, "project.update", "project", projectID, metadata); err != nil {
		return domain.Project{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.Project{}, err
	}
	return item, nil
}

// DeleteProject permanently removes a project and all tenant-owned database
// rows that reference it. The schema uses ON DELETE CASCADE for every project
// resource, so this operation remains atomic from the API's perspective. A
// caller must be the organization owner and repeat the current project name as
// an explicit confirmation to protect against accidental destructive calls.
func (r *Repository) DeleteProject(ctx context.Context, projectID, accountID uuid.UUID, confirmationName string) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var orgID uuid.UUID
	var name string
	if err := tx.QueryRow(ctx, `SELECT organization_id,name FROM projects WHERE id=$1 FOR UPDATE`, projectID).Scan(&orgID, &name); errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	} else if err != nil {
		return err
	}
	if err := requireProjectRoleTx(ctx, tx, projectID, accountID, "owner"); err != nil {
		return err
	}
	if confirmationName != name {
		return ErrConfirmationRequired
	}
	if err := writeAuditMetadata(ctx, tx, orgID, accountID, "project.delete", "project", projectID, map[string]any{
		"project_id": projectID.String(),
		"name":       name,
	}); err != nil {
		return err
	}
	result, err := tx.Exec(ctx, `DELETE FROM projects WHERE id=$1`, projectID)
	if err != nil {
		return err
	}
	if result.RowsAffected() != 1 {
		return ErrNotFound
	}
	return tx.Commit(ctx)
}

// ListProjectUsers returns only the safe application-user projection. The
// project membership check deliberately happens before the list query so a
// caller from another tenant receives the same hidden-resource 404 as
// ProjectByID.
func (r *Repository) ListProjectUsers(ctx context.Context, projectID, accountID uuid.UUID, limit int, cursor *uuid.UUID) ([]domain.ApplicationUser, string, bool, error) {
	role, err := r.projectRole(ctx, projectID, accountID)
	if err != nil {
		return nil, "", false, err
	}
	rows, err := r.pool.Query(ctx, `
		SELECT id,project_id,email,display_name,status,email_verified,created_at,updated_at
		FROM project_users
		WHERE project_id=$1 AND ($3::uuid IS NULL OR id>$3)
		ORDER BY id
		LIMIT $2`, projectID, limit+1, cursor)
	if err != nil {
		return nil, "", false, err
	}
	defer rows.Close()
	items := make([]domain.ApplicationUser, 0, limit)
	for rows.Next() {
		var item domain.ApplicationUser
		if err := rows.Scan(&item.ID, &item.ProjectID, &item.Email, &item.Name, &item.Status, &item.EmailVerified, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, "", false, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, "", false, err
	}
	next := ""
	if len(items) > limit {
		next = items[limit-1].ID
		items = items[:limit]
	}
	return items, next, role == "owner" || role == "admin", nil
}

func (r *Repository) ProjectUserByID(ctx context.Context, projectID, userID, accountID uuid.UUID) (domain.ApplicationUser, error) {
	if err := r.requireProjectAccess(ctx, projectID, accountID); err != nil {
		return domain.ApplicationUser{}, err
	}
	var item domain.ApplicationUser
	err := r.pool.QueryRow(ctx, `
		SELECT id,project_id,email,display_name,status,email_verified,created_at,updated_at
		FROM project_users
		WHERE project_id=$1 AND id=$2`, projectID, userID).Scan(&item.ID, &item.ProjectID, &item.Email, &item.Name, &item.Status, &item.EmailVerified, &item.CreatedAt, &item.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ApplicationUser{}, ErrNotFound
	}
	return item, err
}

func (r *Repository) CreateProjectUser(ctx context.Context, id, projectID, accountID uuid.UUID, email, passwordHash string, name *string) (domain.ApplicationUser, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.ApplicationUser{}, err
	}
	defer tx.Rollback(ctx)
	if err := requireProjectRoleTx(ctx, tx, projectID, accountID, "owner", "admin"); err != nil {
		return domain.ApplicationUser{}, err
	}
	var item domain.ApplicationUser
	err = tx.QueryRow(ctx, `
		INSERT INTO project_users (id,project_id,email,display_name,password_hash)
		VALUES ($1,$2,$3,$4,$5)
		RETURNING id,project_id,email,display_name,status,email_verified,created_at,updated_at`, id, projectID, email, name, passwordHash).
		Scan(&item.ID, &item.ProjectID, &item.Email, &item.Name, &item.Status, &item.EmailVerified, &item.CreatedAt, &item.UpdatedAt)
	if err != nil {
		return domain.ApplicationUser{}, mapError(err)
	}
	orgID, err := projectOrganizationIDValue(ctx, tx, projectID)
	if err != nil {
		return domain.ApplicationUser{}, err
	}
	metadata := map[string]any{"project_id": projectID.String()}
	if err := writeAuditMetadata(ctx, tx, orgID, accountID, "project_user.create", "project_user", id, metadata); err != nil {
		return domain.ApplicationUser{}, err
	}
	if err := r.enqueueWebhookEventTx(ctx, tx, projectID, "project_user.create", "project_user", id, metadata); err != nil {
		return domain.ApplicationUser{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.ApplicationUser{}, err
	}
	return item, nil
}

// AuthorizeProjectUserWrite is a cheap preflight used before expensive
// password hashing. CreateProjectUser repeats this check inside its write
// transaction so a membership change between the two calls cannot bypass
// authorization.
func (r *Repository) AuthorizeProjectUserWrite(ctx context.Context, projectID, accountID uuid.UUID) error {
	var role string
	err := r.pool.QueryRow(ctx, `
		SELECT m.role
		FROM projects p
		JOIN organization_memberships m ON m.organization_id=p.organization_id
		WHERE p.id=$1 AND m.account_id=$2`, projectID, accountID).Scan(&role)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if role != "owner" && role != "admin" {
		return ErrForbidden
	}
	return nil
}

// ApplicationUserPassword is an internal credential lookup. Callers must not
// serialize the returned hash; it exists only to perform Argon2id verification.
func (r *Repository) ApplicationUserPassword(ctx context.Context, projectID uuid.UUID, email string) (uuid.UUID, string, string, error) {
	var userID uuid.UUID
	var passwordHash, status string
	err := r.pool.QueryRow(ctx, `
		SELECT id,password_hash,status
		FROM project_users
		WHERE project_id=$1 AND email=$2`, projectID, email).Scan(&userID, &passwordHash, &status)
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, "", "", ErrNotFound
	}
	return userID, passwordHash, status, err
}

// RegisterProjectUser creates a project user and its first application session
// in one transaction. Registration is checked again while the transaction is
// open so a settings change cannot race this write.
func (r *Repository) RegisterProjectUser(ctx context.Context, userID, sessionID, projectID uuid.UUID, email, passwordHash string, name *string, tokenHash []byte, expiresAt time.Time) (domain.ApplicationUser, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.ApplicationUser{}, err
	}
	defer tx.Rollback(ctx)
	var registrationEnabled bool
	err = tx.QueryRow(ctx, `SELECT registration_enabled FROM project_auth_settings WHERE project_id=$1 FOR SHARE`, projectID).Scan(&registrationEnabled)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ApplicationUser{}, ErrNotFound
	}
	if err != nil {
		return domain.ApplicationUser{}, err
	}
	if !registrationEnabled {
		return domain.ApplicationUser{}, ErrRegistrationDisabled
	}
	var item domain.ApplicationUser
	err = tx.QueryRow(ctx, `
		INSERT INTO project_users (id,project_id,email,display_name,password_hash)
		VALUES ($1,$2,$3,$4,$5)
		RETURNING id,project_id,email,display_name,status,email_verified,created_at,updated_at`, userID, projectID, email, name, passwordHash).
		Scan(&item.ID, &item.ProjectID, &item.Email, &item.Name, &item.Status, &item.EmailVerified, &item.CreatedAt, &item.UpdatedAt)
	if err != nil {
		return domain.ApplicationUser{}, mapError(err)
	}
	if _, err = tx.Exec(ctx, `
		INSERT INTO project_user_sessions (id,project_id,project_user_id,token_hash,expires_at)
		VALUES ($1,$2,$3,$4,$5)`, sessionID, projectID, userID, tokenHash, expiresAt); err != nil {
		return domain.ApplicationUser{}, mapError(err)
	}
	orgID, err := projectOrganizationIDValue(ctx, tx, projectID)
	if err != nil {
		return domain.ApplicationUser{}, err
	}
	metadata := map[string]any{"project_id": projectID.String(), "source": "self_registration"}
	if err := writeAuditMetadata(ctx, tx, orgID, uuid.Nil, "project_user.create", "project_user", userID, metadata); err != nil {
		return domain.ApplicationUser{}, err
	}
	if err := r.enqueueWebhookEventTx(ctx, tx, projectID, "project_user.create", "project_user", userID, metadata); err != nil {
		return domain.ApplicationUser{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.ApplicationUser{}, err
	}
	return item, nil
}

// CreateProjectUserSession rechecks that the application user is still active
// under a row lock. This closes the race where a block could otherwise happen
// between password verification and session insertion.
func (r *Repository) CreateProjectUserSession(ctx context.Context, sessionID, projectID, userID uuid.UUID, tokenHash []byte, expiresAt time.Time) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var status string
	err = tx.QueryRow(ctx, `SELECT status FROM project_users WHERE id=$1 AND project_id=$2 FOR UPDATE`, userID, projectID).Scan(&status)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if status != "active" {
		return ErrForbidden
	}
	if _, err = tx.Exec(ctx, `
		INSERT INTO project_user_sessions (id,project_id,project_user_id,token_hash,expires_at)
		VALUES ($1,$2,$3,$4,$5)`, sessionID, projectID, userID, tokenHash, expiresAt); err != nil {
		return mapError(err)
	}
	return tx.Commit(ctx)
}

func (r *Repository) ApplicationUserBySession(ctx context.Context, projectID uuid.UUID, tokenHash []byte) (domain.ApplicationUser, uuid.UUID, error) {
	var item domain.ApplicationUser
	var sessionID uuid.UUID
	err := r.pool.QueryRow(ctx, `
		SELECT u.id,u.project_id,u.email,u.display_name,u.status,u.email_verified,u.created_at,u.updated_at,s.id
		FROM project_user_sessions s
		JOIN project_users u ON u.id=s.project_user_id AND u.project_id=s.project_id
		WHERE s.project_id=$1 AND s.token_hash=$2 AND s.expires_at>now() AND u.status='active'`, projectID, tokenHash).
		Scan(&item.ID, &item.ProjectID, &item.Email, &item.Name, &item.Status, &item.EmailVerified, &item.CreatedAt, &item.UpdatedAt, &sessionID)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ApplicationUser{}, uuid.Nil, ErrNotFound
	}
	return item, sessionID, err
}

func (r *Repository) DeleteProjectUserSession(ctx context.Context, projectID, sessionID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM project_user_sessions WHERE project_id=$1 AND id=$2`, projectID, sessionID)
	return err
}

func (r *Repository) ProjectRegistrationEnabled(ctx context.Context, projectID uuid.UUID) (bool, error) {
	var enabled bool
	err := r.pool.QueryRow(ctx, `SELECT registration_enabled FROM project_auth_settings WHERE project_id=$1`, projectID).Scan(&enabled)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, ErrNotFound
	}
	return enabled, err
}

func (r *Repository) ProjectAuthSettings(ctx context.Context, projectID, accountID uuid.UUID) (domain.ProjectAuthSettings, bool, error) {
	role, err := r.projectRole(ctx, projectID, accountID)
	if err != nil {
		return domain.ProjectAuthSettings{}, false, err
	}
	var item domain.ProjectAuthSettings
	err = r.pool.QueryRow(ctx, `
		SELECT project_id,registration_enabled,cors_origins,created_at,updated_at
		FROM project_auth_settings WHERE project_id=$1`, projectID).
		Scan(&item.ProjectID, &item.RegistrationEnabled, &item.CORSOrigins, &item.CreatedAt, &item.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ProjectAuthSettings{}, false, ErrNotFound
	}
	if item.CORSOrigins == nil {
		item.CORSOrigins = []string{}
	}
	return item, role == "owner" || role == "admin", err
}

func (r *Repository) UpdateProjectAuthSettings(ctx context.Context, projectID, accountID uuid.UUID, registrationEnabled *bool, corsOrigins *[]string) (domain.ProjectAuthSettings, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.ProjectAuthSettings{}, err
	}
	defer tx.Rollback(ctx)
	if err := requireProjectRoleTx(ctx, tx, projectID, accountID, "owner", "admin"); err != nil {
		return domain.ProjectAuthSettings{}, err
	}
	var item domain.ProjectAuthSettings
	err = tx.QueryRow(ctx, `
		SELECT project_id,registration_enabled,cors_origins,created_at,updated_at
		FROM project_auth_settings WHERE project_id=$1 FOR UPDATE`, projectID).
		Scan(&item.ProjectID, &item.RegistrationEnabled, &item.CORSOrigins, &item.CreatedAt, &item.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ProjectAuthSettings{}, ErrNotFound
	}
	if err != nil {
		return domain.ProjectAuthSettings{}, err
	}
	if item.CORSOrigins == nil {
		item.CORSOrigins = []string{}
	}
	previousRegistration := item.RegistrationEnabled
	previousOrigins := append([]string{}, item.CORSOrigins...)
	nextRegistration := item.RegistrationEnabled
	if registrationEnabled != nil {
		nextRegistration = *registrationEnabled
	}
	nextOrigins := append([]string{}, item.CORSOrigins...)
	if corsOrigins != nil {
		nextOrigins = append([]string{}, (*corsOrigins)...)
	}
	if nextRegistration != item.RegistrationEnabled || !slices.Equal(nextOrigins, item.CORSOrigins) {
		err = tx.QueryRow(ctx, `
			UPDATE project_auth_settings
			SET registration_enabled=$2,cors_origins=$3,updated_at=now()
			WHERE project_id=$1
			RETURNING project_id,registration_enabled,cors_origins,created_at,updated_at`, projectID, nextRegistration, nextOrigins).
			Scan(&item.ProjectID, &item.RegistrationEnabled, &item.CORSOrigins, &item.CreatedAt, &item.UpdatedAt)
		if err != nil {
			return domain.ProjectAuthSettings{}, err
		}
		orgID, err := projectOrganizationIDValue(ctx, tx, projectID)
		if err != nil {
			return domain.ProjectAuthSettings{}, err
		}
		metadata := map[string]any{
			"project_id":           projectID.String(),
			"registration_enabled": map[string]bool{"from": previousRegistration, "to": nextRegistration},
			"cors_origins":         map[string][]string{"from": previousOrigins, "to": append([]string{}, nextOrigins...)},
		}
		if err := writeAuditMetadata(ctx, tx, orgID, accountID, "project_auth.settings_update", "project", projectID, metadata); err != nil {
			return domain.ProjectAuthSettings{}, err
		}
		if err := r.enqueueWebhookEventTx(ctx, tx, projectID, "project_auth.settings_update", "project", projectID, metadata); err != nil {
			return domain.ProjectAuthSettings{}, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.ProjectAuthSettings{}, err
	}
	return item, nil
}

// UpdateProjectUserStatus is idempotent: repeating the current status returns
// the same DTO without producing a misleading status-change audit event.
func (r *Repository) UpdateProjectUserStatus(ctx context.Context, projectID, userID, accountID uuid.UUID, status string) (domain.ApplicationUser, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return domain.ApplicationUser{}, err
	}
	defer tx.Rollback(ctx)
	if err := requireProjectRoleTx(ctx, tx, projectID, accountID, "owner", "admin"); err != nil {
		return domain.ApplicationUser{}, err
	}
	var item domain.ApplicationUser
	err = tx.QueryRow(ctx, `
		SELECT id,project_id,email,display_name,status,email_verified,created_at,updated_at
		FROM project_users
		WHERE project_id=$1 AND id=$2
		FOR UPDATE`, projectID, userID).
		Scan(&item.ID, &item.ProjectID, &item.Email, &item.Name, &item.Status, &item.EmailVerified, &item.CreatedAt, &item.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ApplicationUser{}, ErrNotFound
	}
	if err != nil {
		return domain.ApplicationUser{}, err
	}
	previousStatus := item.Status
	if previousStatus != status {
		err = tx.QueryRow(ctx, `
			UPDATE project_users
			SET status=$3,updated_at=now()
			WHERE project_id=$1 AND id=$2
			RETURNING id,project_id,email,display_name,status,email_verified,created_at,updated_at`, projectID, userID, status).
			Scan(&item.ID, &item.ProjectID, &item.Email, &item.Name, &item.Status, &item.EmailVerified, &item.CreatedAt, &item.UpdatedAt)
		if err != nil {
			return domain.ApplicationUser{}, err
		}
		orgID, orgErr := projectOrganizationIDValue(ctx, tx, projectID)
		if orgErr != nil {
			return domain.ApplicationUser{}, orgErr
		}
		metadata := map[string]any{"project_id": projectID.String(), "from": previousStatus, "to": status}
		if err := writeAuditMetadata(ctx, tx, orgID, accountID, "project_user.status_change", "project_user", userID, metadata); err != nil {
			return domain.ApplicationUser{}, err
		}
		if err := r.enqueueWebhookEventTx(ctx, tx, projectID, "project_user.status_change", "project_user", userID, metadata); err != nil {
			return domain.ApplicationUser{}, err
		}
	}
	if status == "blocked" {
		if _, err := tx.Exec(ctx, `DELETE FROM project_user_sessions WHERE project_id=$1 AND project_user_id=$2`, projectID, userID); err != nil {
			return domain.ApplicationUser{}, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.ApplicationUser{}, err
	}
	return item, nil
}

// DeleteProjectUser permanently removes an application identity. Its
// project-scoped sessions and recovery tokens are deleted by foreign-key
// cascade, while database rows keep their data and clear the creator pointer.
// Only project owners and admins may perform the operation.
func (r *Repository) DeleteProjectUser(ctx context.Context, projectID, userID, accountID uuid.UUID) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err := requireProjectRoleTx(ctx, tx, projectID, accountID, "owner", "admin"); err != nil {
		return err
	}
	if err := r.deleteProjectUserTx(ctx, tx, projectID, userID, accountID, map[string]any{}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// DeleteProjectUserByAPIKey is the server-to-server equivalent. The API key
// is revalidated inside the write transaction so revocation cannot race this
// destructive mutation.
func (r *Repository) DeleteProjectUserByAPIKey(ctx context.Context, projectID, userID, apiKeyID uuid.UUID) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err := requireActiveProjectAPIKeyTx(ctx, tx, projectID, apiKeyID, "users.write"); err != nil {
		return err
	}
	if err := r.deleteProjectUserTx(ctx, tx, projectID, userID, uuid.Nil, map[string]any{
		"actor":      "api_key",
		"api_key_id": apiKeyID.String(),
	}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *Repository) deleteProjectUserTx(ctx context.Context, tx pgx.Tx, projectID, userID, actorID uuid.UUID, metadata map[string]any) error {
	var email string
	if err := tx.QueryRow(ctx, `SELECT email FROM project_users WHERE project_id=$1 AND id=$2 FOR UPDATE`, projectID, userID).Scan(&email); errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	} else if err != nil {
		return err
	}
	orgID, err := projectOrganizationIDValue(ctx, tx, projectID)
	if err != nil {
		return err
	}
	if metadata == nil {
		metadata = map[string]any{}
	}
	metadata["project_id"] = projectID.String()
	webhookMetadata := make(map[string]any, len(metadata))
	for key, value := range metadata {
		webhookMetadata[key] = value
	}
	auditMetadata := make(map[string]any, len(metadata)+1)
	for key, value := range metadata {
		auditMetadata[key] = value
	}
	// Email is useful for audit operators but is deliberately kept out of
	// webhook payloads, where it would widen the recipient data surface.
	auditMetadata["email"] = email
	if _, err := tx.Exec(ctx, `DELETE FROM project_users WHERE project_id=$1 AND id=$2`, projectID, userID); err != nil {
		return err
	}
	if err := writeAuditMetadata(ctx, tx, orgID, actorID, "project_user.delete", "project_user", userID, auditMetadata); err != nil {
		return err
	}
	return r.enqueueWebhookEventTx(ctx, tx, projectID, "project_user.delete", "project_user", userID, webhookMetadata)
}

func (r *Repository) requireProjectAccess(ctx context.Context, projectID, accountID uuid.UUID) error {
	_, err := r.projectRole(ctx, projectID, accountID)
	return err
}

func (r *Repository) projectRole(ctx context.Context, projectID, accountID uuid.UUID) (string, error) {
	var role string
	err := r.pool.QueryRow(ctx, `
		SELECT m.role
		FROM projects p
		JOIN organization_memberships m ON m.organization_id=p.organization_id
		WHERE p.id=$1 AND m.account_id=$2`, projectID, accountID).Scan(&role)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	return role, err
}

func requireProjectRoleTx(ctx context.Context, tx pgx.Tx, projectID, accountID uuid.UUID, allowed ...string) error {
	role, err := projectRoleTx(ctx, tx, projectID, accountID)
	if err != nil {
		return err
	}
	for _, candidate := range allowed {
		if role == candidate {
			return nil
		}
	}
	return ErrForbidden
}

func projectRoleTx(ctx context.Context, tx pgx.Tx, projectID, accountID uuid.UUID) (string, error) {
	var role string
	err := tx.QueryRow(ctx, `
		SELECT m.role
		FROM projects p
		JOIN organization_memberships m ON m.organization_id=p.organization_id
		WHERE p.id=$1 AND m.account_id=$2
		FOR SHARE`, projectID, accountID).Scan(&role)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	return role, err
}

func projectOrganizationIDValue(ctx context.Context, tx pgx.Tx, projectID uuid.UUID) (uuid.UUID, error) {
	var orgID uuid.UUID
	err := tx.QueryRow(ctx, `SELECT organization_id FROM projects WHERE id=$1`, projectID).Scan(&orgID)
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, ErrNotFound
	}
	return orgID, err
}
func (r *Repository) requireMembership(ctx context.Context, org, account uuid.UUID) error {
	var exists bool
	err := r.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM organization_memberships WHERE organization_id=$1 AND account_id=$2)`, org, account).Scan(&exists)
	if err != nil {
		return err
	}
	if !exists {
		return ErrForbidden
	}
	return nil
}
func requireRoleTx(ctx context.Context, tx pgx.Tx, org, account uuid.UUID, allowed ...string) error {
	var role string
	err := tx.QueryRow(ctx, `SELECT role FROM organization_memberships WHERE organization_id=$1 AND account_id=$2 FOR SHARE`, org, account).Scan(&role)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrForbidden
	}
	if err != nil {
		return err
	}
	for _, candidate := range allowed {
		if role == candidate {
			return nil
		}
	}
	return ErrForbidden
}
func writeAudit(ctx context.Context, tx pgx.Tx, org, actor uuid.UUID, action, targetType string, target uuid.UUID) error {
	return writeAuditMetadata(ctx, tx, org, actor, action, targetType, target, map[string]string{})
}

func writeAuditMetadata(ctx context.Context, tx pgx.Tx, org, actor uuid.UUID, action, targetType string, target uuid.UUID, value any) error {
	var orgID, actorID any
	if org != uuid.Nil {
		orgID = org
	}
	if actor != uuid.Nil {
		actorID = actor
	}
	metadata, err := json.Marshal(value)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO audit_events (id,organization_id,actor_account_id,action,target_type,target_id,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7)`, uuid.Must(uuid.NewV7()), orgID, actorID, action, targetType, target, metadata)
	return err
}
func mapError(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return ErrConflict
	}
	return err
}
func ParseUUID(value string) (uuid.UUID, error) {
	id, err := uuid.Parse(value)
	if err != nil {
		return uuid.Nil, fmt.Errorf("invalid id")
	}
	return id, nil
}
