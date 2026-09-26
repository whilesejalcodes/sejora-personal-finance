# Frontend deployment

## Build location and commands

Frontend source is in `client/`; Vite configuration and the npm package manifest are at the repository root. The frontend uses React, React Router, and Vite. Run package-manager commands from the repository root:

```sh
npm install
npm run build
```

`npm run build` typechecks the client and server, builds the Vite client, and compiles the server. The static client output is `dist/client/`. There is no frontend-only npm script. `npx vite build` can produce the client bundle alone, but it does not run the repository’s full typecheck or compile the server.

## Required public build variables

These five variables are read in `client/src/lib/firebase.ts` and must be available when Vite builds the bundle:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_APP_ID`

They configure the browser Firebase SDK and are public client configuration. Vite embeds `VITE_*` values in JavaScript sent to every visitor. Do not place Firebase Admin credentials, `GEMINI_API_KEY`, or any other server secret in a `VITE_*` variable.

## Backend URL and same-origin routing

The browser API client uses paths such as `/api/transactions`; there is no API base URL setting, no `VITE_API_URL`, and no development proxy configuration. With the current code, the browser calls the API on the same origin as the page.

For an independent static frontend host, configure:

1. SPA fallback so browser routes such as `/dashboard` and `/verify-email` return `index.html`.
2. A same-origin reverse proxy for `/api/*` to the Express backend. Do not rewrite `/api/*` requests to the SPA.
3. Firebase Authentication Authorized domains to include the frontend domain.

Serving the frontend and API on unrelated origins is not configured. It would require a frontend API-origin setting and explicit backend CORS rules allowing the precise frontend origin, `Authorization`, and `Content-Type`. The current API uses Bearer headers rather than cookies.

## Generic hosting requirements

- Serve the contents of `dist/client/` as static files.
- Support an SPA/history fallback for non-asset frontend routes.
- Make the five public Firebase variables available at build time.
- Route `/api/*` to a reachable backend on the same browser origin.
- Use HTTPS and register the host with Firebase Authentication.

The current production Express server already serves `dist/client/` and implements a non-API SPA fallback. A separate static host is optional, not required.