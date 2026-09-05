import { Link, useParams } from "@tanstack/react-router";
import { Check, Circle, Copy, Pause, Play, Radio, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { browserAPI } from "@/lib/browser-api";

type ConnectionState = "connecting" | "live" | "reconnecting" | "paused" | "error";
type StreamFrame = { event: string; id: string | null; data: string };
type RealtimeItem = { id: string; event: string; raw: string; receivedAt: string };
const maxVisibleEvents = 100;

async function streamFrames(response: Response, signal: AbortSignal, onFrame: (frame: StreamFrame) => void) {
  if (!response.body) throw new Error("The Realtime response did not include a stream.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let event = "message";
  let id: string | null = null;
  let data: string[] = [];
  const dispatch = () => { if (data.length) onFrame({ event: event || "message", id, data: data.join("\n") }); event = "message"; id = null; data = []; };
  const consume = (line: string) => { if (!line) { dispatch(); return; } if (line.startsWith(":")) return; const separator = line.indexOf(":"); const field = separator === -1 ? line : line.slice(0, separator); const value = separator === -1 ? "" : line.slice(separator + 1).replace(/^ /, ""); if (field === "event") event = value; else if (field === "id") id = value; else if (field === "data") data.push(value); };
  while (true) { const chunk = await reader.read(); if (chunk.done || signal.aborted) break; buffer += decoder.decode(chunk.value, { stream: true }); const lines = buffer.split(/\r?\n/); buffer = lines.pop() ?? ""; lines.forEach(consume); }
  buffer += decoder.decode(); if (buffer) consume(buffer); dispatch();
}

function eventPreview(raw: string) { try { return JSON.stringify(JSON.parse(raw), null, 2); } catch { return raw; } }
function formatTime(value: string) { return new Intl.DateTimeFormat("en-US", { timeStyle: "medium" }).format(new Date(value)); }

export default function RealtimeRoute() {
  const { projectId } = useParams({ from: "/projects/$projectId/realtime" });
  const [eventFilter, setEventFilter] = useState("*");
  const [status, setStatus] = useState<ConnectionState>("connecting");
  const [items, setItems] = useState<RealtimeItem[]>([]);
  const [selectedID, setSelectedID] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [restart, setRestart] = useState(0);
  const cursorRef = useRef<string | null>(null);
  const selectedRef = useRef<string | null>(null);

  useEffect(() => { selectedRef.current = selectedID; }, [selectedID]);
  useEffect(() => {
    let stopped = false;
    let timer: number | null = null;
    let controller: AbortController | null = null;
    if (paused) { setStatus("paused"); return () => undefined; }
    const connect = async () => {
      if (stopped) return;
      setStatus(cursorRef.current ? "reconnecting" : "connecting");
      setError("");
      controller = new AbortController();
      try {
        const response = await browserAPI.openProjectRealtime(projectId, { events: eventFilter, cursor: cursorRef.current ?? undefined, signal: controller.signal });
        if (!response.ok) { const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null; throw new Error(payload?.error?.message ?? "The Realtime stream could not be opened."); }
        setStatus("live");
        await streamFrames(response, controller.signal, (frame) => {
          if (stopped || controller?.signal.aborted) return;
          let payload: unknown; try { payload = JSON.parse(frame.data); } catch { payload = frame.data; }
          const payloadID = payload && typeof payload === "object" && "id" in payload && typeof payload.id === "string" ? payload.id : null;
          const itemID = frame.id ?? payloadID ?? `${frame.event}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          if (frame.id ?? payloadID) cursorRef.current = frame.id ?? payloadID;
          const item = { id: itemID, event: frame.event, raw: frame.data, receivedAt: new Date().toISOString() };
          setItems((current) => [item, ...current].slice(0, maxVisibleEvents));
          if (!selectedRef.current) { selectedRef.current = item.id; setSelectedID(item.id); }
        });
      } catch (streamError) {
        if (stopped || controller?.signal.aborted) return;
        setStatus("error");
        setError(streamError instanceof Error ? streamError.message : "The Realtime stream disconnected.");
      }
      if (!stopped) { setStatus("reconnecting"); timer = window.setTimeout(() => void connect(), 1500); }
    };
    void connect();
    return () => { stopped = true; if (timer !== null) window.clearTimeout(timer); controller?.abort(); };
  }, [eventFilter, paused, projectId, restart]);

  const selected = items.find((item) => item.id === selectedID) ?? items[0] ?? null;
  function clearEvents() { setItems([]); setSelectedID(null); selectedRef.current = null; cursorRef.current = null; setCopied(false); }
  async function copySelected() { if (!selected) return; try { await navigator.clipboard.writeText(eventPreview(selected.raw)); setCopied(true); window.setTimeout(() => setCopied(false), 1500); } catch { setError("Clipboard access was unavailable. Copy the event manually."); } }

  return <section><Link to="/projects/$projectId" params={{ projectId }} className="text-sm text-[var(--projects-accent)] hover:underline">← Project overview</Link><header className="mt-5 flex flex-wrap items-end justify-between gap-5 border-b border-[var(--projects-border)] pb-6"><div><p className="m-0 text-xs uppercase tracking-[0.12em] text-[var(--projects-muted)]">Project events</p><h1 className="m-0 mt-2 flex items-center gap-2 text-3xl font-semibold tracking-[-0.04em]"><Radio size={23} className="text-[var(--projects-accent)]" aria-hidden="true" />Realtime</h1><p className="m-0 mt-2 max-w-2xl text-sm leading-6 text-[var(--projects-muted)]">Inspect permission-aware project events as they arrive. The stream reconnects from its last cursor and keeps a bounded 100-event window.</p></div><div className="flex items-center gap-2 rounded-full border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-1.5 text-xs text-[var(--projects-muted)]" role="status" aria-live="polite"><Circle size={9} fill="currentColor" className={status === "live" ? "text-emerald-400" : status === "error" ? "text-rose-400" : "text-amber-300"} aria-hidden="true" />{status}</div></header><div className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-4"><label className="min-w-[220px] flex-1 text-xs font-medium text-[var(--projects-muted)]">Event filter<select value={eventFilter} onChange={(event) => { setEventFilter(event.target.value); clearEvents(); }} className="mt-1 block h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm"><option value="*">All events</option><option value="project.create">project.create</option><option value="project.update">project.update</option><option value="database_row.create">database_row.create</option><option value="database_row.update">database_row.update</option><option value="database_row.delete">database_row.delete</option><option value="project_user.create">project_user.create</option><option value="storage_file.create">storage_file.create</option><option value="function_execution.succeeded">function_execution.succeeded</option><option value="function_execution.failed">function_execution.failed</option><option value="site_deployment.create">site_deployment.create</option></select></label><button type="button" onClick={() => setPaused((value) => !value)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--projects-border)] px-3 text-xs font-semibold">{paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}{paused ? "Resume" : "Pause"}</button><button type="button" onClick={clearEvents} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--projects-border)] px-3 text-xs font-semibold"><Trash2 size={14} aria-hidden="true" />Clear</button><button type="button" onClick={() => setRestart((value) => value + 1)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--projects-border)] px-3 text-xs font-semibold"><RefreshCw size={14} aria-hidden="true" />Reconnect</button></div>{error ? <p role="alert" className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p> : null}<div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]"><div className="overflow-hidden rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)]"><div className="flex items-center justify-between border-b border-[var(--projects-divider)] px-4 py-3"><div><h2 className="m-0 text-sm font-semibold">Event stream</h2><p className="m-0 mt-1 text-[11px] text-[var(--projects-muted)]">Showing {items.length} of {maxVisibleEvents} recent events</p></div><span className="font-mono text-[11px] text-[var(--projects-muted)]">cursor: {cursorRef.current ? `${cursorRef.current.slice(0, 8)}…` : "—"}</span></div>{items.length === 0 ? <div className="grid min-h-[360px] place-items-center px-6 py-12 text-center"><div><Radio size={30} className="mx-auto text-[var(--projects-muted)]" aria-hidden="true" /><h3 className="m-0 mt-4 text-sm font-semibold">Waiting for events</h3><p className="m-0 mt-2 max-w-sm text-xs leading-6 text-[var(--projects-muted)]">Create or update a project resource in another tab. Matching events appear here without exposing row values.</p></div></div> : <ul className="max-h-[560px] divide-y divide-[var(--projects-divider)] overflow-y-auto">{items.map((item) => <li key={item.id}><button type="button" onClick={() => { setSelectedID(item.id); selectedRef.current = item.id; }} className={`flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-[var(--projects-control)] ${selected?.id === item.id ? "bg-[color-mix(in_srgb,var(--projects-accent)_9%,transparent)]" : ""}`}><span className="min-w-0"><span className="block truncate font-mono text-xs">{item.event}</span><span className="mt-1 block truncate font-mono text-[10px] text-[var(--projects-muted)]">{item.id}</span></span><time dateTime={item.receivedAt} className="shrink-0 text-[11px] text-[var(--projects-muted)]">{formatTime(item.receivedAt)}</time></button></li>)}</ul>}</div><aside className="overflow-hidden rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)]"><div className="flex items-center justify-between border-b border-[var(--projects-divider)] px-4 py-3"><h2 className="m-0 text-sm font-semibold">Event payload</h2>{selected ? <button type="button" onClick={() => void copySelected()} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--projects-muted)] hover:text-[var(--projects-text)]">{copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}{copied ? "Copied" : "Copy JSON"}</button> : null}</div>{selected ? <div className="p-4"><p className="m-0 font-mono text-[11px] text-[var(--projects-accent)]">{selected.event}</p><pre className="mt-3 max-h-[500px] overflow-auto rounded-lg border border-[var(--projects-divider)] bg-[var(--projects-control)] p-3 font-mono text-[11px] leading-5">{eventPreview(selected.raw)}</pre></div> : <div className="grid min-h-[360px] place-items-center px-6 text-center text-xs text-[var(--projects-muted)]">Select an event to inspect its envelope.</div>}</aside></div></section>;
}
