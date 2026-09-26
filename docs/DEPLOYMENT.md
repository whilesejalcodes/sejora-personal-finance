# Platform-independent deployment

## Recommended deployment shape

The least-complex production layout is the application’s existing single-service mode:

1. Build the client and server from the repository root.
2. Run the compiled Express server.
3. Let that server serve both `dist/client` and `/api` from one HTTPS origin.

This preserves the frontend’s root-relative API requests and avoids adding cross-origin behavior that is not present in the source. Alternatively, host the static frontend separately and configure a same-origin reverse proxy for `/api/*`; see [Frontend deployment](FRONTEND_DEPLOYMENT.md).

## Deployment order

1. **Install dependencies.** The lockfile resolves packages from the public npm registry and the project has no registry override. Run `npm install` from the repository root.
2. **Prepare Firebase.** Configure the existing or intentionally selected Firebase project, enable Email/Password Authentication, provision Firestore, add production frontend domains to Firebase Authorized domains, and deploy the checked-in Firestore rules/indexes through the Firebase administrative process you choose.
3. **Prepare Gemini if needed.** Create/configure the provider credential and store `GEMINI_API_KEY` only in the backend’s secret manager when receipt scanning, AI Insights, or AI Finance are enabled.
4. **Configure build-time frontend values.** Provide all five `VITE_FIREBASE_*` values to the build environment. These values become part of the public client bundle; they are not Admin credentials.
5. **Build.** In the repository root, run `npm run build`.
6. **Configure backend runtime values.** Set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`; set `GEMINI_API_KEY` if using Gemini-backed routes. Supply the host-provided `PORT` when available.
7. **Start the service.** Configure the host to run exactly `npm start`. The process runs `NODE_ENV=production node dist/server/src/index.js`; it binds to `0.0.0.0` and uses `PORT` or defaults to `5000`.
8. **Configure HTTPS and routing.** Terminate TLS at the host or reverse proxy. Keep frontend pages and `/api/*` on the same browser origin. If hosting the frontend separately, route `/api/*` to this backend and route frontend deep links to its `index.html`.
9. **Verify liveness and dependencies.** Check `/api/health`, then use a verified-email test account to call `/api/auth/me` and read one Firestore-backed endpoint. The health endpoint does not check Firebase or Gemini.
10. **Verify optional AI flows.** Test AI Finance, AI Insights, and receipt scan using non-production account data only after configuring the Gemini key.

## Database and existing data

The application uses Firestore; there are no SQL migrations, schema bootstrap scripts, or seed scripts. Firestore collections/documents are created lazily on first write. If the same Firebase project is retained, its existing data remains there; changing to a different Firebase project does not copy data and would require a separate, explicit data migration, which this package does not perform.

The server uses Firebase Admin, which bypasses Firestore Security Rules. The verified-token middleware and UID-scoped repository paths are therefore essential. Keep direct client access denied by the checked-in rules.

## Production checklist

- [ ] Use Node 24 for parity with the configured runtime and verify npm can reach all lockfile package URLs.
- [ ] Recreate server secrets in a private host secret manager; never add them to `VITE_*` values, source, logs, or a public artifact.
- [ ] Supply Vite’s public Firebase configuration during the production build.
- [ ] Confirm the Firebase project, Firestore database, Email/Password provider, rules, and authorized frontend domains.
- [ ] Confirm the Firebase Admin account can access the intended Firestore database.
- [ ] Set `GEMINI_API_KEY` only if using the Gemini-backed features.
- [ ] Expose the port supplied in `PORT` and allow binding to `0.0.0.0`.
- [ ] Serve frontend and API on one origin or configure a same-origin `/api/*` reverse proxy.
- [ ] Configure SPA history fallback without rewriting `/api/*` to `index.html`.
- [ ] Use HTTPS and review proxy/client IP behavior; current request guards are in-memory and do not coordinate across replicas.
- [ ] Verify `/api/health`, verified sign-in, `/api/auth/me`, a Firestore read, and each enabled Gemini feature.
- [ ] Keep backups and recovery access for the Firebase project outside the application host.

No hosting provider is selected or configured in this repository.