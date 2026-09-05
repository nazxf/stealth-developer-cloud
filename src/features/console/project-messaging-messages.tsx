"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Ban, ChevronDown, ChevronRight, LoaderCircle, Mail, MessageSquare, Plus, Smartphone, Bell } from "lucide-react";
import type { ProjectMessagingDelivery, ProjectMessagingMessage, ProjectMessagingTopic } from "@/lib/stealth-api";

type Props = {
  projectId: string;
  topics: ProjectMessagingTopic[];
  canManage: boolean;
  initialMessages: ProjectMessagingMessage[];
  initialMessageCursor: string | null;
};

type RequestErrorPayload = { error?: { message?: string } };

class MessagingMessageError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

async function bridgeJSON<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: { accept: "application/json", ...init.headers },
  });
  const payload = await response.json().catch(() => null) as T | RequestErrorPayload | null;
  if (!response.ok) {
    const error = payload as RequestErrorPayload | null;
    throw new MessagingMessageError(response.status, error?.error?.message ?? "The request could not be completed.");
  }
  return payload as T;
}

function messagesPath(projectId: string, suffix = "") {
  return `/api/stealth/projects/${encodeURIComponent(projectId)}/messaging/messages${suffix}`;
}

function deliveriesPath(projectId: string, messageId: string, suffix = "") {
  return `${messagesPath(projectId, `/${encodeURIComponent(messageId)}`)}/deliveries${suffix}`;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
const channels: ProjectMessagingMessage["channel"][] = ["email", "sms", "push"];

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function channelLabel(channel: ProjectMessagingMessage["channel"]) {
  return channel === "sms" ? "SMS" : channel === "push" ? "Push" : "Email";
}

function ChannelIcon({ channel }: { channel: ProjectMessagingMessage["channel"] }) {
  if (channel === "email") return <Mail size={15} aria-hidden="true" />;
  if (channel === "sms") return <Smartphone size={15} aria-hidden="true" />;
  return <Bell size={15} aria-hidden="true" />;
}

function statusClass(status: ProjectMessagingMessage["status"] | ProjectMessagingDelivery["status"]) {
  if (status === "succeeded") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  if (status === "failed") return "border-rose-500/25 bg-rose-500/10 text-rose-200";
  if (status === "cancelled") return "border-[var(--projects-border)] text-[var(--projects-muted)]";
  return "border-amber-500/25 bg-amber-500/10 text-amber-200";
}

function errorText(reason: unknown) {
  if (reason instanceof MessagingMessageError && reason.status === 403) return "This action requires a project owner/admin or a messaging.write API key.";
  return reason instanceof Error ? reason.message : "The message request could not be completed.";
}

export function ProjectMessagingMessages({ projectId, topics, canManage, initialMessages, initialMessageCursor }: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [messageCursor, setMessageCursor] = useState(initialMessageCursor);
  const [expandedMessage, setExpandedMessage] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Record<string, ProjectMessagingDelivery[]>>({});
  const [deliveryCursors, setDeliveryCursors] = useState<Record<string, string | null>>({});
  const [topicId, setTopicId] = useState(topics.find((topic) => topic.enabled)?.id ?? topics[0]?.id ?? "");
  const [channel, setChannel] = useState<ProjectMessagingMessage["channel"]>("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [data, setData] = useState("{}");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !topicId) return;
    setBusy("send-message");
    setError(null);
    try {
      const parsedData = JSON.parse(data || "{}");
      if (parsedData === null || typeof parsedData !== "object" || Array.isArray(parsedData)) throw new Error("Data must be a JSON object.");
      for (const value of Object.values(parsedData as Record<string, unknown>)) if (typeof value !== "string") throw new Error("Data values must be strings.");
      const response = await bridgeJSON<{ message: ProjectMessagingMessage }>(messagesPath(projectId), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": `console-${crypto.randomUUID()}`,
        },
        body: JSON.stringify({ topic_id: topicId, channel, subject: subject.trim(), body, data: parsedData }),
      });
      setMessages((current) => [response.message, ...current]);
      setSubject("");
      setBody("");
      setData("{}");
      router.refresh();
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(null);
    }
  }

  async function loadMoreMessages() {
    if (!messageCursor || busy) return;
    setBusy("messages-page");
    setError(null);
    try {
      const query = new URLSearchParams({ limit: "20", cursor: messageCursor });
      const response = await bridgeJSON<{ messages: ProjectMessagingMessage[]; pagination: { next_cursor: string | null } }>(`${messagesPath(projectId)}?${query.toString()}`);
      setMessages((current) => [...current, ...response.messages]);
      setMessageCursor(response.pagination.next_cursor);
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(null);
    }
  }

  async function loadDeliveries(messageId: string, append = false) {
    if (busy) return;
    if (!append && deliveries[messageId]) {
      setExpandedMessage(messageId);
      return;
    }
    setBusy(`deliveries-${messageId}`);
    setError(null);
    try {
      const query = new URLSearchParams({ limit: "20" });
      const cursor = append ? deliveryCursors[messageId] : null;
      if (cursor) query.set("cursor", cursor);
      const response = await bridgeJSON<{ deliveries: ProjectMessagingDelivery[]; pagination: { next_cursor: string | null } }>(`${deliveriesPath(projectId, messageId)}?${query.toString()}`);
      setDeliveries((current) => ({ ...current, [messageId]: append ? [...(current[messageId] ?? []), ...response.deliveries] : response.deliveries }));
      setDeliveryCursors((current) => ({ ...current, [messageId]: response.pagination.next_cursor }));
      setExpandedMessage(messageId);
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(null);
    }
  }

  async function cancelMessage(message: ProjectMessagingMessage) {
    if (busy || !window.confirm("Cancel all queued recipients for this message?")) return;
    setBusy(`cancel-${message.id}`);
    setError(null);
    try {
      const response = await bridgeJSON<{ message: ProjectMessagingMessage }>(messagesPath(projectId, `/${encodeURIComponent(message.id)}/cancel`), { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      setMessages((current) => current.map((item) => item.id === message.id ? response.message : item));
      setDeliveries((current) => {
        if (!current[message.id]) return current;
        return { ...current, [message.id]: current[message.id].map((delivery) => delivery.status === "pending" ? { ...delivery, status: "cancelled" } : delivery) };
      });
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(null);
    }
  }

  const topicNames = new Map(topics.map((topic) => [topic.id, topic.name]));

  return (
    <section className="mt-8" aria-labelledby="messaging-messages-heading">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--projects-border)] pb-4">
        <div>
          <p className="m-0 text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--projects-muted)]">Asynchronous delivery</p>
          <h2 id="messaging-messages-heading" className="m-0 mt-1 text-[18px] font-semibold text-[var(--projects-text)]">Messages</h2>
          <p className="m-0 mt-1 text-[12px] leading-5 text-[var(--projects-muted)]">Accepted messages are queued for the trusted worker. Provider acceptance appears only in delivery status.</p>
        </div>
        <span className="rounded-full border border-[var(--projects-border)] px-2 py-1 text-[11px] text-[var(--projects-muted)]">{messages.length}</span>
      </div>

      {error ? <p role="alert" className="mt-4 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">{error}</p> : null}

      {canManage ? <form onSubmit={(event) => void sendMessage(event)} className="mt-5 rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-4 sm:p-5">
        <div className="flex items-center gap-2"><Plus size={15} className="text-[var(--projects-accent)]" aria-hidden="true" /><h3 className="m-0 text-[15px] font-semibold text-[var(--projects-text)]">Send a message</h3></div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="block text-[12px] font-medium text-[var(--projects-muted)]">Topic<select value={topicId} onChange={(event) => setTopicId(event.target.value)} required className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 text-[13px] text-[var(--projects-text)]"><option value="" disabled>Select a topic</option>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}{topic.enabled ? "" : " (paused)"}</option>)}</select></label>
          <label className="block text-[12px] font-medium text-[var(--projects-muted)]">Channel<select value={channel} onChange={(event) => setChannel(event.target.value as ProjectMessagingMessage["channel"])} className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 text-[13px] text-[var(--projects-text)]">{channels.map((value) => <option key={value} value={value}>{channelLabel(value)}</option>)}</select></label>
          <label className="block text-[12px] font-medium text-[var(--projects-muted)]">Subject{channel === "email" ? " *" : ""}<input value={subject} onChange={(event) => setSubject(event.target.value)} required={channel === "email"} maxLength={998} placeholder="Order confirmed" className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 text-[13px] text-[var(--projects-text)]" /></label>
        </div>
        <label className="mt-4 block text-[12px] font-medium text-[var(--projects-muted)]">Body<textarea value={body} onChange={(event) => setBody(event.target.value)} required maxLength={65536} rows={4} placeholder="Your message…" className="mt-1 w-full resize-y rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 text-[13px] leading-5 text-[var(--projects-text)]" /></label>
        <label className="mt-4 block text-[12px] font-medium text-[var(--projects-muted)]">Data JSON <span className="font-normal">(optional string values)</span><textarea value={data} onChange={(event) => setData(event.target.value)} rows={2} spellCheck={false} className="mt-1 w-full resize-y rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 font-mono text-[12px] leading-5 text-[var(--projects-text)]" placeholder={'{"order_id":"123"}'} /></label>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--projects-divider)] pt-4"><p className="m-0 text-[11px] text-[var(--projects-muted)]">Content is encrypted before it enters the queue.</p><button type="submit" disabled={busy !== null || !topicId} className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--projects-accent-strong)] px-3 text-[12px] font-semibold text-white disabled:opacity-50">{busy === "send-message" ? <LoaderCircle size={13} className="animate-spin" aria-hidden="true" /> : <MessageSquare size={13} aria-hidden="true" />}Queue message</button></div>
      </form> : null}

      {messages.length === 0 ? <div className="mt-5 grid min-h-[170px] place-items-center rounded-xl border border-dashed border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-6 py-8 text-center"><div><MessageSquare size={25} className="mx-auto text-[var(--projects-muted)]" aria-hidden="true" /><p className="m-0 mt-2 text-[13px] text-[var(--projects-muted)]">No messages have been queued yet.</p></div></div> : <div className="mt-5 overflow-hidden rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)]">
        <div className="divide-y divide-[var(--projects-divider)]">
          {messages.map((message) => {
            const isExpanded = expandedMessage === message.id;
            const messageDeliveries = deliveries[message.id] ?? [];
            return <article key={message.id}>
              <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                <button type="button" onClick={() => isExpanded ? setExpandedMessage(null) : void loadDeliveries(message.id)} aria-label={`${isExpanded ? "Hide" : "Show"} deliveries`} className="text-[var(--projects-muted)]">{isExpanded ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}</button>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] text-[var(--projects-accent)]"><ChannelIcon channel={message.channel} /></span>
                <div className="min-w-[150px] flex-1"><p className="m-0 text-[13px] font-semibold text-[var(--projects-text)]">{topicNames.get(message.topic_id ?? "") ?? "Deleted topic"}</p><p className="m-0 mt-0.5 font-mono text-[10px] text-[var(--projects-muted)]">{message.id}</p></div>
                <span className="text-[11px] text-[var(--projects-muted)]">{message.succeeded_count}/{message.recipient_count} delivered</span>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] ${statusClass(message.status)}`}>{message.status}</span>
                <span className="w-full text-[11px] text-[var(--projects-muted)] sm:w-auto">{formatDate(message.created_at)}</span>
                {canManage && (message.status === "queued" || message.status === "processing") ? <button type="button" onClick={() => void cancelMessage(message)} disabled={busy === `cancel-${message.id}`} className="inline-flex items-center gap-1 rounded-md border border-[var(--projects-border)] px-2 py-1 text-[11px] font-semibold text-[var(--projects-text)] disabled:opacity-50">{busy === `cancel-${message.id}` ? <LoaderCircle size={12} className="animate-spin" aria-hidden="true" /> : <Ban size={12} aria-hidden="true" />}Cancel</button> : null}
              </div>
              {isExpanded ? <div className="border-t border-[var(--projects-divider)] bg-[var(--projects-control)]/35 px-4 py-3 sm:px-12">{busy === `deliveries-${message.id}` ? <div className="flex items-center gap-2 py-2 text-[12px] text-[var(--projects-muted)]"><LoaderCircle size={13} className="animate-spin" aria-hidden="true" />Loading deliveries…</div> : messageDeliveries.length === 0 ? <p className="m-0 py-2 text-[12px] text-[var(--projects-muted)]">No delivery rows found.</p> : <div className="grid gap-2">{messageDeliveries.map((delivery) => <div key={delivery.id} className="flex flex-wrap items-center gap-3 rounded-md border border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-3 py-2 text-[11px]"><span className="font-mono text-[12px] text-[var(--projects-text)]">{delivery.address_preview}</span><span className="text-[var(--projects-muted)]">attempt {delivery.attempt_count}</span><span className={`rounded-full border px-2 py-0.5 uppercase tracking-[0.08em] ${statusClass(delivery.status)}`}>{delivery.status}</span>{delivery.last_error ? <span className="min-w-0 flex-1 truncate text-rose-200" title={delivery.last_error}>{delivery.last_error}</span> : null}</div>)}</div>}{deliveryCursors[message.id] ? <button type="button" onClick={() => void loadDeliveries(message.id, true)} disabled={busy !== null} className="mt-3 inline-flex h-8 items-center gap-2 rounded-md border border-[var(--projects-border)] px-2.5 text-[11px] font-semibold text-[var(--projects-text)] disabled:opacity-50">{busy === `deliveries-${message.id}` ? <LoaderCircle size={12} className="animate-spin" aria-hidden="true" /> : null}Load more deliveries</button> : null}</div> : null}
            </article>;
          })}
        </div>
      </div>}
      {messageCursor ? <button type="button" onClick={() => void loadMoreMessages()} disabled={busy !== null} className="mx-auto mt-4 flex h-8 items-center gap-2 rounded-md border border-[var(--projects-border)] px-3 text-[11px] font-semibold text-[var(--projects-text)] disabled:opacity-50">{busy === "messages-page" ? <LoaderCircle size={13} className="animate-spin" aria-hidden="true" /> : null}Load more messages</button> : null}
    </section>
  );
}
