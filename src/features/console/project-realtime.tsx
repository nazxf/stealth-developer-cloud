"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Circle, Copy, Pause, Play, Radio, RefreshCw, Trash2 } from "lucide-react";

const maxVisibleEvents = 100;
const reconnectDelay = 1500;

type ConnectionState = "connecting" | "live" | "reconnecting" | "paused" | "error";

type StreamFrame = {
  event: string;
  id: string | null;
  data: string;
};

type RealtimeItem = {
  id: string;
  event: string;
  raw: string;
  receivedAt: string;
};

function parseError(payload: unknown) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = payload.error;
    if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  }
  return "The Realtime stream could not be opened.";
}

async function streamFrames(response: Response, signal: AbortSignal, onFrame: (frame: StreamFrame) => void) {
  if (!response.body) throw new Error("The Realtime response did not include a stream.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let event = "message";
  let id: string | null = null;
  let data: string[] = [];

  const dispatch = () => {
    if (data.length > 0) onFrame({ event: event || "message", id, data: data.join("\n") });
    event = "message";
    id = null;
    data = [];
  };

  const consumeLine = (line: string) => {
    if (line === "") {
      dispatch();
      return;
    }
    if (line.startsWith(":")) return;
    const separator = line.indexOf(":");
    const field = separator === -1 ? line : line.slice(0, separator);
    const value = separator === -1 ? "" : line.slice(separator + 1).replace(/^ /, "");
    if (field === "event") event = value;
    else if (field === "id") id = value;
    else if (field === "data") data.push(value);
  };

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    if (signal.aborted) return;
    buffer += decoder.decode(chunk.value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) consumeLine(line);
  }
  buffer += decoder.decode();
  if (buffer) consumeLine(buffer);
  dispatch();
}

function eventPreview(raw: string) {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { timeStyle: "medium" }).format(new Date(value));
}

function statusLabel(status: ConnectionState) {
  if (status === "live") return "Live";
  if (status === "paused") return "Paused";
  if (status === "error") return "Error";
  if (status === "reconnecting") return "Reconnecting";
  return "Connecting";
}

export function ProjectRealtime({ projectId }: { projectId: string }) {
  const [eventFilter, setEventFilter] = useState("*");
  const [status, setStatus] = useState<ConnectionState>("connecting");
  const [items, setItems] = useState<RealtimeItem[]>([]);
  const [selectedID, setSelectedID] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [restart, setRestart] = useState(0);
  const cursorRef = useRef<string | null>(null);
  const selectedRef = useRef<string | null>(null);

  useEffect(() => {
    selectedRef.current = selectedID;
  }, [selectedID]);

  useEffect(() => {
    let stopped = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let controller: AbortController | null = null;

    if (paused) {
      setStatus("paused");
      return () => undefined;
    }

    const connect = async () => {
      if (stopped) return;
      setStatus(cursorRef.current ? "reconnecting" : "connecting");
      setError(null);
      controller = new AbortController();
      const activeController = controller;
      const params = new URLSearchParams({ events: eventFilter || "*" });
      if (cursorRef.current) params.set("cursor", cursorRef.current);

      try {
        const response = await fetch(`/api/stealth/projects/${encodeURIComponent(projectId)}/realtime?${params.toString()}`, {
          credentials: "include",
          headers: { accept: "text/event-stream" },
          cache: "no-store",
          signal: activeController.signal,
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(parseError(payload));
        }
        if (stopped) return;
        setStatus("live");
        await streamFrames(response, activeController.signal, (frame) => {
          if (stopped || activeController.signal.aborted) return;
          let payload: unknown;
          try { payload = JSON.parse(frame.data); } catch { payload = frame.data; }
          const payloadID = payload && typeof payload === "object" && "id" in payload && typeof payload.id === "string" ? payload.id : null;
          const id = frame.id ?? payloadID;
          if (id) cursorRef.current = id;
          const item: RealtimeItem = {
            id: id ?? `${frame.event}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            event: frame.event,
            raw: frame.data,
            receivedAt: new Date().toISOString(),
          };
          setItems((current) => [item, ...current].slice(0, maxVisibleEvents));
          if (!selectedRef.current) {
            selectedRef.current = item.id;
            setSelectedID(item.id);
          }
        });
        if (stopped || activeController.signal.aborted) return;
        setStatus("reconnecting");
      } catch (streamError) {
        if (stopped || activeController.signal.aborted) return;
        setStatus("error");
        setError(streamError instanceof Error ? streamError.message : "The Realtime stream disconnected.");
      }
      if (!stopped) reconnectTimer = setTimeout(() => void connect(), reconnectDelay);
    };

    void connect();
    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      controller?.abort();
    };
  }, [eventFilter, paused, projectId, restart]);

  const selected = items.find((item) => item.id === selectedID) ?? items[0] ?? null;

  function clearEvents() {
    setItems([]);
    setSelectedID(null);
    selectedRef.current = null;
    cursorRef.current = null;
    setCopied(false);
  }

  async function copySelected() {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(eventPreview(selected.raw));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Clipboard access was unavailable. Copy the event manually.");
    }
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--projects-border)] pb-6">
        <div>
          <p className="m-0 font-mono text-[12px] text-[var(--projects-muted)]">project: {projectId}</p>
          <h1 className="m-0 mt-2 flex items-center gap-2 text-[28px] font-semibold tracking-[-0.035em] text-[var(--projects-text)]"><Radio size={24} className="text-[var(--projects-accent)]" aria-hidden="true" />Realtime</h1>
          <p className="m-0 mt-2 max-w-2xl text-[14px] leading-6 text-[var(--projects-muted)]">Inspect permission-aware project events as they arrive. The stream replays from the last cursor after a reconnect and retains events for seven days.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-1.5 text-[12px] text-[var(--projects-muted)]" role="status" aria-live="polite">
          <Circle size={9} fill="currentColor" className={status === "live" ? "text-emerald-400" : status === "error" ? "text-rose-400" : "text-amber-300"} aria-hidden="true" />
          {statusLabel(status)}
        </div>
      </header>

      <div className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-4">
        <label className="min-w-[220px] flex-1 text-[12px] font-medium text-[var(--projects-muted)]">Event filter
          <select value={eventFilter} onChange={(event) => { setEventFilter(event.target.value); clearEvents(); }} className="mt-1 block h-10 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-[13px] text-[var(--projects-text)]">
            <option value="*">All events</option>
            <option value="project.create">project.create</option>
            <option value="project.update">project.update</option>
            <option value="database_row.create">database_row.create</option>
            <option value="database_row.update">database_row.update</option>
            <option value="database_row.delete">database_row.delete</option>
            <option value="project_user.create">project_user.create</option>
            <option value="project_user.status_change">project_user.status_change</option>
            <option value="storage_file.create">storage_file.create</option>
            <option value="storage_file.update">storage_file.update</option>
            <option value="storage_file.delete">storage_file.delete</option>
            <option value="function_execution.accept">function_execution.accept</option>
            <option value="function_execution.succeeded">function_execution.succeeded</option>
            <option value="function_execution.failed">function_execution.failed</option>
            <option value="site_deployment.create">site_deployment.create</option>
            <option value="site_deployment.activate">site_deployment.activate</option>
          </select>
        </label>
        <button type="button" onClick={() => setPaused((value) => !value)} className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--projects-border)] px-3 text-[12px] font-semibold text-[var(--projects-text)] hover:bg-[color-mix(in_srgb,var(--projects-text)_6%,transparent)]">{paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}{paused ? "Resume" : "Pause"}</button>
        <button type="button" onClick={clearEvents} className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--projects-border)] px-3 text-[12px] font-semibold text-[var(--projects-text)] hover:bg-[color-mix(in_srgb,var(--projects-text)_6%,transparent)]"><Trash2 size={14} aria-hidden="true" />Clear</button>
        <button type="button" onClick={() => setRestart((value) => value + 1)} className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--projects-border)] px-3 text-[12px] font-semibold text-[var(--projects-text)] hover:bg-[color-mix(in_srgb,var(--projects-text)_6%,transparent)]"><RefreshCw size={14} aria-hidden="true" />Reconnect</button>
      </div>

      {error ? <p role="alert" className="mt-4 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">{error}</p> : null}

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <div className="overflow-hidden rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)]">
          <div className="flex items-center justify-between border-b border-[var(--projects-divider)] px-4 py-3"><div><h2 className="m-0 text-[14px] font-semibold text-[var(--projects-text)]">Event stream</h2><p className="m-0 mt-1 text-[11px] text-[var(--projects-muted)]">Showing {items.length} of {maxVisibleEvents} recent events</p></div><span className="font-mono text-[11px] text-[var(--projects-muted)]">cursor: {cursorRef.current ? `${cursorRef.current.slice(0, 8)}…` : "—"}</span></div>
          {items.length === 0 ? <div className="grid min-h-[360px] place-items-center px-6 py-12 text-center"><div className="max-w-sm"><Radio size={30} className="mx-auto text-[var(--projects-muted)]" aria-hidden="true" /><h3 className="m-0 mt-4 text-[15px] font-semibold text-[var(--projects-text)]">Waiting for events</h3><p className="m-0 mt-2 text-[13px] leading-6 text-[var(--projects-muted)]">Create or update a project resource in another tab. Matching events will appear here without exposing row values.</p></div></div> : <ul className="max-h-[560px] divide-y divide-[var(--projects-divider)] overflow-y-auto" role="list">{items.map((item) => <li key={item.id}><button type="button" onClick={() => { setSelectedID(item.id); selectedRef.current = item.id; }} className={`flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-[color-mix(in_srgb,var(--projects-text)_5%,transparent)] ${selected?.id === item.id ? "bg-[color-mix(in_srgb,var(--projects-accent)_9%,transparent)]" : ""}`}><span className="min-w-0"><span className="block truncate font-mono text-[12px] text-[var(--projects-text)]">{item.event}</span><span className="mt-1 block truncate font-mono text-[10px] text-[var(--projects-muted)]">{item.id}</span></span><time dateTime={item.receivedAt} className="shrink-0 text-[11px] text-[var(--projects-muted)]">{formatTime(item.receivedAt)}</time></button></li>)}</ul>}
        </div>

        <aside className="overflow-hidden rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)]"><div className="flex items-center justify-between border-b border-[var(--projects-divider)] px-4 py-3"><h2 className="m-0 text-[14px] font-semibold text-[var(--projects-text)]">Event payload</h2>{selected ? <button type="button" onClick={() => void copySelected()} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--projects-muted)] hover:text-[var(--projects-text)]">{copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}{copied ? "Copied" : "Copy JSON"}</button> : null}</div>{selected ? <div className="p-4"><p className="m-0 font-mono text-[11px] text-[var(--projects-accent)]">{selected.event}</p><pre className="mt-3 max-h-[500px] overflow-auto rounded-md border border-[var(--projects-divider)] bg-[var(--projects-control)] p-3 font-mono text-[11px] leading-5 text-[var(--projects-text)]">{eventPreview(selected.raw)}</pre></div> : <div className="grid min-h-[360px] place-items-center px-6 py-12 text-center"><p className="m-0 text-[13px] text-[var(--projects-muted)]">Select an event to inspect its envelope.</p></div>}</aside>
      </div>
    </section>
  );
}
