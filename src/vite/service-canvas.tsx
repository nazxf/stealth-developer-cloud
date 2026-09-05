import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { GripVertical, Save, Server } from "lucide-react";
import type { BrowserProjectServiceLayout } from "@/lib/browser-api";
import { ServiceDetailPanel } from "./service-detail-panel";
import { ServiceNode } from "./service-node";

export type ServiceCanvasService = {
  id: string;
  kind: "function" | "site" | "database" | "storage";
  name: string;
  status: string;
  detail: string;
  resource: "functions" | "sites" | "databases" | "storage";
};

export type ServiceCanvasPosition = { x: number; y: number };

type SaveState = "idle" | "saving" | "saved" | "error";

const NODE_WIDTH = 224;
const NODE_HEIGHT = 132;
const GRID_GAP_X = 256;
const GRID_GAP_Y = 168;

export function serviceCanvasKey(kind: ServiceCanvasService["kind"], id: string) {
  return `${kind}:${id}`;
}

export function defaultServiceCanvasPosition(index: number): ServiceCanvasPosition {
  return {
    x: 28 + (index % 3) * GRID_GAP_X,
    y: 28 + Math.floor(index / 3) * GRID_GAP_Y,
  };
}

export function buildServiceCanvasPositions(
  services: ServiceCanvasService[],
  savedLayout: BrowserProjectServiceLayout[],
): Record<string, ServiceCanvasPosition> {
  const saved = new Map(savedLayout.map((item) => [serviceCanvasKey(item.resource_type, item.resource_id), { x: item.x, y: item.y }]));
  return Object.fromEntries(
    services.map((service, index) => [
      serviceCanvasKey(service.kind, service.id),
      saved.get(serviceCanvasKey(service.kind, service.id)) ?? defaultServiceCanvasPosition(index),
    ]),
  );
}

export function serviceCanvasLayout(
  services: ServiceCanvasService[],
  positions: Record<string, ServiceCanvasPosition>,
) {
  return services.map((service) => {
    const position = positions[serviceCanvasKey(service.kind, service.id)] ?? { x: 0, y: 0 };
    return { resource_type: service.kind, resource_id: service.id, x: Math.round(position.x), y: Math.round(position.y) };
  });
}

function sameServiceCanvasPositions(left: Record<string, ServiceCanvasPosition>, right: Record<string, ServiceCanvasPosition>) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => left[key]?.x === right[key]?.x && left[key]?.y === right[key]?.y);
}

export function ServiceCanvas({
  projectId,
  services,
  savedLayout,
  canManage,
  onSave,
}: {
  projectId: string;
  services: ServiceCanvasService[];
  savedLayout: BrowserProjectServiceLayout[];
  canManage: boolean;
  onSave: (layout: ReturnType<typeof serviceCanvasLayout>) => Promise<unknown>;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ key: string; pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const dirtyRef = useRef(false);
  const changeGenerationRef = useRef(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [positions, setPositions] = useState<Record<string, ServiceCanvasPosition>>(() => buildServiceCanvasPositions(services, savedLayout));
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const servicesSignature = services.map((service) => serviceCanvasKey(service.kind, service.id)).join("|");
  const savedLayoutSignature = savedLayout.map((item) => `${serviceCanvasKey(item.resource_type, item.resource_id)}:${item.x}:${item.y}`).join("|");
  const serviceKeys = useMemo(() => new Set(services.map((service) => serviceCanvasKey(service.kind, service.id))), [servicesSignature]);

  useEffect(() => {
    if (dirtyRef.current) return;
    const nextPositions = buildServiceCanvasPositions(services, savedLayout);
    setPositions((current) => (sameServiceCanvasPositions(current, nextPositions) ? current : nextPositions));
    setSelectedKey((current) => (current && serviceKeys.has(current) ? current : services[0] ? serviceCanvasKey(services[0].kind, services[0].id) : null));
  }, [savedLayoutSignature, serviceKeys, servicesSignature]);

  useEffect(() => {
    if (!dirtyRef.current || !canManage) return;
    const generation = changeGenerationRef.current;
    const timeout = window.setTimeout(async () => {
      setSaveState("saving");
      try {
        await onSave(serviceCanvasLayout(services, positions));
        // A second drag can happen while the first request is in flight. Only
        // the request for the latest generation may clear the dirty flag;
        // otherwise its response would make the newer layout look persisted.
        if (changeGenerationRef.current !== generation) {
          setSaveState("idle");
          return;
        }
        dirtyRef.current = false;
        setSaveState("saved");
      } catch {
        if (changeGenerationRef.current === generation) setSaveState("error");
      }
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [canManage, onSave, positions, servicesSignature]);

  const moveService = (key: string, x: number, y: number) => {
    setPositions((current) => ({ ...current, [key]: { x, y } }));
    changeGenerationRef.current += 1;
    dirtyRef.current = true;
    setSaveState("idle");
  };

  const clampPosition = (x: number, y: number) => {
    const canvas = canvasRef.current;
    const maxX = Math.max(16, (canvas?.scrollWidth ?? NODE_WIDTH + 32) - NODE_WIDTH - 16);
    const maxY = Math.max(16, (canvas?.scrollHeight ?? NODE_HEIGHT + 32) - NODE_HEIGHT - 16);
    return { x: Math.max(16, Math.min(maxX, Math.round(x))), y: Math.max(16, Math.min(maxY, Math.round(y))) };
  };

  const handlePointerDown = (event: PointerEvent<HTMLElement>, service: ServiceCanvasService) => {
    const key = serviceCanvasKey(service.kind, service.id);
    setSelectedKey(key);
    if (!canManage) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const position = positions[key] ?? { x: 16, y: 16 };
    dragRef.current = { key, pointerId: event.pointerId, offsetX: event.clientX - rect.left - position.x, offsetY: event.clientY - rect.top - position.y };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const next = clampPosition(event.clientX - rect.left - drag.offsetX, event.clientY - rect.top - drag.offsetY);
    moveService(drag.key, next.x, next.y);
  };

  const stopDragging = (event: PointerEvent<HTMLElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>, service: ServiceCanvasService) => {
    if (!canManage) return;
    const step = event.shiftKey ? 32 : 8;
    const delta = event.key === "ArrowLeft" ? { x: -step, y: 0 } : event.key === "ArrowRight" ? { x: step, y: 0 } : event.key === "ArrowUp" ? { x: 0, y: -step } : event.key === "ArrowDown" ? { x: 0, y: step } : null;
    if (!delta) return;
    event.preventDefault();
    const key = serviceCanvasKey(service.kind, service.id);
    const current = positions[key] ?? { x: 16, y: 16 };
    const next = clampPosition(current.x + delta.x, current.y + delta.y);
    moveService(key, next.x, next.y);
  };

  const selectedService = services.find((service) => serviceCanvasKey(service.kind, service.id) === selectedKey);
  const selectedPosition = selectedKey ? positions[selectedKey] : undefined;
  const saveLabel = saveState === "saving" ? "Saving layout…" : saveState === "saved" ? "Layout saved" : saveState === "error" ? "Save failed — move to retry" : canManage ? "Drag to arrange" : "Read-only layout";

  return (
    <div className="mt-6 rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Server size={17} className="text-[var(--projects-accent)]" aria-hidden="true" />
            <h2 className="m-0 text-lg font-semibold">Service canvas</h2>
          </div>
          <p className="m-0 mt-1 text-sm text-[var(--projects-muted)]">Arrange your deployable and managed resources into a durable workspace map.</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${saveState === "error" ? "border-[var(--projects-danger)]/50 text-[var(--projects-danger)]" : "border-[var(--projects-border)] text-[var(--projects-muted)]"}`} role={saveState === "error" ? "status" : undefined}>
          {saveState === "saving" ? <Save size={12} className="animate-pulse" aria-hidden="true" /> : <GripVertical size={12} aria-hidden="true" />}
          {saveLabel}
        </span>
      </div>

      <div ref={canvasRef} className="mt-4 min-h-[34rem] overflow-auto rounded-lg border border-[var(--projects-border)] bg-[var(--projects-bg)]" onPointerMove={handlePointerMove} onPointerUp={stopDragging} onPointerCancel={stopDragging}>
        <div className="relative min-h-[34rem] min-w-[52rem]" style={{ backgroundImage: "linear-gradient(to right, color-mix(in srgb, var(--projects-border) 42%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--projects-border) 42%, transparent) 1px, transparent 1px)", backgroundSize: "24px 24px" }}>
          {services.map((service) => {
            const key = serviceCanvasKey(service.kind, service.id);
            const position = positions[key] ?? { x: 16, y: 16 };
            const selected = key === selectedKey;
            return (
              <ServiceNode
                key={key}
                service={service}
                position={position}
                selected={selected}
                canManage={canManage}
                onPointerDown={(event) => handlePointerDown(event, service)}
                onKeyDown={(event) => handleKeyDown(event, service)}
                onSelect={() => setSelectedKey(key)}
              />
            );
          })}
          {services.length === 0 ? <div className="grid min-h-[34rem] place-items-center text-center"><div><Server size={25} className="mx-auto text-[var(--projects-muted)]" aria-hidden="true" /><p className="m-0 mt-3 text-sm font-semibold">The canvas is ready</p><p className="m-0 mt-1 text-xs text-[var(--projects-muted)]">Create a resource to place it on this project map.</p></div></div> : null}
        </div>
      </div>

      {selectedService ? <ServiceDetailPanel projectId={projectId} service={selectedService} position={selectedPosition} /> : null}
    </div>
  );
}
