import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// The Email page's card for "We've received your application" emails still waiting.

const fake = vi.hoisted(() => ({
  due: 2 as number | null,
  invoke: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        is: async () => (fake.due === null ? { count: null, error: { code: "42703", message: "no column" } } : { count: fake.due, error: null }),
      };
      return chain;
    },
    functions: { invoke: (...args: unknown[]) => fake.invoke(...args) },
    rpc: async () => ({ data: null, error: null }),
  },
}));

import ReceivedEmailsCard from "./ReceivedEmailsCard";

const renderCard = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ReceivedEmailsCard eventId="event-1" />
    </QueryClientProvider>,
  );

beforeEach(() => {
  fake.due = 2;
  fake.invoke.mockReset();
});

describe("ReceivedEmailsCard", () => {
  it("says how many are waiting and sends them", async () => {
    fake.invoke.mockImplementation(async () => {
      fake.due = 0;
      return { data: { sent: 2, failed: [], stopped: null, stillDue: 0 }, error: null };
    });
    renderCard();
    expect(await screen.findByText(/2 submitted applications haven't/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Send them now" }));
    expect(await screen.findByText("Sent 2 emails.")).toBeInTheDocument();
    expect(fake.invoke).toHaveBeenCalledWith("send-received-email", { body: { eventId: "event-1" } });
    await waitFor(() => expect(screen.queryByRole("button", { name: /Send/ })).toBeNull());
  });

  it("shows nothing when none are waiting, or they can't be counted", async () => {
    fake.due = 0;
    const { container, unmount } = renderCard();
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(container).toBeEmptyDOMElement();
    unmount();
    fake.due = null;
    const second = renderCard();
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(second.container).toBeEmptyDOMElement();
  });

  it("says when Gmail's daily limit stopped it", async () => {
    fake.due = 1;
    fake.invoke.mockResolvedValue({ data: { sent: 0, failed: [], stopped: "daily_limit", stillDue: 1 }, error: null });
    renderCard();
    fireEvent.click(await screen.findByRole("button", { name: "Send it now" }));
    expect(await screen.findByText(/daily limit is reached/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Send it now" })).not.toBeDisabled());
  });
});
