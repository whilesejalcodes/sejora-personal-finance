# Third-party services

## Firebase Authentication

- **Use:** Browser-side email/password signup, sign-in, email verification, password reset, and Firebase ID-token issuance.
- **Production required:** Yes for application accounts and authenticated API operations.
- **Credentials/configuration:** Public browser values are the five `VITE_FIREBASE_*` variables. Enable Email/Password and authorize every deployed frontend domain in the Firebase project.
- **Where it runs:** Firebase browser SDK calls originate in the client. The server does not trust a client-supplied UID; it verifies each ID token with Firebase Admin.
- **If unavailable:** Signup/sign-in/token refresh fail; protected API operations cannot authenticate.

## Cloud Firestore / Firebase Admin

- **Use:** Server-side persistence for transactions, budgets, and goals in UID-scoped subcollections.
- **Production required:** Yes for persisted financial records and features derived from them.
- **Credentials/configuration:** Backend-only `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`. Provision a Firestore database in the same project. Deploy `firestore.rules`; this repository does not include Firebase CLI deployment configuration.
- **Where it runs:** Backend only, through `firebase-admin`. Firestore Admin requests bypass Firestore Security Rules; API token verification and verified-UID repository paths are the authorization boundary.
- **If unavailable:** Reads/writes fail with safe Firestore errors; `/api/health` may still return `ok` because it is a liveness-only endpoint.

The `VITE_FIREBASE_STORAGE_BUCKET` value is required by the current browser configuration validation, but no Firebase Storage upload or download operation exists in the application.

## Google Gemini API

- **Use:** Receipt field extraction, AI-generated insight text grounded in server-derived facts, and structured intent extraction for AI Finance.
- **Production required:** Only if those Gemini-backed features are enabled. Core transaction, budget, goal, and deterministic analytics flows do not use Gemini.
- **Credentials/configuration:** Backend-only `GEMINI_API_KEY`; current services use the model identifier `gemini-3.6-flash`.
- **Where it runs:** Server only. The browser does not call Gemini directly and does not receive the provider key. AI Finance uses Gemini for intent extraction, not financial calculations.
- **If unavailable:** Gemini-backed requests return explicit provider/timeout errors. Receipt scanning does not create or save a transaction; users can still use other app functions.

## Other infrastructure audit

- No vector database, bank-data API, external SQL service, Firebase Storage upload path, or Replit-managed database/auth/storage service is used by current application code.
- No Replit SDK or `REPLIT_*` environment variable is read by application source.
- A security scan found populated Firebase web configuration in `.replit` under `VITE_FIREBASE_*` names. These are browser-public project configuration, not Firebase Admin credentials or provider secrets; their values are intentionally not repeated here. Review Firebase API-key restrictions and authorized domains for the project.
- No Firebase Admin private key or Gemini key was found embedded in the browser bundle during the source/bundle scan. Secret values were not printed or copied into this documentation.