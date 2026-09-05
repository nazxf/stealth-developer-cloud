import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BrowserAPIError, browserAPI } from "@/lib/browser-api";
import { LoginForm } from "./login-form";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("LoginForm", () => {
  it("submits trimmed credentials and completes the authenticated transition", async () => {
    const login = vi.spyOn(browserAPI, "login").mockResolvedValue(undefined);
    const onAuthenticated = vi.fn().mockResolvedValue(undefined);

    render(<LoginForm onAuthenticated={onAuthenticated} />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: " owner@example.test " } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct horse battery staple" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledOnce());
    expect(login).toHaveBeenCalledWith({ email: "owner@example.test", password: "correct horse battery staple" });
  });

  it("renders a safe API error and does not navigate after rejected credentials", async () => {
    vi.spyOn(browserAPI, "login").mockRejectedValue(new BrowserAPIError(401, "invalid_credentials", "Invalid email or password."));
    const onAuthenticated = vi.fn();

    render(<LoginForm onAuthenticated={onAuthenticated} />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "owner@example.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Invalid email or password.");
    expect(onAuthenticated).not.toHaveBeenCalled();
  });

  it("validates the email locally before making a request", async () => {
    const login = vi.spyOn(browserAPI, "login");

    render(<LoginForm onAuthenticated={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "not-an-email" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Enter a valid email address.");
    expect(login).not.toHaveBeenCalled();
  });
});
