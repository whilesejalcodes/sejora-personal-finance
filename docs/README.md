# Sejora deployment documentation

This package describes the application as it exists in this repository. It documents deployment preparation only: it does not migrate Firebase or Gemini, provision external services, change application behavior, or publish the application.

## Start here

| Document | Use it for |
|---|---|
| [Architecture](ARCHITECTURE.md) | Current browser, API, authentication, database, and AI boundaries |
| [Local development](LOCAL_DEVELOPMENT.md) | Cloning and running the repository outside Replit |
| [Standalone Windows setup](STANDALONE_LOCAL_SETUP.md) | Exact PowerShell commands for Windows, including environment loading |
| [Deployment](DEPLOYMENT.md) | Platform-neutral deployment order and production checklist |
| [Frontend deployment](FRONTEND_DEPLOYMENT.md) | Building and serving `dist/client` |
| [Backend deployment](BACKEND_DEPLOYMENT.md) | Building and starting the Express server |
| [Database](DATABASE.md) | Firestore provisioning and data layout |
| [Authentication](AUTHENTICATION.md) | Firebase sign-in, ID tokens, and API authorization |
| [Environment variables](ENVIRONMENT_VARIABLES.md) | Every environment variable read by current source |
| [Third-party services](THIRD_PARTY_SERVICES.md) | Firebase and Gemini requirements |
| [API reference](API_REFERENCE.md) | Current `/api` endpoints, inputs, responses, and errors |
| [Troubleshooting](TROUBLESHOOTING.md) | Common local and production failures |
| [Replit to independent deployment](REPLIT_TO_INDEPENDENT_DEPLOYMENT.md) | Replit-specific items and manual migration checklist |

The existing root-level `README.md`, `DATABASE.md`, `FIREBASE_SETUP.md`, and `SEJORA_ARCHITECTURE.md` are retained. These deployment documents supplement them.

## Current application at a glance

- Frontend: React 19, TypeScript, React Router, and Vite, with source under `client/`.
- Backend: Express 5 and TypeScript, with source under `server/`.
- Shared contracts/calculations: `shared/`.
- Persistence and user authentication: Firebase Firestore and Firebase Authentication. Firestore access is through the server-side Firebase Admin SDK.
- AI features: server-side Google Gemini calls for receipt extraction, AI insights, and constrained AI Finance intent parsing.
- No vector database, SQL database, Firebase Storage upload flow, or Replit-managed authentication/database/storage service is used by current application code.

The production server serves both the built frontend and `/api` from one origin. The browser calls root-relative `/api/...` URLs and there is no configurable frontend API base URL or Express CORS middleware.

## Deployment readiness

### READY

- The application has a production build and start command: `npm run build` and `npm start`.
- The Express server binds to `0.0.0.0` and reads `PORT` (default `5000`).
- The production server serves the Vite output from `dist/client` and provides a BrowserRouter fallback for non-API routes.
- Private data access is separated from the browser: Firebase Admin verifies ID tokens and uses UID-scoped Firestore repositories.
- Firestore rules and an indexes file are present; the current indexes file is empty and no data migration or seed script is required by the source.

### REQUIRES CONFIGURATION

- Configure the Firebase project, email/password sign-in, Firestore database, authorized frontend domains, and server-side Firebase Admin service-account variables.
- Supply the five `VITE_FIREBASE_*` public configuration values when building the frontend. They are intentionally public browser configuration, not server secrets.
- Supply `GEMINI_API_KEY` at runtime if receipt scanning, AI insights, or AI Finance intent parsing will be used.
- Deploy the checked-in Firestore rules and indexes through the Firebase project’s chosen administrative process. This repository does not include a Firebase CLI deployment configuration.
- Serve the UI and API on the same origin, or put a reverse proxy in front that maps `/api/*` to the backend.
- `package-lock.json` uses public npm registry tarball URLs. The project has no `.npmrc` file that redirects installs to Replit.
- Set up HTTPS, the public hostname, process supervision, logs, backups, and any edge rate limits in the selected hosting environment.

### REQUIRES CODE CHANGE

- Hosting the frontend and API on different browser origins without a same-origin reverse proxy requires an API-base-URL setting in the frontend and an explicit backend CORS policy. Neither exists today.

### REPLIT-SPECIFIC

- `.replit` selects the Node runtime, starts the `Start application` workflow, maps ports, and specifies Replit deployment commands.
- The lockfile no longer depends on Replit's package registry. The `.replit` workflow and runtime settings remain workspace-only and are not required by the standalone commands.
- Replit environment/secrets must be recreated in the new host’s environment manager. The application source does not read `REPLIT_*` variables or call Replit services.

## Can the frontend and backend be deployed separately right now?

They can run as separate hosting services only when a same-origin reverse proxy preserves the browser’s `/api/...` URLs and the frontend host provides SPA history fallback. They cannot be deployed as unrelated frontend/API origins without a code change for the API base URL and a CORS policy. The simplest deployment is the existing single Node service, which serves both the API and `dist/client`.