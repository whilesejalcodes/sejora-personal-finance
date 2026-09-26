import type { NextFunction, Request, RequestHandler, Response } from "express";
import { getFirebaseAdminAuth, FirebaseAdminConfigurationError } from "./firebase-admin.js";

export type VerifiedAuthContext = {
  uid: string;
  email: string | null;
  emailVerified: boolean;
};

export type VerifyIdToken = (token: string) => Promise<VerifiedAuthContext>;

declare global {
  namespace Express {
    interface Request {
      auth?: VerifiedAuthContext;
    }
  }
}

export async function verifyFirebaseIdToken(token: string): Promise<VerifiedAuthContext> {
  const decodedToken = await getFirebaseAdminAuth().verifyIdToken(token);
  return {
    uid: decodedToken.uid,
    email: decodedToken.email ?? null,
    emailVerified: decodedToken.email_verified ?? false,
  };
}

function getAuthorizationHeader(request: Request): string | undefined {
  const header = request.get("authorization") ?? request.headers.authorization;
  return Array.isArray(header) ? header[0] : header;
}

export function createRequireAuth(verifyToken: VerifyIdToken = verifyFirebaseIdToken): RequestHandler {
  return async (request: Request, response: Response, next: NextFunction) => {
    const authorization = getAuthorizationHeader(request);
    if (!authorization) {
      response.status(401).json({
        error: {
          code: "AUTHENTICATION_REQUIRED",
          message: "Authentication is required.",
        },
      });
      return;
    }

    const [scheme, token, ...extra] = authorization.trim().split(/\s+/);
    if (scheme?.toLowerCase() !== "bearer" || !token || extra.length > 0) {
      response.status(401).json({
        error: {
          code: "AUTHENTICATION_REQUIRED",
          message: "A valid Bearer token is required.",
        },
      });
      return;
    }

    try {
      request.auth = await verifyToken(token);
      if (!request.auth.emailVerified) {
        response.status(403).json({
          error: {
            code: "EMAIL_VERIFICATION_REQUIRED",
            message: "Verify your email before accessing this application.",
          },
        });
        return;
      }
      next();
    } catch (error) {
      const configurationError = error instanceof FirebaseAdminConfigurationError;
      if (!configurationError) {
        console.warn("Firebase ID token verification failed.");
      }
      response.status(configurationError ? 503 : 401).json({
        error: {
          code: configurationError ? "AUTHENTICATION_UNAVAILABLE" : "AUTHENTICATION_REQUIRED",
          message: configurationError
            ? "Server authentication is not configured."
            : "Authentication could not be verified.",
        },
      });
    }
  };
}

export const requireAuth = createRequireAuth();