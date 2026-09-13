import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { signIn, signOut } = vi.hoisted(() => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@/auth/client", () => ({
  authClient: { signIn: { social: signIn }, signOut },
}));

import { SignOutButton } from "@/components/auth/sign-out-button";
import { SignInButton } from "@/components/auth/sign-in-button";

afterEach(() => {
  cleanup();
  signOut.mockReset();
  signIn.mockReset();
});

describe("production sign-in control", () => {
  it("returns authenticated users through the server-authorized landing", async () => {
    signIn.mockResolvedValue({ data: {}, error: null });
    render(<SignInButton />);
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith({
        provider: "nexus-oidc",
        callbackURL: "/session/continue",
      }),
    );
  });
});

describe("production sign-out control", () => {
  it("requests server-side session invalidation and a safe callback", async () => {
    signOut.mockResolvedValue({ data: {}, error: null });
    render(<SignOutButton />);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() =>
      expect(signOut).toHaveBeenCalledWith({ callbackURL: "/sign-in" }),
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows a recoverable error instead of a false successful state", async () => {
    signOut.mockRejectedValue(new Error("network failure"));
    render(<SignOutButton />);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sign-out could not be completed. Please try again.",
    );
    expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled();
  });
});
