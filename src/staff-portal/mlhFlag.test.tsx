import { describe, expect, it, vi } from "vitest";
import { render, renderHook, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// The one-line switch: MLH_ENABLED = true in config.ts turns MLH's checkboxes on
// without asking the database. MLH_APPLICATION_PENDING adds MLH's "we have applied" note.
const asked = vi.hoisted(() => ({ events: 0 }));
vi.mock("./config", async importOriginal => ({ ...(await importOriginal<object>()), MLH_ENABLED: true, MLH_APPLICATION_PENDING: true }));
vi.mock("@/lib/supabaseClient", () => ({
  supabase: { from: () => { asked.events++; throw new Error("shouldn't read the database"); } },
}));

import { MLH_TEXT, MlhCheckboxes, NO_MLH, useMlhOn } from "./mlh";

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe("MLH_ENABLED", () => {
  it("turns MLH on by itself", () => {
    const { result } = renderHook(() => useMlhOn(), {
      wrapper: ({ children }) => <QueryClientProvider client={client()}>{children}</QueryClientProvider>,
    });
    expect(result.current).toBe(true);
    expect(asked.events).toBe(0);
  });

  it("MLH_APPLICATION_PENDING shows MLH's note above the boxes", () => {
    render(<MlhCheckboxes idPrefix="t" value={NO_MLH} onChange={() => {}} />);
    expect(screen.getByText(MLH_TEXT.pending)).toBeTruthy();
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
  });
});
