import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { Bell, CheckCircle2, Clock3, LoaderCircle, XCircle } from "lucide-react";
import { browserAPI, browserAPIErrorMessage } from "@/lib/browser-api";
import { queryClient } from "./query-client";
import { ErrorState as AsyncErrorState } from "./error-state";

type Channel = "email" | "sms" | "push";

function statusIcon(status: string) {
  if (status === "succeeded") return <CheckCircle2 size={15} className="text-[var(--projects-accent)]" aria-hidden="true" />;
  if (status === "failed" || status === "cancelled") return <XCircle size={15} className="text-[var(--projects-danger)]" aria-hidden="true" />;
  if (status === "processing") return <LoaderCircle size={15} className="animate-spin text-[var(--projects-warning)]" aria-hidden="true" />;
  return <Clock3 size={15} className="text-[var(--projects-muted)]" aria-hidden="true" />;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function MessagingRoute() {
  const { projectId } = useParams({ from: "/projects/$projectId/messaging" });
  const providersQuery = useQuery({ queryKey: ["messaging-providers", projectId], queryFn: () => browserAPI.projectMessagingProviders(projectId) });
  const topicsQuery = useQuery({ queryKey: ["messaging-topics", projectId], queryFn: () => browserAPI.projectMessagingTopics(projectId) });
  const messagesQuery = useQuery({ queryKey: ["messaging-messages", projectId], queryFn: () => browserAPI.projectMessagingMessages(projectId) });
  const [topicID, setTopicID] = useState("");
  const [channel, setChannel] = useState<Channel>("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [dataJSON, setDataJSON] = useState("{}");
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);
  const [expandedMessageID, setExpandedMessageID] = useState<string | null>(null);

  const firstTopic = topicsQuery.data?.topics[0]?.id ?? "";
  const selectedTopicID = topicID || firstTopic;
  const expandedDeliveries = useQuery({
    queryKey: ["messaging-deliveries", projectId, expandedMessageID],
    queryFn: () => browserAPI.projectMessagingDeliveries(projectId, expandedMessageID!),
    enabled: expandedMessageID !== null,
  });
  const enabledChannels = useMemo(() => new Set(providersQuery.data?.providers.filter((provider) => provider.enabled).map((provider) => provider.channel) ?? []), [providersQuery.data?.providers]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTopicID || !body.trim()) { setFormError("Choose a topic and enter a message body."); return; }
    let data: Record<string, string> | undefined;
    try {
      const parsed: unknown = JSON.parse(dataJSON || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || Object.values(parsed).some((value) => typeof value !== "string")) throw new Error("Data must be a JSON object with string values.");
      data = Object.keys(parsed).length ? parsed as Record<string, string> : undefined;
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Data must be valid JSON.");
      return;
    }
    setPending(true);
    setFormError("");
    try {
      const idempotencyKey = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `vite-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await browserAPI.createProjectMessagingMessage(projectId, { topic_id: selectedTopicID, channel, subject: subject.trim() || undefined, body: body.trim(), data }, idempotencyKey);
      setBody("");
      setSubject("");
      await queryClient.invalidateQueries({ queryKey: ["messaging-messages", projectId] });
    } catch (error) {
      setFormError(browserAPIErrorMessage(error, "Unable to queue this message."));
    } finally {
      setPending(false);
    }
  }

  async function cancelMessage(messageID: string) {
    try {
      await browserAPI.cancelProjectMessagingMessage(projectId, messageID);
      await queryClient.invalidateQueries({ queryKey: ["messaging-messages", projectId] });
    } catch (error) {
      setFormError(browserAPIErrorMessage(error, "Unable to cancel this message."));
    }
  }

  if (providersQuery.isPending || topicsQuery.isPending || messagesQuery.isPending) return <LoadingState />;
  if (providersQuery.error || topicsQuery.error || messagesQuery.error) return <ErrorState error={providersQuery.error ?? topicsQuery.error ?? messagesQuery.error} />;
  const canManage = providersQuery.data.can_manage && topicsQuery.data.can_manage && messagesQuery.data.can_manage;

  return <section><Link to="/projects/$projectId" params={{ projectId }} className="text-sm text-[var(--projects-accent)] hover:underline">← Project overview</Link><header className="mt-5 border-b border-[var(--projects-border)] pb-6"><div className="flex items-start gap-3"><span className="inline-flex size-10 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--projects-accent)_14%,transparent)] text-[var(--projects-accent)]"><Bell size={19} aria-hidden="true" /></span><div><p className="m-0 text-xs uppercase tracking-[0.12em] text-[var(--projects-muted)]">Project service</p><h1 className="m-0 mt-1 text-3xl font-semibold tracking-[-0.04em]">Messaging</h1><p className="m-0 mt-2 max-w-2xl text-sm leading-6 text-[var(--projects-muted)]">Queue transactional email, SMS, or push notifications. Payloads are encrypted at rest and delivery happens in the trusted worker.</p></div></div></header>{!canManage ? <p className="mt-5 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] p-4 text-sm text-[var(--projects-muted)]">This project role can view messaging but cannot enqueue or cancel messages.</p> : null}<div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]"><form onSubmit={sendMessage} className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5" noValidate><h2 className="m-0 text-lg font-semibold">Queue a message</h2><label className="mt-5 block text-sm font-medium" htmlFor="vite-message-topic">Topic</label><select id="vite-message-topic" required value={selectedTopicID} onChange={(event) => setTopicID(event.target.value)} disabled={!canManage} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm"><option value="" disabled>Select topic</option>{topicsQuery.data.topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name} · {topic.subscriber_count} subscribers</option>)}</select><label className="mt-4 block text-sm font-medium" htmlFor="vite-message-channel">Channel</label><select id="vite-message-channel" value={channel} onChange={(event) => setChannel(event.target.value as Channel)} disabled={!canManage} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm"><option value="email">Email{enabledChannels.has("email") ? "" : " (no enabled provider)"}</option><option value="sms">SMS{enabledChannels.has("sms") ? "" : " (no enabled provider)"}</option><option value="push">Push{enabledChannels.has("push") ? "" : " (no enabled provider)"}</option></select>{channel === "email" ? <><label className="mt-4 block text-sm font-medium" htmlFor="vite-message-subject">Subject</label><input id="vite-message-subject" value={subject} onChange={(event) => setSubject(event.target.value)} disabled={!canManage} className="mt-1.5 h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm" /></> : null}<label className="mt-4 block text-sm font-medium" htmlFor="vite-message-body">Body</label><textarea id="vite-message-body" required rows={6} value={body} onChange={(event) => setBody(event.target.value)} disabled={!canManage} className="mt-1.5 w-full resize-y rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] p-3 text-sm leading-6" placeholder="Your message" /><label className="mt-4 block text-sm font-medium" htmlFor="vite-message-data">Data <span className="font-normal text-[var(--projects-muted)]">(optional JSON object)</span></label><textarea id="vite-message-data" rows={3} value={dataJSON} onChange={(event) => setDataJSON(event.target.value)} disabled={!canManage} className="mt-1.5 w-full resize-y rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] p-3 font-mono text-xs leading-5" />{formError ? <p className="mt-3 text-sm text-[var(--projects-danger)]" role="alert">{formError}</p> : null}<button type="submit" disabled={!canManage || pending || !topicsQuery.data.topics.length} className="mt-5 h-10 w-full rounded-lg bg-[var(--projects-accent-strong)] px-4 text-sm font-semibold text-white hover:bg-[var(--projects-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60">{pending ? "Queueing…" : "Queue message"}</button></form><div className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5"><div className="flex items-center justify-between gap-3"><h2 className="m-0 text-lg font-semibold">Recent messages</h2><span className="text-xs text-[var(--projects-muted)]">{messagesQuery.data.messages.length} loaded</span></div>{messagesQuery.data.messages.length ? <div className="mt-4 divide-y divide-[var(--projects-divider)]">{messagesQuery.data.messages.map((message) => <div key={message.id} className="py-4"><div className="flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={() => setExpandedMessageID((current) => current === message.id ? null : message.id)} className="inline-flex items-center gap-2 text-left text-sm font-medium hover:text-[var(--projects-accent)]">{statusIcon(message.status)}<span className="capitalize">{message.status}</span><span className="font-mono text-xs text-[var(--projects-muted)]">{message.channel}</span></button><time className="text-xs text-[var(--projects-muted)]" dateTime={message.created_at}>{formatDate(message.created_at)}</time></div><div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--projects-muted)]"><span>{message.succeeded_count}/{message.recipient_count} delivered · {message.failed_count} failed</span>{canManage && (message.status === "queued" || message.status === "processing") ? <button type="button" onClick={() => void cancelMessage(message.id)} className="text-[var(--projects-danger)] hover:underline">Cancel</button> : null}</div>{expandedMessageID === message.id ? <div className="mt-3 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] p-3 text-xs">{expandedDeliveries.isPending ? <p className="m-0 text-[var(--projects-muted)]">Loading deliveries…</p> : expandedDeliveries.error ? <p className="m-0 text-[var(--projects-danger)]">Unable to load deliveries.</p> : expandedDeliveries.data.deliveries.length ? <div className="divide-y divide-[var(--projects-divider)]">{expandedDeliveries.data.deliveries.map((delivery) => <div key={delivery.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span className="font-mono">{delivery.address_preview}</span><span className="inline-flex items-center gap-1.5 text-[var(--projects-muted)]">{statusIcon(delivery.status)}{delivery.status}</span></div>)}</div> : <p className="m-0 text-[var(--projects-muted)]">No deliveries found.</p>}</div> : null}</div>)}</div> : <p className="m-0 mt-6 rounded-lg border border-dashed border-[var(--projects-border)] p-8 text-center text-sm text-[var(--projects-muted)]">No messages queued yet.</p>}</div></div></section>;
}

function LoadingState() { return <div className="grid min-h-[18rem] place-items-center rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] text-sm text-[var(--projects-muted)]">Loading messaging…</div>; }
function ErrorState({ error }: { error: unknown }) { return <AsyncErrorState error={error} fallback="Unable to load messaging." />; }
