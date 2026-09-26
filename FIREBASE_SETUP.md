# Firebase Authentication setup

Phase 2 uses Firebase Authentication for email/password accounts. The application does not include Firebase credentials, and no Firebase setup is assumed to be complete until these steps are done manually.

## 1. Create or select a Firebase project

1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Create a project or select the project for Sejora.
3. Add a Web app from **Project settings → Your apps**.
4. Copy the client configuration values into the `VITE_` variables listed below.

## 2. Enable email/password authentication

1. Open **Build → Authentication**.
2. Select **Get started** if Authentication is not enabled.
3. Open **Sign-in method**.
4. Enable **Email/Password**.
5. Save the provider configuration.

## 3. Configure authorized domains

In **Authentication → Settings → Authorized domains**, add the domains where the app will run if Firebase does not already include them. Include the Replit development or deployment domain used to test Sejora.

## 4. Add client configuration to Replit

Add these non-server values as environment variables available to the client:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_APP_ID
```

These values are required for the browser Firebase SDK. They are not a substitute for server credentials.

## 5. Create secure Admin credentials

1. In Firebase **Project settings → Service accounts**, select **Generate new private key**.
2. Store the downloaded service-account values securely.
3. Add only the following server-side values to Replit Secrets:

```text
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
```

Keep the complete private key in `FIREBASE_PRIVATE_KEY`. The server handles escaped newline sequences. Never add these values to `VITE_` variables, source files, client bundles, or chat messages.

## 6. Verify the setup

After configuring both client and server values:

1. Start the app with `npm run dev`.
2. Open `/signup` and create a test account.
3. Confirm the verification email arrives.
4. Verify the email and return to `/verify-email`.
5. Refresh verification status and open the dashboard.
6. Refresh the page to confirm Firebase persistence.
7. Sign out and confirm the dashboard redirects to `/login`.
8. Test `/forgot-password`.
9. With a current Firebase ID token, call `GET /api/auth/me` using `Authorization: Bearer <token>`.

Until the variables are configured, the UI displays a safe setup message and protected API requests return `AUTHENTICATION_UNAVAILABLE`. No fake credentials or fake authentication state is used.