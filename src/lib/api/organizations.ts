import { z } from "zod";
import { request } from "../api-core";
import { paginationParams, paginationSchema, paginatedPath, type PaginationOptions } from "./common";

const organizationMembershipRoleSchema = z.enum(["owner", "admin", "developer", "viewer", "billing"]);
const organizationMembershipManageRoleSchema = z.enum(["admin", "developer", "viewer", "billing"]);
const organizationMembershipSchema = z.object({
  organization_id: z.string(),
  account_id: z.string(),
  email: z.string().email(),
  role: organizationMembershipRoleSchema,
  created_at: z.string(),
});
const organizationInvitationSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  email: z.string().email(),
  role: organizationMembershipManageRoleSchema,
  invited_by_account_id: z.string().optional(),
  invited_by_email: z.string().email().optional(),
  status: z.enum(["pending", "expired", "accepted", "revoked"]),
  expires_at: z.string(),
  accepted_at: z.string().optional(),
  revoked_at: z.string().optional(),
  created_at: z.string(),
});
const organizationAuditEventSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  actor_account_id: z.string().optional(),
  actor_email: z.string().email().optional(),
  action: z.string(),
  target_type: z.string(),
  target_id: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()),
  created_at: z.string(),
});

const organizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  created_at: z.string(),
});
const organizationPlanLimitsSchema = z.object({
  projects: z.number(),
  members: z.number(),
  databases: z.number(),
  storage_buckets: z.number(),
  functions: z.number(),
  sites: z.number(),
});
const organizationPlanUsageSchema = z.object({
  projects: z.number(),
  members: z.number(),
  databases: z.number(),
  storage_buckets: z.number(),
  functions: z.number(),
  sites: z.number(),
});
const organizationPlanSchema = z.object({
  organization_id: z.string(),
  plan_key: z.enum(["free", "pro", "enterprise"]),
  status: z.enum(["active", "past_due", "canceled"]),
  current_period_start: z.string(),
  current_period_end: z.string(),
  limits: organizationPlanLimitsSchema,
  usage: organizationPlanUsageSchema,
});

const organizationsResponseSchema = z.object({
  organizations: z.array(organizationSchema),
  pagination: paginationSchema,
});

export { organizationAuditEventSchema, organizationMembershipManageRoleSchema, organizationSchema };

export type BrowserOrganizationMembership = z.infer<typeof organizationMembershipSchema>;
export type BrowserOrganizationMembershipRole = z.infer<typeof organizationMembershipRoleSchema>;
export type BrowserOrganizationMembershipManageRole = z.infer<typeof organizationMembershipManageRoleSchema>;
export type BrowserOrganizationInvitation = z.infer<typeof organizationInvitationSchema>;
export type BrowserOrganizationAuditEvent = z.infer<typeof organizationAuditEventSchema>;
export type BrowserOrganization = z.infer<typeof organizationSchema>;
export type BrowserOrganizationPlan = z.infer<typeof organizationPlanSchema>;
export type BrowserOrganizationsResponse = z.infer<typeof organizationsResponseSchema>;

export const organizationsAPI = {
  organizations: (options: PaginationOptions = {}) => {
    const query = paginationParams(options).toString();
    return request(paginatedPath("/v1/organizations", query), organizationsResponseSchema);
  },
  updateOrganization: (organizationID: string, input: { name: string; slug: string }) =>
    request(`/v1/organizations/${encodeURIComponent(organizationID)}`, z.object({ organization: organizationSchema }), { method: "PATCH", body: JSON.stringify(input) }),
  organizationPlan: (organizationID: string) =>
    request(`/v1/organizations/${encodeURIComponent(organizationID)}/plan`, z.object({ plan: organizationPlanSchema })),
  organizationMemberships: (organizationID: string, options: PaginationOptions = {}) => {
    const query = paginationParams(options).toString();
    return request(paginatedPath(`/v1/organizations/${encodeURIComponent(organizationID)}/memberships`, query), z.object({ memberships: z.array(organizationMembershipSchema), pagination: paginationSchema, can_manage: z.boolean() }).passthrough());
  },
  createOrganizationMembership: (organizationID: string, input: { email: string; role: BrowserOrganizationMembershipManageRole }) =>
    request(`/v1/organizations/${encodeURIComponent(organizationID)}/memberships`, z.object({ membership: organizationMembershipSchema }), { method: "POST", body: JSON.stringify(input) }),
  updateOrganizationMembership: (organizationID: string, accountID: string, role: BrowserOrganizationMembershipManageRole) =>
    request(`/v1/organizations/${encodeURIComponent(organizationID)}/memberships/${encodeURIComponent(accountID)}`, z.object({ membership: organizationMembershipSchema }), { method: "PATCH", body: JSON.stringify({ role }) }),
  removeOrganizationMembership: (organizationID: string, accountID: string) => request<void>(`/v1/organizations/${encodeURIComponent(organizationID)}/memberships/${encodeURIComponent(accountID)}`, z.undefined(), { method: "DELETE" }),
  organizationInvitations: (organizationID: string, options: PaginationOptions = {}) => {
    const query = paginationParams(options).toString();
    return request(paginatedPath(`/v1/organizations/${encodeURIComponent(organizationID)}/invitations`, query), z.object({ invitations: z.array(organizationInvitationSchema), pagination: paginationSchema, can_manage: z.boolean() }).passthrough());
  },
  createOrganizationInvitation: (organizationID: string, input: { email: string; role: BrowserOrganizationMembershipManageRole }) =>
    request(`/v1/organizations/${encodeURIComponent(organizationID)}/invitations`, z.object({ invitation: organizationInvitationSchema, delivery: z.enum(["sent", "failed"]) }), { method: "POST", body: JSON.stringify(input) }),
  revokeOrganizationInvitation: (organizationID: string, invitationID: string) => request<void>(`/v1/organizations/${encodeURIComponent(organizationID)}/invitations/${encodeURIComponent(invitationID)}`, z.undefined(), { method: "DELETE" }),
  organizationAuditEvents: (organizationID: string, options: PaginationOptions = {}) => {
    const query = paginationParams(options).toString();
    return request(paginatedPath(`/v1/organizations/${encodeURIComponent(organizationID)}/audit-events`, query), z.object({ events: z.array(organizationAuditEventSchema), pagination: paginationSchema }).passthrough());
  },
};
