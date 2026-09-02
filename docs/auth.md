# Auth verification and recovery

Stealth keeps Console sessions and project application sessions in separate
HttpOnly cookies. Both auth boundaries support one-time email verification and
password recovery tokens. Console organizations also support email-bound
membership invitations. Only a SHA-256 digest of a token is stored in
PostgreSQL; the plaintext appears only in the email link.

## Delivery

Set `PUBLIC_APP_URL` to the HTTPS origin that hosts the verification and reset
pages. Configure `EMAIL_DELIVERY_MODE=smtp` with `SMTP_HOST`, `SMTP_PORT` (the
default is 587), `SMTP_FROM`, and optional `SMTP_USERNAME`/`SMTP_PASSWORD` for
production. The relay must advertise STARTTLS. `EMAIL_DELIVERY_MODE=log` is an
explicit local-development mode that logs the link; the default `disabled`
mode never sends mail and is useful for tests with an injected sender.

Verification links expire after `AUTH_VERIFICATION_TTL` (default 24 hours) and
recovery links expire after `AUTH_PASSWORD_RESET_TTL` (default one hour).
Issuing another link consumes the previous unused link. A successful password
reset revokes every existing session for that identity.

## Organization invitations

Owners and admins can create invitations from `/admin/users` or through
`POST /v1/organizations/{organizationID}/invitations` with an email and one of
the `admin`, `developer`, `viewer`, or `billing` roles. A new invitation for an
address replaces the previous pending one. The API reports whether the
configured mailer accepted delivery; a failed delivery leaves the invitation
persisted so it can be resent after fixing mail configuration.

The recipient opens the `PUBLIC_APP_URL/accept-invitation?token=...` link, signs
in or creates the matching Console account, and submits the link. Acceptance
requires the signed-in account email to match, creates the membership in the
same transaction, and makes the token unusable. Owners/admins can list pending
or expired invitations and revoke them with the organization invitation API.

## Console account API

Authenticated Console account:

```http
POST /v1/account/verification
Content-Type: application/json

{}
```

An optional `url` field may point at a verification page on `PUBLIC_APP_URL`
(or, for project Auth, an exact configured CORS origin). The API appends the
one-time token and rejects untrusted origins.

Public recovery is deliberately enumeration-resistant:

```http
POST /v1/account/recovery
Content-Type: application/json

{"email":"you@example.com"}
```

The endpoint returns `202 {"status":"accepted"}` whether the address exists.
The email link is confirmed with `PUT /v1/account/verification` and
`PUT /v1/account/recovery`, each receiving JSON `{ "token": "..." }`; recovery
also requires a new `password`.

Console sessions can be reviewed and revoked without exposing bearer tokens:

```http
GET /v1/account/sessions
DELETE /v1/account/sessions/{sessionID}
DELETE /v1/account/sessions
```

The list contains only the session ID, creation/expiry timestamps, and an
`is_current` marker. Revoking one session is limited to the authenticated
account; the collection delete revokes every other session while keeping the
current browser signed in. Password recovery still revokes all sessions.

An authenticated account can change its password with `PATCH
/v1/account/password` and JSON `{ "current_password": "...", "password":
"..." }`. The old password is verified before Argon2id hashing; the current
session remains usable and all other Console sessions are revoked. The
response reports only the number of sessions revoked.

## Project application API

The same operations are available under
`/v1/projects/{projectID}/account/verification` and
`/v1/projects/{projectID}/account/recovery`. Sending verification requires the
project application cookie; recovery and token confirmation are public. The
project ID is included in the email link so a token cannot be replayed in a
different tenant.

All public operations are protected by the Redis-backed IP and address rate
limits. API keys are never accepted for these user-facing Auth routes.
