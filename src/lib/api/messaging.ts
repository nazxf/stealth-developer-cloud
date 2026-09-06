import { z } from "zod";
import { request } from "../api-core";
import { paginationSchema } from "./common";

const messagingChannelSchema = z.enum(["email", "sms", "push"]);
const messagingProviderSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  name: z.string(),
  channel: messagingChannelSchema,
  provider: z.string(),
  credentials_present: z.boolean(),
  enabled: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
}).passthrough();
const messagingTopicSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  name: z.string(),
  description: z.string(),
  enabled: z.boolean(),
  subscriber_count: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
}).passthrough();
const messagingMessageSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  topic_id: z.string().nullable(),
  channel: messagingChannelSchema,
  status: z.enum(["queued", "processing", "succeeded", "failed", "cancelled"]),
  recipient_count: z.number(),
  succeeded_count: z.number(),
  failed_count: z.number(),
  cancelled_at: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
}).passthrough();
const messagingDeliverySchema = z.object({
  id: z.string(),
  project_id: z.string(),
  message_id: z.string(),
  subscriber_id: z.string().nullable().optional(),
  provider_id: z.string().nullable().optional(),
  channel: messagingChannelSchema,
  address_preview: z.string(),
  status: z.enum(["pending", "running", "succeeded", "failed", "cancelled"]),
  attempt_count: z.number(),
  last_status_code: z.number().nullable().optional(),
  last_error: z.string().nullable().optional(),
  delivered_at: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
}).passthrough();

export type BrowserMessagingChannel = z.infer<typeof messagingChannelSchema>;

export const messagingAPI = {
  projectMessagingProviders: (projectID: string) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/messaging/providers`, z.object({ providers: z.array(messagingProviderSchema), pagination: paginationSchema, can_manage: z.boolean() }).passthrough()),
  projectMessagingTopics: (projectID: string) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/messaging/topics`, z.object({ topics: z.array(messagingTopicSchema), pagination: paginationSchema, can_manage: z.boolean() }).passthrough()),
  projectMessagingMessages: (projectID: string) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/messaging/messages`, z.object({ messages: z.array(messagingMessageSchema), pagination: paginationSchema, can_manage: z.boolean() }).passthrough()),
  createProjectMessagingMessage: (projectID: string, input: { topic_id: string; channel: z.infer<typeof messagingChannelSchema>; subject?: string; body: string; data?: Record<string, string> }, idempotencyKey: string) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/messaging/messages`, z.object({ message: messagingMessageSchema }), { method: "POST", headers: { "idempotency-key": idempotencyKey }, body: JSON.stringify(input) }),
  cancelProjectMessagingMessage: (projectID: string, messageID: string) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/messaging/messages/${encodeURIComponent(messageID)}/cancel`, z.object({ message: messagingMessageSchema }), { method: "POST", body: "{}" }),
  projectMessagingDeliveries: (projectID: string, messageID: string) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/messaging/messages/${encodeURIComponent(messageID)}/deliveries`, z.object({ deliveries: z.array(messagingDeliverySchema), pagination: paginationSchema }).passthrough()),
};
