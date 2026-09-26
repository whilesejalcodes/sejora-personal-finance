# Authentication and authorization

## Provider and configuration

Authentication uses Firebase Authentication with the browser Firebase SDK. Email/Password is the configured sign-in flow. The browser requires the five public `VITE_FIREBASE_*` values listed in [Environment variables](ENVIRONMENT_VARIABLES.md). The server independently requires Firebase Admin service-account configuration.

Enable Email/Password in the Firebase project and add every production frontend hostname to Firebase Authentication Authorized domains.

## Signup, verification, login, and logout

- Signup calls `createUserWithEmailAndPassword` and sends a Firebase verification email.
- New accounts go to `/verify-email`. The UI blocks application routes until Firebase reports a verified email.
- Login uses Firebase email/password. Verified accounts proceed to `/dashboard`; unverified accounts remain on the verification path.
- The client reloads the Firebase user while checking verification. After Firebase confirms verification, `refreshUser()` calls `getIdToken(true)` before protected navigation to refresh the ID token's claims.
- Password reset uses Firebase's `sendPasswordResetEmail`; logout uses Firebase `signOut`.
- Firebase browser auth persistence is configured as `browserLocalPersistence`. The app does not implement its own auth cookie or session table.

## Authenticated API requests

The client reads the current Firebase user and obtains an ID token for authenticated API requests. It sends:

```http
Authorization: Bearer <Firebase ID token>
```

The backend verifies the token with Firebase Admin, derives the UID from the verified token, and rejects unverified email. All API routes except `GET /api/health` require authentication. Client route guards improve navigation UX but do not replace backend authorization.

There is no application cookie/session exchange, custom token-refresh endpoint, or use of `SESSION_SECRET`. The checked-in `.env.example` omits `SESSION_SECRET` because current source does not read it.

## Newly verified accounts and the reported re-login symptom

The repository previously had a risk that Firebase's `reload(user)` could update `emailVerified` without refreshing a cached ID token. Current source explicitly forces `getIdToken(true)` after verification is confirmed. This is a code-level mitigation for the symptom where a newly verified account may need to sign out and back in before authenticated operations work.

The source-level change does not establish that every Firebase project/account flow has been live-tested. If an account still receives `401` or `403`, confirm that verification completed, refresh the verification page, inspect the token-backed `/api/auth/me` response, and sign out/in as a temporary recovery step. Do not weaken backend token or email-verification checks.

## Production and cross-origin requirements

- Configure the browser Firebase project values at frontend build time and Firebase Admin credentials only on the backend.
- Register the deployed browser hostname in Firebase Authentication Authorized domains.
- Serve frontend and API from one origin or use a same-origin proxy. The backend has no CORS middleware.
- The application authenticates browser API calls with an Authorization header, not cookies. Cookie `SameSite`/credential settings are not part of the current design.
- Never expose service-account credentials, Gemini credentials, or Firebase ID tokens in logs or source control.