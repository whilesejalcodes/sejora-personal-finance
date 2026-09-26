# Environment variables

This inventory is based on environment reads in current `client/` and `server/` source. `.env.example` contains placeholders only. The Node server does not load `.env` automatically; inject backend variables through the process environment or the hosting secret manager. Vite reads its public `VITE_*` values at build time.

## FRONTEND

| Variable | Used by | Required? | Secret? | Purpose / source |
|---|---|---:|---:|---|
| `VITE_FIREBASE_API_KEY` | Browser build | Yes | No; public client config | Firebase web SDK configuration. `client/src/lib/firebase.ts` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Browser build | Yes | No; public client config | Firebase Authentication domain. `client/src/lib/firebase.ts` |
| `VITE_FIREBASE_PROJECT_ID` | Browser build | Yes | No; public client config | Selects the Firebase project for browser Auth. `client/src/lib/firebase.ts` |
| `VITE_FIREBASE_STORAGE_BUCKET` | Browser build | Yes, required by current config validation | No; public client config | Firebase web-app configuration value. `client/src/lib/firebase.ts`; the application does not upload files to Firebase Storage. |
| `VITE_FIREBASE_APP_ID` | Browser build | Yes | No; public client config | Firebase web app identifier. `client/src/lib/firebase.ts` |

Vite embeds these values in the browser bundle. Do not put service-account credentials or provider keys in this group.

## BACKEND

| Variable | Used by | Required? | Secret? | Purpose / source |
|---|---|---:|---:|---|
| `PORT` | Express runtime | No | No | Listening port; defaults to `5000`. `server/src/index.ts` |
| `NODE_ENV` | Express runtime | No | No | Selects production static serving versus the non-production Vite-middleware branch. `server/src/index.ts`; `npm start` sets `production`. |

The server binds to `0.0.0.0`.

## DATABASE

There is no `DATABASE_URL` or separate database variable. Firestore uses the Firebase project configured by `FIREBASE_PROJECT_ID` and the Firebase Admin variables below. The application source uses the default Firestore database for that project.

## AUTH

| Variable | Used by | Required? | Secret? | Purpose / source |
|---|---|---:|---:|---|
| `FIREBASE_PROJECT_ID` | Backend Firebase Admin | Yes for protected API operations | No by itself | Project identifier used by `server/src/auth/firebase-admin.ts`; must refer to the same project as the browser Firebase configuration. |
| `FIREBASE_CLIENT_EMAIL` | Backend Firebase Admin | Yes for protected API operations | Yes; service-account identity | Service-account email used by `server/src/auth/firebase-admin.ts`. |
| `FIREBASE_PRIVATE_KEY` | Backend Firebase Admin | Yes for protected API operations | Yes; private credential | Service-account private key used by `server/src/auth/firebase-admin.ts`. Escaped `\n` sequences are converted by the server. |

Firebase Authentication also requires the five frontend values listed above. The Firebase project must have Email/Password sign-in enabled and the frontend hostname authorized.

## AI

| Variable | Used by | Required? | Secret? | Purpose / source |
|---|---|---:|---:|---|
| `GEMINI_API_KEY` | Backend only | Required only for Gemini-backed endpoints | Yes | Google Gemini credential read by `server/src/receipts/receipt-service.ts`, `server/src/ai-insights/ai-insights-service.ts`, and `server/src/ai-finance/ai-finance-service.ts`. |

## VECTOR DATABASE

None. No vector-database environment variables or client exist in current source.

## OTHER

None beyond `PORT` and `NODE_ENV`, which are documented under BACKEND.

## Variables intentionally excluded

- `SESSION_SECRET` was present in an older `.env.example`, but current source does not read it. It has been removed from the updated template.
- `VITE_FIREBASE_MESSAGING_SENDER_ID` appears in older architecture documentation but is not read by current client code or required by its configuration validator.
- No `REPLIT_*` environment variable is read by application source.