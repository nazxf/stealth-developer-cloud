import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BrowserAPIError, browserAPI } from "@/lib/browser-api";
import { PasswordRecoveryForm, ResetPasswordForm, SignupForm } from "./auth-forms";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("auth forms", () => {
  it("validates and submits normalized signup data", async () => {
    const register = vi.spyOn(browserAPI, "register").mockResolvedValue({
      account: { id: "account-1", email: "owner@example.test", email_verified: false, created_at: "2026-09-05T00:00:00Z" },
      organization: { id: "organization-1", name: "Acme", slug: "acme", created_at: "2026-09-05T00:00:00Z" },
    });
    const onAuthenticated = vi.fn().mockResolvedValue(undefined);

    render(<SignupForm onAuthenticated={onAuthenticated} />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: " owner@example.test " } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct horse battery staple" } });
    fireEvent.change(screen.getByLabelText(/Organization name/), { target: { value: " Acme " } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledOnce());
    expect(register).toHaveBeenCalledWith({ email: "owner@example.test", password: "correct horse battery staple", organization_name: "Acme" });
  });

  it("rejects an invalid signup locally", async () => {
    const register = vi.spyOn(browserAPI, "register");
    render(<SignupForm onAuthenticated={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "not-an-email" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Enter a valid email address.");
    expect(register).not.toHaveBeenCalled();
  });

  it("requests recovery with the configured reset URL and shows the safe response", async () => {
    const recovery = vi.spyOn(browserAPI, "requestPasswordRecovery").mockResolvedValue({ status: "accepted" });
    render(<PasswordRecoveryForm resetURL="https://console.example.test/reset-password" />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: " owner@example.test " } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await screen.findByRole("status");
    expect(recovery).toHaveBeenCalledWith({ email: "owner@example.test", url: "https://console.example.test/reset-password" });
  });

  it("renders a safe recovery API error", async () => {
    vi.spyOn(browserAPI, "requestPasswordRecovery").mockRejectedValue(new BrowserAPIError(503, "unavailable", "Recovery service unavailable."));
    render(<PasswordRecoveryForm resetURL="https://console.example.test/reset-password" />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "owner@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Recovery service unavailable.");
  });

  it("requires a reset token and validates the replacement password", async () => {
    const reset = vi.spyOn(browserAPI, "resetPassword");
    render(<ResetPasswordForm token="" onReset={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: "Save password" }));

    expect((await screen.findByRole("alert")).textContent).toBe("This reset link is missing its token.");
    expect(reset).not.toHaveBeenCalled();
  });

  it("resets the password and completes the route transition", async () => {
    const reset = vi.spyOn(browserAPI, "resetPassword").mockResolvedValue({ account: { id: "account-1", email: "owner@example.test", email_verified: true, created_at: "2026-09-05T00:00:00Z" } });
    const onReset = vi.fn().mockResolvedValue(undefined);
    render(<ResetPasswordForm token="one-time-token" onReset={onReset} />);
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "correct horse battery staple" } });
    fireEvent.click(screen.getByRole("button", { name: "Save password" }));

    await waitFor(() => expect(onReset).toHaveBeenCalledOnce());
    expect(reset).toHaveBeenCalledWith({ token: "one-time-token", password: "correct horse battery staple" });
  });
});
