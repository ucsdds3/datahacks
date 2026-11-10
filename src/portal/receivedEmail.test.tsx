import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";

// The browser's side of the "We've received your application" email: the
// portal asks again on load while the database says it hasn't gone out.

const fake = vi.hoisted(() => ({
  row: { data: { status: "submitted", received_emailed_at: null } as unknown, error: null as unknown },
  reads: [] as string[],
  invoke: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: (table: string) => {
      const chain = {
        select: (columns: string) => { fake.reads.push(`${table}: ${columns}`); return chain; },
        eq: () => chain,
        maybeSingle: async () => fake.row,
      };
      return chain;
    },
    functions: { invoke: (...args: unknown[]) => fake.invoke(...args) },
  },
}));

import { forgetReceivedEmailRequests, requestReceivedEmail, useReceivedEmailCheck } from "./receivedEmail";

function Check(props: Parameters<typeof useReceivedEmailCheck>[0]) {
  useReceivedEmailCheck(props);
  return null;
}
const portal = { applicationId: "app-1", userId: "u1", underReview: true, preview: false };

beforeEach(() => {
  forgetReceivedEmailRequests();
  fake.row = { data: { status: "submitted", received_emailed_at: null }, error: null };
  fake.reads = [];
  fake.invoke.mockReset();
  fake.invoke.mockResolvedValue({ data: { sent: 1 }, error: null });
});

describe("requestReceivedEmail", () => {
  it("asks the function with an empty body: the server decides who and what", async () => {
    expect(await requestReceivedEmail("u1")).toBe(true);
    expect(fake.invoke).toHaveBeenCalledWith("send-received-email", { body: {} });
  });

  it("asks once per account per page load (the form, then the portal's check)", async () => {
    await Promise.all([requestReceivedEmail("u1"), requestReceivedEmail("u1")]);
    await requestReceivedEmail("u1");
    expect(fake.invoke).toHaveBeenCalledTimes(1);
  });

  it("never throws, and a failed request can be retried", async () => {
    fake.invoke.mockResolvedValueOnce({ data: null, error: { name: "FunctionsHttpError", message: "404" } });
    expect(await requestReceivedEmail("u1")).toBe(false);
    fake.invoke.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await requestReceivedEmail("u1")).toBe(false);
    expect(await requestReceivedEmail("u1")).toBe(true);
    expect(fake.invoke).toHaveBeenCalledTimes(3);
  });
});

describe("the portal's check", () => {
  it("asks for it when the application is under review and hasn't had it", async () => {
    render(<Check {...portal} />);
    await waitFor(() => expect(fake.invoke).toHaveBeenCalledWith("send-received-email", { body: {} }));
    expect(fake.reads).toEqual(["applications: status, received_emailed_at"]);
  });

  it("doesn't once it's gone out", async () => {
    fake.row = { data: { status: "submitted", received_emailed_at: "2026-11-10T18:00:05Z" }, error: null };
    render(<Check {...portal} />);
    await waitFor(() => expect(fake.reads).toHaveLength(1));
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(fake.invoke).not.toHaveBeenCalled();
  });

  it("stays quiet when the column can't be read (before the database change is deployed)", async () => {
    fake.row = { data: null, error: { code: "42703", message: "column applications.received_emailed_at does not exist" } };
    render(<Check {...portal} />);
    await waitFor(() => expect(fake.reads).toHaveLength(1));
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(fake.invoke).not.toHaveBeenCalled();
  });

  it("doesn't look at all for decided applications, previews, or without an id", async () => {
    render(<Check {...portal} underReview={false} />);
    render(<Check {...portal} preview />);
    render(<Check {...portal} applicationId={undefined} />);
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(fake.reads).toEqual([]);
    expect(fake.invoke).not.toHaveBeenCalled();
  });

  it("a decision released in the meantime: doesn't ask", async () => {
    fake.row = { data: { status: "accepted", received_emailed_at: null }, error: null };
    render(<Check {...portal} />);
    await waitFor(() => expect(fake.reads).toHaveLength(1));
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(fake.invoke).not.toHaveBeenCalled();
  });
});
