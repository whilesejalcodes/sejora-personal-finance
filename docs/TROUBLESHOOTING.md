# Troubleshooting

## Frontend cannot reach the API

- The browser uses root-relative `/api/...` requests; there is no `VITE_API_URL`.
- Serve the UI and API on one origin, or configure a same-origin `/api/*` reverse proxy.
- The backend has no CORS middleware. A browser request from another origin will fail preflight/response checks; adding cross-origin support requires an API base URL and explicit CORS configuration.

## Direct SPA route returns 404

The client uses React Router `BrowserRouter`. A static host must rewrite non-asset, non-API routes such as `/dashboard` and `/verify-email` to `index.html`. Do not rewrite `/api/*` to the SPA. The current production Express server already provides this fallback.

## Authentication returns 401, 403, or 503

- `401 AUTHENTICATION_REQUIRED`: ensure the browser is signed in and sends `Authorization: Bearer <Firebase ID token>`.
- `403 EMAIL_VERIFICATION_REQUIRED`: complete email verification before using private APIs.
- `503 AUTHENTICATION_UNAVAILABLE`: check server-only Firebase Admin environment variables and Firebase Admin initialization.
- Firebase login/verification issues: check that Email/Password is enabled and the frontend hostname is listed in Firebase Authorized domains.
- A newly verified account may have a stale ID token if verification claims are not refreshed. Current `refreshUser()` reloads Firebase and forces `getIdToken(true)` after verification. If the issue persists, inspect `/api/auth/me` and try signing out/in; the real fresh-account production flow has not been independently end-to-end verified.

The backend intentionally rejects unverified users. Do not resolve authentication issues by disabling token or email-verification checks.

## Firestore is unavailable

- Check the server's `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`, and confirm they refer to the intended project.
- Confirm that the Firestore database has been provisioned and the Admin service account can access it.
- `GET /api/health` is liveness-only; use a verified, Firestore-backed read such as `/api/transactions?pageSize=1` for connectivity testing.
- Admin SDK requests bypass Firestore Rules. Keep server token verification and UID-scoped repository paths in place.

## Gemini-backed endpoint returns 503 or 502

- Check `GEMINI_API_KEY` in the backend runtime environment. It is never a frontend variable.
- A provider error (503) indicates missing credentials, provider/network failure, or timeout. An extraction-invalid error (502) indicates malformed or invalid structured provider output.
- Core deterministic transactions, budgets, goals, and analytics do not require Gemini.

## Receipt scanning fails

Use one JPEG, PNG, or WebP image under 5 MiB in the multipart field named `receipt`. The server validates the file signature and dimensions. Upload bytes are processed in memory only; the endpoint does not create a transaction or save an image.

## Environment variable appears to be ignored

- Vite `VITE_*` values are read at frontend build time. Rebuild after changing them.
- The Node server does not load `.env` automatically. Export backend variables in the process environment or configure them in the host's secret manager.
- `FIREBASE_PRIVATE_KEY` must include the complete key with escaped `\n` sequences when supplied as one environment value.
- `SESSION_SECRET` is not used by current source and should not be configured for this app.

## Build or install fails outside Replit

- Use Node.js 24 to match `.replit`.
- The checked-in lockfile uses public npm registry URLs. If installation fails, check network access to `registry.npmjs.org` and confirm no machine-level npm setting is redirecting the request.
- Run `npm run typecheck`, `npm test`, and `npm run build` from the repository root.

## Wrong port or unreachable service

The Express server listens on `PORT` or defaults to `5000` and binds to `0.0.0.0`. Ensure the host routes its HTTPS traffic to that runtime port. `npm start` serves production assets; it does not start a separate frontend server.

## Rate limits or unexpected 429s

Receipt, AI Insights, and AI Finance use simple in-memory per-process request/concurrency guards. They do not coordinate across replicas and reset when a process restarts. Account for this when operating multiple server instances.