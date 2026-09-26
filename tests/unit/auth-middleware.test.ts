import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { createRequireAuth, type VerifiedAuthContext } from "../../server/src/auth/middleware";

function makeRequest(authorization?: string): Request {
  return {
    headers: authorization ? { authorization } : {},
    get: (name: string) => name.toLowerCase() === "authorization" ? authorization : undefined,
  } as unknown as Request;
}

function makeResponse() {
  const response = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return response as unknown as Response & typeof response;
}

describe("requireAuth middleware", () => {
  it("rejects requests without an Authorization header", async () => {
    const verifyToken = vi.fn();
    const response = makeResponse();
    const next = vi.fn() as unknown as NextFunction;

    await createRequireAuth(verifyToken)(makeRequest(), response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: "AUTHENTICATION_REQUIRED",
        message: "Authentication is required.",
      },
    });
    expect(verifyToken).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects malformed Authorization headers", async () => {
    const verifyToken = vi.fn();
    const response = makeResponse();
    const next = vi.fn() as unknown as NextFunction;

    await createRequireAuth(verifyToken)(makeRequest("Basic token-value"), response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: "AUTHENTICATION_REQUIRED",
        message: "A valid Bearer token is required.",
      },
    });
    expect(verifyToken).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects an invalid token without exposing Firebase details", async () => {
    const verifyToken = vi.fn().mockRejectedValue(new Error("Firebase internal token detail"));
    const response = makeResponse();
    const next = vi.fn() as unknown as NextFunction;

    await createRequireAuth(verifyToken)(makeRequest("Bearer invalid-token"), response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: "AUTHENTICATION_REQUIRED",
        message: "Authentication could not be verified.",
      },
    });
    expect(response.json).not.toHaveBeenCalledWith(expect.stringContaining("Firebase internal"));
    expect(next).not.toHaveBeenCalled();
  });

  it("attaches verified identity and accepts a valid token", async () => {
    const verifiedUser: VerifiedAuthContext = {
      uid: "firebase-user-123",
      email: "user@example.com",
      emailVerified: true,
    };
    const verifyToken = vi.fn().mockResolvedValue(verifiedUser);
    const response = makeResponse();
    const next = vi.fn() as unknown as NextFunction;
    const request = makeRequest("Bearer valid-token");

    await createRequireAuth(verifyToken)(request, response, next);

    expect(verifyToken).toHaveBeenCalledWith("valid-token");
    expect(request.auth).toEqual(verifiedUser);
    expect(next).toHaveBeenCalledOnce();
    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).not.toHaveBeenCalled();
  });

  it("rejects a valid but unverified Firebase identity", async () => {
    const verifyToken = vi.fn().mockResolvedValue({
      uid: "firebase-user-123",
      email: "user@example.com",
      emailVerified: false,
    } satisfies VerifiedAuthContext);
    const response = makeResponse();
    const next = vi.fn() as unknown as NextFunction;

    await createRequireAuth(verifyToken)(makeRequest("Bearer valid-token"), response, next);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: "EMAIL_VERIFICATION_REQUIRED",
        message: "Verify your email before accessing this application.",
      },
    });
    expect(next).not.toHaveBeenCalled();
  });
});