import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteTransaction, getHealth } from "../../client/src/lib/api-client";

vi.mock("@/lib/firebase", () => ({
  getFirebaseAuth: () => ({
    currentUser: {
      getIdToken: vi.fn().mockResolvedValue("test-token"),
    },
  }),
  isFirebaseClientConfigured: () => true,
}));

describe("API client empty response handling", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("resolves DELETE 204 responses without attempting JSON parsing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(deleteTransaction("transaction-123")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith("/api/transactions/transaction-123", expect.objectContaining({
      method: "DELETE",
      headers: expect.any(Headers),
    }));
  });

  it("resolves another successful empty-body response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 202 })));

    await expect(getHealth()).resolves.toBeUndefined();
  });

  it("preserves structured API errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: "RESOURCE_NOT_FOUND", message: "Transaction not found." },
    }), { status: 404, headers: { "Content-Type": "application/json" } })));

    await expect(getHealth()).rejects.toMatchObject({
      name: "ApiError",
      message: "Transaction not found.",
      code: "RESOURCE_NOT_FOUND",
    });
  });

  it("normalizes network failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("socket detail")));
    await expect(getHealth()).rejects.toMatchObject({
      name: "ApiError",
      code: "NETWORK_ERROR",
      message: "The network request could not be completed. Check your connection and try again.",
    });
  });
});