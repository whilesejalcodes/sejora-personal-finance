# Local development

## Prerequisites

- Node.js 24 is the runtime selected by `.replit`; `package.json` has no `engines` field. Use Node 24 for closest parity with the current environment.
- npm and a checkout of this repository.
- Access to a Firebase project configured for Email/Password Authentication and Firestore.
- Firebase web configuration for the browser and Firebase Admin service-account credentials for private API operations.
- `GEMINI_API_KEY` only if testing receipt scanning, AI Insights, or AI Finance provider parsing.

## Clone, install, and configure

For copy-and-run Windows PowerShell instructions, see [Standalone Windows setup](STANDALONE_LOCAL_SETUP.md).

```sh
git clone <repository-url>
cd <repository-directory>
```

The checked-in lockfile now resolves package tarballs from the public npm registry. There is no project `.npmrc` file, so a normal npm installation does not require Replit configuration. Install from the repository root with:

```sh
npm install
```

Create the environment file:

```sh
cp .env.example .env
```

Fill in the placeholders from [Environment variables](ENVIRONMENT_VARIABLES.md). Do not commit `.env`.

**Important:** Vite reads `.env` values while building the frontend, but the Node server does not load `.env` itself (there is no `dotenv` dependency or custom loader). Export the server variables in the shell or configure them in the process environment. On a POSIX shell, a simple `.env` file can be exported with:

```sh
set -a
. ./.env
set +a
```

Quote values containing shell-special characters. `FIREBASE_PRIVATE_KEY` should contain the service-account private key with escaped `\n` sequences; the server converts them to newlines.

## Run the application

The repository’s `npm run dev` script currently runs `npm run build && npm start`; despite its name, it builds and starts the production-mode Express server rather than starting a separate Vite HMR server.

```sh
npm run dev
```

The application listens on `PORT` or port `5000`. Open the local app at `http://localhost:5000`; the API health endpoint is `/api/health`.

The server also has a non-production branch that mounts Vite middleware. To invoke that branch directly on macOS/Linux:

```sh
NODE_ENV=development npx tsx server/src/index.ts
```

The current server configuration disables Vite HMR/websocket support in this middleware setup. There is no separate frontend/backend development script.

## Verify authentication and data access

1. Confirm `GET /api/health` returns `{"data":{"status":"ok","service":"sejora-api","phase":"foundation"}}`. This is a liveness response only; it does not verify Firestore or Gemini.
2. Open `/signup`, create a development account, and complete email verification. The Firebase project must authorize the local hostname used by the browser.
3. Sign in and confirm `GET /api/auth/me` succeeds with a Firebase ID token.
4. Exercise a read such as `GET /api/transactions?pageSize=1` against a non-production Firebase project or test account.
5. Test Gemini-dependent routes only after `GEMINI_API_KEY` is configured. Avoid using production financial data for development or test writes.

`npm test` uses in-memory repositories and provider mocks for much of the suite. It does not prove live Firebase persistence, Firebase Security Rules behavior, or live Gemini responses. No Firestore Emulator configuration is present.

## Quality checks

```sh
npm run typecheck
npm test
npm run build
```