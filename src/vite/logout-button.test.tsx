import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BrowserAPIError, browserAPI } from "@/lib/browser-api";
import { LogoutButton } from "./logout-button";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("LogoutButton", () => {
  it("clears the session before invoking the route transition", async () => {
    const logout = vi.spyOn(browserAPI, "logout").mockResolvedValue(undefined);
    const onLoggedOut = vi.fn().mockResolvedValue(undefined);

    render(<LogoutButton onLoggedOut={onLoggedOut} />);
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    await waitFor(() => expect(onLoggedOut).toHaveBeenCalledOnce());
    expect(logout).toHaveBeenCalledOnce();
  });

  it("shows a safe error and does not navigate when logout is rejected", async () => {
    vi.spyOn(browserAPI, "logout").mockRejectedValue(new BrowserAPIError(503, "unavailable", "Session service unavailable."));
    const onLoggedOut = vi.fn();

    render(<LogoutButton onLoggedOut={onLoggedOut} />);
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Session service unavailable.");
    expect(onLoggedOut).not.toHaveBeenCalled();
  });
});
