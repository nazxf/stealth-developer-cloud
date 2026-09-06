import { z } from "zod";
import { request } from "../api-core";
import { organizationSchema } from "./organizations";

const accountSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  email_verified: z.boolean(),
  created_at: z.string(),
});

const consoleSessionSchema = z.object({
  id: z.string(),
  is_current: z.boolean(),
  expires_at: z.string(),
  created_at: z.string(),
});

const accountResponseSchema = z.object({ account: accountSchema });
const registrationResponseSchema = z.object({ account: accountSchema, organization: organizationSchema });

export type BrowserAccount = z.infer<typeof accountSchema>;
export type BrowserConsoleSession = z.infer<typeof consoleSessionSchema>;

export const accountAPI = {
  currentAccount: () => request("/v1/account", accountResponseSchema),
  accountSessions: () => request("/v1/account/sessions", z.object({ sessions: z.array(consoleSessionSchema) })),
  revokeAccountSession: (sessionID: string) => request<void>(`/v1/account/sessions/${encodeURIComponent(sessionID)}`, z.undefined(), { method: "DELETE" }),
  revokeOtherAccountSessions: () => request("/v1/account/sessions", z.object({ revoked: z.number() }), { method: "DELETE" }),
  updateAccountPassword: (input: { current_password: string; password: string }) => request("/v1/account/password", z.object({ sessions_revoked: z.number() }), { method: "PATCH", body: JSON.stringify(input) }),
  login: (input: { email: string; password: string }) =>
    request<void>("/v1/sessions/email-password", z.undefined(), {
      method: "POST",
      body: JSON.stringify(input),
    }),
  register: (input: { email: string; password: string; organization_name?: string }) =>
    request("/v1/account/registrations", registrationResponseSchema, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  requestPasswordRecovery: (input: { email: string; url?: string }) =>
    request<{ status: string }>("/v1/account/recovery", z.object({ status: z.string() }), {
      method: "POST",
      body: JSON.stringify(input),
    }),
  resetPassword: (input: { token: string; password: string }) =>
    request("/v1/account/recovery", accountResponseSchema, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  verifyEmail: (token: string) =>
    request("/v1/account/verification", accountResponseSchema, {
      method: "PUT",
      body: JSON.stringify({ token }),
    }),
  acceptInvitation: (token: string) =>
    request("/v1/organization-invitations/accept", z.object({ membership: z.object({ organization_id: z.string(), account_id: z.string(), role: z.string() }).passthrough() }), {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
  logout: () => request<void>("/v1/session", z.undefined(), { method: "DELETE" }),
};
