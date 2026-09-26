# Backend deployment

## Build and runtime

Backend source is in `server/`, with shared TypeScript contracts/calculations in `shared/`. The package manifest and TypeScript configuration are at the repository root; there is no backend-only package or build script.

Use Node.js 24 to match the runtime selected by `.replit`. `package.json` does not declare an `engines` range. The lockfile uses public npm registry URLs and there is no project `.npmrc` override.

From the repository root:

```sh
npm install
npm run build
npm start
```

- `npm run build` typechecks client and server, builds the client into `dist/client/`, and compiles server/shared TypeScript into `dist/server/`.
- `npm start` is the production command. Its Node launcher sets `NODE_ENV=production` before importing the compiled server, using a command that also works in Windows shells.
- `npm run dev` currently runs the build and then `npm start`; it is not a hot-reload server.

The Express server reads `PORT` and defaults to `5000`. It binds to `0.0.0.0`. A hosting platform should provide its runtime port through `PORT` and allow public HTTPS traffic through its proxy/load balancer.

## Backend environment

Required for authenticated private API operations:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

`server/src/auth/firebase-admin.ts` initializes Firebase Admin and converts escaped `\n` sequences in `FIREBASE_PRIVATE_KEY` to newlines. Supply these values through a backend-only secret manager.

`GEMINI_API_KEY` is required only for the routes that call Gemini: receipt scan, AI Insights generation, and AI Finance intent extraction. Missing or failing provider configuration is surfaced as a safe provider error; it is not silently replaced with generated local answers.

The backend does not read `VITE_FIREBASE_*` variables. It does not read a SQL `DATABASE_URL`, `SESSION_SECRET`, or vector database credentials.

## Health, persistence, and browser routing

- `GET /api/health` is public and returns a static liveness response. It does not verify Firebase Admin credentials, Firestore connectivity, or Gemini availability.
- Use a verified Firebase ID token with `GET /api/auth/me` to verify token validation.
- Use a Firestore-backed route such as `GET /api/transactions?pageSize=1` with a test account to verify Firestore access.
- The backend uses Firebase Admin and Firestore; see [Database](DATABASE.md).
- There is no backend CORS middleware. Same-origin deployment or a reverse proxy is required for browser requests.
- In production the server serves the SPA from `dist/client/`. If the backend is deployed only as an API behind a separate frontend, forward only `/api/*` to it; send page routes to the frontend host.

## Uploads and scaling

`POST /api/receipts/scan` processes JPEG, PNG, and WebP files in memory, with a 5 MiB upload limit and image validation. It does not write image files to disk or Firebase Storage.

Receipt, AI Insights, and AI Finance request guards are in-memory and per process. They are not distributed across multiple backend instances. Add infrastructure-level rate limiting if the chosen production topology needs shared limits; do not assume the current guards coordinate replicas.