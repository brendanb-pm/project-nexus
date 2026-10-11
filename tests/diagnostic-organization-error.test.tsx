import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ErrorPage from "@/app/admin/organization/error";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("preserves the displayed message and retry without logging the exception", () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
  const reset = vi.fn();
  render(
    <ErrorPage
      error={new Error("NX79_CANARY_ERROR_MESSAGE_FIXTURE_20261006")}
      reset={reset}
    />,
  );
  expect(screen.getByText("Unable to load administration")).toBeVisible();
  expect(
    screen.getByText(
      "The request could not be completed. Your changes were not confirmed.",
    ),
  ).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(reset).toHaveBeenCalledOnce();
  expect(log).not.toHaveBeenCalled();
  expect(info).not.toHaveBeenCalled();
});
