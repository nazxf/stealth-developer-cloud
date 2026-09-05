"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown, ChevronRight, LoaderCircle, Mail, MessageSquare, Plus, ShieldCheck, Smartphone, Trash2, Users, X } from "lucide-react";
import type { ProjectMessagingProvider, ProjectMessagingSubscriber, ProjectMessagingTopic } from "@/lib/stealth-api";
import { ProjectMessagingMessages } from "./project-messaging-messages";

type Props = {
  projectId: string;
  initialProviders: ProjectMessagingProvider[];
  initialProviderCursor: string | null;
  initialTopics: ProjectMessagingTopic[];
  initialTopicCursor: string | null;
  initialMessages: import("@/lib/stealth-api").ProjectMessagingMessage[];
  initialMessageCursor: string | null;
  initialCanManage: boolean;
};

type RequestErrorPayload = { error?: { message?: string } };

class MessagingBridgeError extends Error {
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
    throw new MessagingBridgeError(response.status, error?.error?.message ?? "The request could not be completed.");
  }
  return payload as T;
}

function providersPath(projectId: string, suffix = "") {
  return `/api/stealth/projects/${encodeURIComponent(projectId)}/messaging/providers${suffix}`;
}

function topicsPath(projectId: string, suffix = "") {
  return `/api/stealth/projects/${encodeURIComponent(projectId)}/messaging/topics${suffix}`;
}

function subscribersPath(projectId: string, topicId: string, suffix = "") {
  return `${topicsPath(projectId, `/${encodeURIComponent(topicId)}`)}/subscribers${suffix}`;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
const channels: ProjectMessagingProvider["channel"][] = ["email", "sms", "push"];

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function ChannelIcon({ channel }: { channel: ProjectMessagingProvider["channel"] }) {
  if (channel === "email") return <Mail size={16} aria-hidden="true" />;
  if (channel === "sms") return <Smartphone size={16} aria-hidden="true" />;
  return <Bell size={16} aria-hidden="true" />;
}

function channelLabel(channel: ProjectMessagingProvider["channel"]) {
  return channel === "sms" ? "SMS" : channel === "push" ? "Push" : "Email";
}

function errorText(reason: unknown, fallback: string) {
  if (reason instanceof MessagingBridgeError && reason.status === 403) return "This action requires a project owner/admin or a messaging.write API key.";
  return reason instanceof Error ? reason.message : fallback;
}

export function ProjectMessaging({ projectId, initialProviders, initialProviderCursor, initialTopics, initialTopicCursor, initialMessages, initialMessageCursor, initialCanManage }: Props) {
  const router = useRouter();
  const [providers, setProviders] = useState(initialProviders);
  const [providerCursor, setProviderCursor] = useState(initialProviderCursor);
  const [topics, setTopics] = useState(initialTopics);
  const [topicCursor, setTopicCursor] = useState(initialTopicCursor);
  const [canManage, setCanManage] = useState(initialCanManage);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"provider" | "topic" | "subscriber" | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<ProjectMessagingTopic | null>(null);
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);
  const [subscribers, setSubscribers] = useState<Record<string, ProjectMessagingSubscriber[]>>({});
  const [subscriberCursors, setSubscriberCursors] = useState<Record<string, string | null>>({});
  const [providerName, setProviderName] = useState("");
  const [providerChannel, setProviderChannel] = useState<ProjectMessagingProvider["channel"]>("email");
  const [providerType, setProviderType] = useState("");
  const [providerCredentials, setProviderCredentials] = useState("{}");
  const [topicName, setTopicName] = useState("");
  const [topicDescription, setTopicDescription] = useState("");
  const [subscriberChannel, setSubscriberChannel] = useState<ProjectMessagingProvider["channel"]>("email");
  const [subscriberAddress, setSubscriberAddress] = useState("");

  function closeDialog() {
    if (busy) return;
    setDialog(null);
    setSelectedTopic(null);
  }

  function openSubscriber(topic: ProjectMessagingTopic) {
    setSelectedTopic(topic);
    setSubscriberChannel("email");
    setSubscriberAddress("");
    setError(null);
    setDialog("subscriber");
  }

  async function createProvider(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy("create-provider");
    setError(null);
    try {
      const parsed = JSON.parse(providerCredentials || "{}");
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Credentials must be a JSON object.");
      for (const value of Object.values(parsed as Record<string, unknown>)) if (typeof value !== "string") throw new Error("Credential values must be strings.");
      const response = await bridgeJSON<{ provider: ProjectMessagingProvider }>(providersPath(projectId), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: providerName.trim(), channel: providerChannel, provider: providerType.trim(), credentials: parsed }),
      });
      setProviders((current) => [response.provider, ...current]);
      setProviderName("");
      setProviderType("");
      setProviderCredentials("{}");
      setDialog(null);
      router.refresh();
    } catch (reason) {
      setError(errorText(reason, "The provider could not be created."));
    } finally {
      setBusy(null);
    }
  }

  async function toggleProvider(provider: ProjectMessagingProvider) {
    if (busy) return;
    setBusy(provider.id);
    setError(null);
    try {
      const response = await bridgeJSON<{ provider: ProjectMessagingProvider }>(providersPath(projectId, `/${encodeURIComponent(provider.id)}`), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: !provider.enabled }),
      });
      setProviders((current) => current.map((item) => item.id === provider.id ? response.provider : item));
    } catch (reason) {
      setError(errorText(reason, "The provider could not be updated."));
    } finally {
      setBusy(null);
    }
  }

  async function removeProvider(provider: ProjectMessagingProvider) {
    if (busy || !window.confirm(`Delete messaging provider “${provider.name}”?`)) return;
    setBusy(provider.id);
    setError(null);
    try {
      await bridgeJSON<void>(providersPath(projectId, `/${encodeURIComponent(provider.id)}`), { method: "DELETE" });
      setProviders((current) => current.filter((item) => item.id !== provider.id));
    } catch (reason) {
      setError(errorText(reason, "The provider could not be deleted."));
    } finally {
      setBusy(null);
    }
  }

  async function createTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy("create-topic");
    setError(null);
    try {
      const response = await bridgeJSON<{ topic: ProjectMessagingTopic }>(topicsPath(projectId), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: topicName.trim(), description: topicDescription.trim() }),
      });
      setTopics((current) => [response.topic, ...current]);
      setTopicName("");
      setTopicDescription("");
      setDialog(null);
      router.refresh();
    } catch (reason) {
      setError(errorText(reason, "The topic could not be created."));
    } finally {
      setBusy(null);
    }
  }

  async function toggleTopic(topic: ProjectMessagingTopic) {
    if (busy) return;
    setBusy(topic.id);
    setError(null);
    try {
      const response = await bridgeJSON<{ topic: ProjectMessagingTopic }>(topicsPath(projectId, `/${encodeURIComponent(topic.id)}`), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: !topic.enabled }),
      });
      setTopics((current) => current.map((item) => item.id === topic.id ? response.topic : item));
    } catch (reason) {
      setError(errorText(reason, "The topic could not be updated."));
    } finally {
      setBusy(null);
    }
  }

  async function removeTopic(topic: ProjectMessagingTopic) {
    if (busy || !window.confirm(`Delete topic “${topic.name}” and its subscribers?`)) return;
    setBusy(topic.id);
    setError(null);
    try {
      await bridgeJSON<void>(topicsPath(projectId, `/${encodeURIComponent(topic.id)}`), { method: "DELETE" });
      setTopics((current) => current.filter((item) => item.id !== topic.id));
      setSubscribers((current) => {
        const next = { ...current };
        delete next[topic.id];
        return next;
      });
      if (expandedTopic === topic.id) setExpandedTopic(null);
    } catch (reason) {
      setError(errorText(reason, "The topic could not be deleted."));
    } finally {
      setBusy(null);
    }
  }

  async function loadSubscribers(topic: ProjectMessagingTopic, append = false) {
    if (busy) return;
    if (!append && subscribers[topic.id]) {
      setExpandedTopic(topic.id);
      return;
    }
    setBusy(`subscribers-${topic.id}`);
    setError(null);
    try {
      const cursor = append ? subscriberCursors[topic.id] : null;
      const query = new URLSearchParams({ limit: "20" });
      if (cursor) query.set("cursor", cursor);
      const response = await bridgeJSON<{ subscribers: ProjectMessagingSubscriber[]; pagination: { next_cursor: string | null } }>(`${subscribersPath(projectId, topic.id)}?${query.toString()}`);
      setSubscribers((current) => ({ ...current, [topic.id]: append ? [...(current[topic.id] ?? []), ...response.subscribers] : response.subscribers }));
      setSubscriberCursors((current) => ({ ...current, [topic.id]: response.pagination.next_cursor }));
      setExpandedTopic(topic.id);
    } catch (reason) {
      setError(errorText(reason, "Subscribers could not be loaded."));
    } finally {
      setBusy(null);
    }
  }

  async function createSubscriber(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !selectedTopic) return;
    setBusy(`create-subscriber-${selectedTopic.id}`);
    setError(null);
    try {
      const response = await bridgeJSON<{ subscriber: ProjectMessagingSubscriber }>(subscribersPath(projectId, selectedTopic.id), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channel: subscriberChannel, address: subscriberAddress.trim() }),
      });
      setSubscribers((current) => ({ ...current, [selectedTopic.id]: [response.subscriber, ...(current[selectedTopic.id] ?? [])] }));
      setSubscriberCursors((current) => ({ ...current, [selectedTopic.id]: current[selectedTopic.id] ?? null }));
      setTopics((current) => current.map((item) => item.id === selectedTopic.id ? { ...item, subscriber_count: item.subscriber_count + 1 } : item));
      setExpandedTopic(selectedTopic.id);
      setDialog(null);
      setSelectedTopic(null);
      setSubscriberAddress("");
      router.refresh();
    } catch (reason) {
      setError(errorText(reason, "The subscriber could not be created."));
    } finally {
      setBusy(null);
    }
  }

  async function removeSubscriber(topic: ProjectMessagingTopic, subscriber: ProjectMessagingSubscriber) {
    if (busy || !window.confirm(`Remove subscriber ${subscriber.address_preview}?`)) return;
    setBusy(subscriber.id);
    setError(null);
    try {
      await bridgeJSON<void>(subscribersPath(projectId, topic.id, `/${encodeURIComponent(subscriber.id)}`), { method: "DELETE" });
      setSubscribers((current) => ({ ...current, [topic.id]: (current[topic.id] ?? []).filter((item) => item.id !== subscriber.id) }));
      setTopics((current) => current.map((item) => item.id === topic.id ? { ...item, subscriber_count: Math.max(0, item.subscriber_count - 1) } : item));
    } catch (reason) {
      setError(errorText(reason, "The subscriber could not be deleted."));
    } finally {
      setBusy(null);
    }
  }

  async function loadMoreProviders() {
    if (!providerCursor || busy) return;
    setBusy("providers-page");
    setError(null);
    try {
      const response = await bridgeJSON<{ providers: ProjectMessagingProvider[]; pagination: { next_cursor: string | null }; can_manage: boolean }>(`${providersPath(projectId)}?limit=20&cursor=${encodeURIComponent(providerCursor)}`);
      setProviders((current) => [...current, ...response.providers]);
      setProviderCursor(response.pagination.next_cursor);
      setCanManage(response.can_manage);
    } catch (reason) {
      setError(errorText(reason, "More providers could not be loaded."));
    } finally {
      setBusy(null);
    }
  }

  async function loadMoreTopics() {
    if (!topicCursor || busy) return;
    setBusy("topics-page");
    setError(null);
    try {
      const response = await bridgeJSON<{ topics: ProjectMessagingTopic[]; pagination: { next_cursor: string | null }; can_manage: boolean }>(`${topicsPath(projectId)}?limit=20&cursor=${encodeURIComponent(topicCursor)}`);
      setTopics((current) => [...current, ...response.topics]);
      setTopicCursor(response.pagination.next_cursor);
      setCanManage(response.can_manage);
    } catch (reason) {
      setError(errorText(reason, "More topics could not be loaded."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--projects-border)] pb-6">
        <div>
          <p className="m-0 font-mono text-[12px] text-[var(--projects-muted)]">project: {projectId}</p>
          <h1 className="m-0 mt-2 text-[28px] font-semibold tracking-[-0.035em] text-[var(--projects-text)]">Messaging</h1>
          <p className="m-0 mt-2 max-w-2xl text-[14px] leading-6 text-[var(--projects-muted)]">Configure providers, organize recipients into topics, and queue messages for the trusted delivery worker. Credentials, addresses, and message content are encrypted at rest and never shown again.</p>
        </div>
        {canManage ? <div className="flex flex-wrap gap-2"><button type="button" onClick={() => { setError(null); setDialog("provider"); }} className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-[var(--projects-accent-border)] bg-[var(--projects-accent-strong)] px-4 text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.4)] hover:bg-[var(--projects-accent-hover)]"><Plus size={15} aria-hidden="true" />Add provider</button><button type="button" onClick={() => { setError(null); setDialog("topic"); }} className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-[var(--projects-border)] bg-[var(--projects-control)] px-4 text-[13px] font-semibold text-[var(--projects-text)]"><Plus size={15} aria-hidden="true" />Create topic</button></div> : null}
      </header>

      {error ? <p role="alert" className="mt-5 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">{error}</p> : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section aria-labelledby="messaging-providers-heading">
          <div className="flex items-center justify-between gap-3"><div><p className="m-0 text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--projects-muted)]">Delivery configuration</p><h2 id="messaging-providers-heading" className="m-0 mt-1 text-[18px] font-semibold text-[var(--projects-text)]">Providers</h2></div><span className="rounded-full border border-[var(--projects-border)] px-2 py-1 text-[11px] text-[var(--projects-muted)]">{providers.length}</span></div>
          {providers.length === 0 ? <div className="mt-4 grid min-h-[230px] place-items-center rounded-xl border border-dashed border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-6 py-10 text-center"><div className="max-w-sm"><ShieldCheck size={28} className="mx-auto text-[var(--projects-muted)]" aria-hidden="true" /><h3 className="m-0 mt-3 text-[15px] font-semibold text-[var(--projects-text)]">No providers configured</h3><p className="m-0 mt-2 text-[13px] leading-5 text-[var(--projects-muted)]">Add a provider before a trusted delivery worker can send messages for this project.</p></div></div> : <div className="mt-4 grid gap-3">{providers.map((provider) => <article key={provider.id} className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-4"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] text-[var(--projects-accent)]"><ChannelIcon channel={provider.channel} /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="m-0 truncate text-[15px] font-semibold text-[var(--projects-text)]">{provider.name}</h3><span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] ${provider.enabled ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" : "border-[var(--projects-border)] text-[var(--projects-muted)]"}`}>{provider.enabled ? "Enabled" : "Paused"}</span></div><p className="m-0 mt-1 text-[12px] text-[var(--projects-muted)]">{channelLabel(provider.channel)} · <span className="font-mono">{provider.provider}</span></p></div></div>{canManage ? <div className="flex shrink-0 items-center gap-1.5"><button type="button" disabled={busy === provider.id} onClick={() => void toggleProvider(provider)} className="rounded-md border border-[var(--projects-border)] px-2 py-1.5 text-[11px] font-semibold text-[var(--projects-text)] disabled:opacity-50">{busy === provider.id ? <LoaderCircle size={13} className="animate-spin" aria-label="Updating" /> : provider.enabled ? "Pause" : "Enable"}</button><button type="button" disabled={busy === provider.id} onClick={() => void removeProvider(provider)} aria-label={`Delete ${provider.name}`} className="rounded-md border border-rose-500/30 p-1.5 text-rose-200 disabled:opacity-50"><Trash2 size={13} aria-hidden="true" /></button></div> : null}</div><div className="mt-3 flex items-center justify-between border-t border-[var(--projects-divider)] pt-3 text-[11px] text-[var(--projects-muted)]"><span>{provider.credentials_present ? "Credentials configured" : "No credentials"}</span><span>Updated {formatDate(provider.updated_at)}</span></div></article>)}</div>}
          {providerCursor ? <button type="button" onClick={() => void loadMoreProviders()} disabled={busy !== null} className="mx-auto mt-4 flex h-8 items-center gap-2 rounded-md border border-[var(--projects-border)] px-3 text-[11px] font-semibold text-[var(--projects-text)] disabled:opacity-50">{busy === "providers-page" ? <LoaderCircle size={13} className="animate-spin" aria-hidden="true" /> : null}Load more providers</button> : null}
        </section>

        <section aria-labelledby="messaging-topics-heading">
          <div className="flex items-center justify-between gap-3"><div><p className="m-0 text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--projects-muted)]">Audience management</p><h2 id="messaging-topics-heading" className="m-0 mt-1 text-[18px] font-semibold text-[var(--projects-text)]">Topics</h2></div><span className="rounded-full border border-[var(--projects-border)] px-2 py-1 text-[11px] text-[var(--projects-muted)]">{topics.length}</span></div>
          {topics.length === 0 ? <div className="mt-4 grid min-h-[230px] place-items-center rounded-xl border border-dashed border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-6 py-10 text-center"><div className="max-w-sm"><MessageSquare size={28} className="mx-auto text-[var(--projects-muted)]" aria-hidden="true" /><h3 className="m-0 mt-3 text-[15px] font-semibold text-[var(--projects-text)]">No topics yet</h3><p className="m-0 mt-2 text-[13px] leading-5 text-[var(--projects-muted)]">Topics are durable recipient lists that a future delivery worker can target.</p></div></div> : <div className="mt-4 grid gap-3">{topics.map((topic) => { const isExpanded = expandedTopic === topic.id; const topicSubscribers = subscribers[topic.id] ?? []; return <article key={topic.id} className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)]"><div className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => isExpanded ? setExpandedTopic(null) : void loadSubscribers(topic)} className="inline-flex items-center gap-1 text-left"><span className="text-[var(--projects-muted)]">{isExpanded ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronRight size={15} aria-hidden="true" />}</span><h3 className="m-0 truncate text-[15px] font-semibold text-[var(--projects-text)]">{topic.name}</h3></button><span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] ${topic.enabled ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" : "border-[var(--projects-border)] text-[var(--projects-muted)]"}`}>{topic.enabled ? "Enabled" : "Paused"}</span></div>{topic.description ? <p className="m-0 mt-2 text-[13px] leading-5 text-[var(--projects-muted)]">{topic.description}</p> : null}<p className="m-0 mt-2 flex items-center gap-1.5 text-[11px] text-[var(--projects-muted)]"><Users size={13} aria-hidden="true" />{topic.subscriber_count} active subscriber{topic.subscriber_count === 1 ? "" : "s"} · Updated {formatDate(topic.updated_at)}</p></div>{canManage ? <div className="flex shrink-0 items-center gap-1.5"><button type="button" disabled={busy === topic.id} onClick={() => void toggleTopic(topic)} className="rounded-md border border-[var(--projects-border)] px-2 py-1.5 text-[11px] font-semibold text-[var(--projects-text)] disabled:opacity-50">{busy === topic.id ? <LoaderCircle size={13} className="animate-spin" aria-label="Updating" /> : topic.enabled ? "Pause" : "Enable"}</button><button type="button" onClick={() => void openSubscriber(topic)} className="rounded-md border border-[var(--projects-border)] p-1.5 text-[var(--projects-accent)]" aria-label={`Add subscriber to ${topic.name}`}><Plus size={14} aria-hidden="true" /></button><button type="button" disabled={busy === topic.id} onClick={() => void removeTopic(topic)} aria-label={`Delete ${topic.name}`} className="rounded-md border border-rose-500/30 p-1.5 text-rose-200 disabled:opacity-50"><Trash2 size={13} aria-hidden="true" /></button></div> : null}</div></div>{isExpanded ? <div className="border-t border-[var(--projects-divider)] bg-[var(--projects-control)]/35 px-4 py-3">{busy === `subscribers-${topic.id}` ? <div className="flex items-center gap-2 py-3 text-[12px] text-[var(--projects-muted)]"><LoaderCircle size={14} className="animate-spin" aria-hidden="true" />Loading subscribers…</div> : topicSubscribers.length === 0 ? <p className="m-0 py-2 text-[12px] text-[var(--projects-muted)]">No subscribers yet.</p> : <div className="grid gap-2">{topicSubscribers.map((subscriber) => <div key={subscriber.id} className="flex items-center justify-between gap-3 rounded-md border border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-3 py-2"><div className="flex min-w-0 items-center gap-2"><ChannelIcon channel={subscriber.channel} /><span className="truncate font-mono text-[12px] text-[var(--projects-text)]">{subscriber.address_preview}</span><span className="shrink-0 text-[10px] uppercase tracking-[0.08em] text-[var(--projects-muted)]">{channelLabel(subscriber.channel)}</span></div>{canManage ? <button type="button" disabled={busy === subscriber.id} onClick={() => void removeSubscriber(topic, subscriber)} aria-label={`Delete subscriber ${subscriber.address_preview}`} className="shrink-0 rounded-md p-1.5 text-rose-200 disabled:opacity-50"><Trash2 size={13} aria-hidden="true" /></button> : null}</div>)}</div>}{subscriberCursors[topic.id] ? <button type="button" onClick={() => void loadSubscribers(topic, true)} disabled={busy !== null} className="mt-3 inline-flex h-8 items-center gap-2 rounded-md border border-[var(--projects-border)] px-2.5 text-[11px] font-semibold text-[var(--projects-text)] disabled:opacity-50">{busy === `subscribers-${topic.id}` ? <LoaderCircle size={13} className="animate-spin" aria-hidden="true" /> : null}Load more</button> : null}{canManage ? <button type="button" onClick={() => void openSubscriber(topic)} className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--projects-border)] px-2.5 text-[11px] font-semibold text-[var(--projects-text)]"><Plus size={13} aria-hidden="true" />Add subscriber</button> : null}</div> : null}</article>; })}</div>}
          {topicCursor ? <button type="button" onClick={() => void loadMoreTopics()} disabled={busy !== null} className="mx-auto mt-4 flex h-8 items-center gap-2 rounded-md border border-[var(--projects-border)] px-3 text-[11px] font-semibold text-[var(--projects-text)] disabled:opacity-50">{busy === "topics-page" ? <LoaderCircle size={13} className="animate-spin" aria-hidden="true" /> : null}Load more topics</button> : null}
        </section>
      </div>

      <ProjectMessagingMessages projectId={projectId} topics={topics} canManage={canManage} initialMessages={initialMessages} initialMessageCursor={initialMessageCursor} />

      {dialog === "provider" ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="presentation"><div role="dialog" aria-modal="true" aria-labelledby="messaging-provider-dialog-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 id="messaging-provider-dialog-title" className="m-0 text-[17px] font-semibold text-[var(--projects-text)]">Add messaging provider</h2><p className="m-0 mt-1 text-[12px] leading-5 text-[var(--projects-muted)]">Credentials are encrypted before they are stored. They will not be returned by the API.</p></div><button type="button" onClick={closeDialog} aria-label="Close" className="rounded-md p-1 text-[var(--projects-muted)] hover:bg-[var(--projects-control)]"><X size={16} aria-hidden="true" /></button></div><form onSubmit={(event) => void createProvider(event)} className="mt-5 space-y-4"><label className="block text-[12px] font-medium text-[var(--projects-muted)]">Name<input value={providerName} onChange={(event) => setProviderName(event.target.value)} required minLength={2} maxLength={120} placeholder="Transactional email" className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 text-[13px] text-[var(--projects-text)]" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block text-[12px] font-medium text-[var(--projects-muted)]">Channel<select value={providerChannel} onChange={(event) => setProviderChannel(event.target.value as ProjectMessagingProvider["channel"])} className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 text-[13px] text-[var(--projects-text)]">{channels.map((channel) => <option key={channel} value={channel}>{channelLabel(channel)}</option>)}</select></label><label className="block text-[12px] font-medium text-[var(--projects-muted)]">Provider<input value={providerType} onChange={(event) => setProviderType(event.target.value)} required maxLength={64} placeholder="ses, twilio, fcm" className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 font-mono text-[12px] text-[var(--projects-text)]" /></label></div><label className="block text-[12px] font-medium text-[var(--projects-muted)]">Credentials JSON <span className="font-normal">(values are strings)</span><textarea value={providerCredentials} onChange={(event) => setProviderCredentials(event.target.value)} rows={7} spellCheck={false} className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 font-mono text-[12px] leading-5 text-[var(--projects-text)]" placeholder={'{"api_key":"…"}'} /></label><div className="flex justify-end gap-2 border-t border-[var(--projects-divider)] pt-4"><button type="button" onClick={closeDialog} disabled={busy !== null} className="inline-flex h-9 items-center rounded-md border border-[var(--projects-border)] px-3 text-[12px] font-semibold text-[var(--projects-text)]">Cancel</button><button type="submit" disabled={busy !== null} className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--projects-accent-strong)] px-3 text-[12px] font-semibold text-white">{busy === "create-provider" ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}Add provider</button></div></form></div></div> : null}

      {dialog === "topic" ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="presentation"><div role="dialog" aria-modal="true" aria-labelledby="messaging-topic-dialog-title" className="w-full max-w-lg rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 id="messaging-topic-dialog-title" className="m-0 text-[17px] font-semibold text-[var(--projects-text)]">Create topic</h2><p className="m-0 mt-1 text-[12px] leading-5 text-[var(--projects-muted)]">Topics keep recipient lists separate from provider credentials.</p></div><button type="button" onClick={closeDialog} aria-label="Close" className="rounded-md p-1 text-[var(--projects-muted)] hover:bg-[var(--projects-control)]"><X size={16} aria-hidden="true" /></button></div><form onSubmit={(event) => void createTopic(event)} className="mt-5 space-y-4"><label className="block text-[12px] font-medium text-[var(--projects-muted)]">Name<input value={topicName} onChange={(event) => setTopicName(event.target.value)} required minLength={2} maxLength={120} placeholder="Product updates" className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 text-[13px] text-[var(--projects-text)]" /></label><label className="block text-[12px] font-medium text-[var(--projects-muted)]">Description <span className="font-normal">(optional)</span><textarea value={topicDescription} onChange={(event) => setTopicDescription(event.target.value)} rows={4} maxLength={2000} className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 text-[13px] leading-5 text-[var(--projects-text)]" placeholder="People who opted into product announcements" /></label><div className="flex justify-end gap-2 border-t border-[var(--projects-divider)] pt-4"><button type="button" onClick={closeDialog} disabled={busy !== null} className="inline-flex h-9 items-center rounded-md border border-[var(--projects-border)] px-3 text-[12px] font-semibold text-[var(--projects-text)]">Cancel</button><button type="submit" disabled={busy !== null} className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--projects-accent-strong)] px-3 text-[12px] font-semibold text-white">{busy === "create-topic" ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}Create topic</button></div></form></div></div> : null}

      {dialog === "subscriber" && selectedTopic ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="presentation"><div role="dialog" aria-modal="true" aria-labelledby="messaging-subscriber-dialog-title" className="w-full max-w-lg rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 id="messaging-subscriber-dialog-title" className="m-0 text-[17px] font-semibold text-[var(--projects-text)]">Add subscriber</h2><p className="m-0 mt-1 text-[12px] leading-5 text-[var(--projects-muted)]">Add an address to <span className="font-semibold text-[var(--projects-text)]">{selectedTopic.name}</span>. It will only be shown as a masked preview.</p></div><button type="button" onClick={closeDialog} aria-label="Close" className="rounded-md p-1 text-[var(--projects-muted)] hover:bg-[var(--projects-control)]"><X size={16} aria-hidden="true" /></button></div><form onSubmit={(event) => void createSubscriber(event)} className="mt-5 space-y-4"><label className="block text-[12px] font-medium text-[var(--projects-muted)]">Channel<select value={subscriberChannel} onChange={(event) => setSubscriberChannel(event.target.value as ProjectMessagingProvider["channel"])} className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 text-[13px] text-[var(--projects-text)]">{channels.map((channel) => <option key={channel} value={channel}>{channelLabel(channel)}</option>)}</select></label><label className="block text-[12px] font-medium text-[var(--projects-muted)]">Address<input value={subscriberAddress} onChange={(event) => setSubscriberAddress(event.target.value)} required maxLength={2048} type={subscriberChannel === "email" ? "email" : "text"} placeholder={subscriberChannel === "email" ? "person@example.com" : subscriberChannel === "sms" ? "+15551234567" : "device-token"} className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 font-mono text-[12px] text-[var(--projects-text)]" /></label><div className="flex justify-end gap-2 border-t border-[var(--projects-divider)] pt-4"><button type="button" onClick={closeDialog} disabled={busy !== null} className="inline-flex h-9 items-center rounded-md border border-[var(--projects-border)] px-3 text-[12px] font-semibold text-[var(--projects-text)]">Cancel</button><button type="submit" disabled={busy !== null} className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--projects-accent-strong)] px-3 text-[12px] font-semibold text-white">{busy === `create-subscriber-${selectedTopic.id}` ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}Add subscriber</button></div></form></div></div> : null}
    </section>
  );
}
