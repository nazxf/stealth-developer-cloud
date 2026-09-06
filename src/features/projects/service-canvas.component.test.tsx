import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>,
}));

import { ServiceCanvas, type ServiceCanvasService } from "./service-canvas";

const services: ServiceCanvasService[] = [
  { id: "fn-1", kind: "function", name: "worker", status: "active", detail: "node-22", resource: "functions" },
];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("ServiceCanvas autosave", () => {
  it("keeps a newer drag dirty while an older save is in flight", async () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(1200);
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(800);
    const firstSave = deferred<unknown>();
    const secondSave = deferred<unknown>();
    const onSave = vi.fn()
      .mockImplementationOnce(() => firstSave.promise)
      .mockImplementationOnce(() => secondSave.promise);

    render(<ServiceCanvas projectId="project-1" services={services} savedLayout={[]} canManage onSave={onSave} />);
    const node = screen.getByRole("button", { name: "Function worker" });

    fireEvent.keyDown(node, { key: "ArrowRight" });
    await vi.advanceTimersByTimeAsync(650);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toEqual([{ resource_type: "function", resource_id: "fn-1", x: 36, y: 28 }]);

    fireEvent.keyDown(node, { key: "ArrowRight" });
    firstSave.resolve(undefined);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(650);

    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSave.mock.calls[1]?.[0]).toEqual([{ resource_type: "function", resource_id: "fn-1", x: 44, y: 28 }]);
    secondSave.resolve(undefined);
  });
});
