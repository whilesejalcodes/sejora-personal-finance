# Replit to independent deployment checklist

This is a manual inventory and checklist, not an automated migration. It does not transfer Firebase data, move secrets, change providers, or configure a hosting vendor.

## Replit-specific items found

| Current dependency | What it does | Required outside Replit? | What to configure/replace | References | Manual action |
|---|---|---:|---|---|---|
| `.replit` Node/Nix configuration | Selects Node.js 24 and a Nix channel. | No | Install a compatible Node.js/npm runtime on the chosen host; Node 24 matches the current runtime. | `.replit:1-4` | Configure the runtime in the independent build and run environment. |
| `Start application` Replit workflow | Runs `npm run dev`, waits for port 5000, and presents a webview. `npm run dev` builds then starts production Express. | No | Configure build `npm run build`, start `npm start`, and expose `PORT`. | `.replit:6-28`, `package.json` | Set up the selected host's process/build commands. |
| Replit port mappings | Map port 5000 and additional ports. Application source uses `PORT` (default 5000); the other mappings are not referenced by app source. | No | Route HTTPS to the host-provided port, with the process binding to `0.0.0.0`. | `.replit:30-44`, `server/src/index.ts` | Configure one public web route; do not recreate unused port mappings. |
| Replit shared environment and Secrets | Provides public Firebase web configuration and backend service credentials in this workspace. | The values must be available, the Replit facility is not required. | Recreate only the variable names in the target build/runtime secret manager; keep backend credentials server-only. | `.replit`, `.env.example`, `client/src/lib/firebase.ts`, `server/src/auth/firebase-admin.ts`, Gemini service files | Manually copy credentials from the authorized source to the new secret manager. Do not copy values into docs or public files. |
| npm package registry | The lockfile now resolves tarballs from the public npm registry. The repository has no `.npmrc` override. | No | No Replit package configuration is required for installation. | `package.json`, `package-lock.json` | Run `npm install` with normal npm settings. |
| Replit autoscale deployment config | Defines Replit's build/run commands and autoscale target. | No | Use equivalent build/run/process settings on the chosen platform. | `.replit` deployment section | Select host scaling, restart, health-check, and logging policies manually. |

No `REPLIT_*` variable or Replit SDK call is used by application source. The application does not depend on Replit Auth, Replit Database, Replit Object Storage, or a Replit-managed external API integration.

## Configuration and secrets to carry over

Recreate these values in the new environment without placing private values in the repository:

- Public build-time Firebase configuration: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_APP_ID`.
- Backend Firebase Admin credentials: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`.
- Backend Gemini key: `GEMINI_API_KEY`, only if Gemini-backed features are used.
- Runtime values: `PORT` is normally supplied by the host; `npm start` sets `NODE_ENV=production`.

The five `VITE_FIREBASE_*` values are public client configuration embedded in the browser bundle. They are not substitutes for the private Firebase Admin service account. The audit found populated public Firebase configuration in `.replit`; this document intentionally omits the values. Review Firebase API-key restrictions and Authorized domains.

`SESSION_SECRET` was present in the old `.env.example` but is not read by current source and is not part of the migration list.

## Files and build artifacts

### Source/configuration to keep in the deployment repository

- `client/`, `server/`, and `shared/`
- Root `package.json`, the portable/reviewed `package-lock.json`, `vite.config.ts`, TypeScript configs, `index.html`, and `public/`
- `firestore.rules` and `firestore.indexes.json` for separately managed Firebase deployment
- `.env.example` and documentation

Build from the repository root with `npm run build`. `dist/` is generated and ignored by Git; do not rely on an existing workspace build artifact.

### Do not expose publicly

- `.env` files, Firebase Admin credentials, Gemini API credentials, or any secret-manager export
- `node_modules/` or server output as a public static directory
- Backend source maps/bundles as downloadable assets unless intentionally protected/required

`dist/client/` is the public browser application. It contains the public Firebase web configuration by design; it must never contain Admin service-account values or Gemini credentials.

`.replit` is not needed by the independent runtime. If the repository remains public, note that its currently populated `VITE_FIREBASE_*` values are public client configuration, not private service credentials.

## Can frontend and backend be separated?

The source is organized into `client/`, `server/`, and `shared/`, and the backend serves the built client in its current production mode. The frontend API client uses same-origin `/api/...` paths; there is no frontend API-origin variable, and the server has no CORS middleware.

- **Separate processes/hosts with one browser origin:** possible without application code changes when a reverse proxy sends `/api/*` to Express, serves the static SPA, and rewrites other frontend routes to `index.html`.
- **Different frontend and API origins:** not currently configured. It requires a frontend API-base setting and a backend CORS policy; those code changes are intentionally not made here.
- **Simplest current deployment:** build and run the single Express service, which serves both API and `dist/client/`.

## Manual migration checklist

- [ ] Choose a Node 24-compatible host and verify the npm registry is reachable.
- [ ] Confirm the independent machine can reach the public npm registry and run `npm install`.
- [ ] Provision/configure Firebase Authentication and Firestore; decide explicitly whether to retain the existing Firebase project/data.
- [ ] Deploy `firestore.rules` and `firestore.indexes.json` through Firebase administration tooling.
- [ ] Recreate only the needed environment variables in the correct build or runtime scope.
- [ ] Configure HTTPS, public domain, process startup, host port, logs, backups, and reverse-proxy rules.
- [ ] Add the production browser domain to Firebase Authentication Authorized domains.
- [ ] Build with public `VITE_FIREBASE_*` values present; start the backend with private variables injected at runtime.
- [ ] Verify health, verified-email login, an authenticated Firestore read, and each Gemini-dependent feature that is enabled.
- [ ] Do not point a new deployment at production financial data until its Firebase project and credentials are verified.

No hosting provider is prescribed by this repository.