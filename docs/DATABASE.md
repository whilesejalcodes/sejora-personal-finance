# Database and persistence

## Technology and connection

The application uses Cloud Firestore through `firebase-admin` on the backend. It does not use PostgreSQL, SQLite, a SQL ORM, Replit Database, or a vector database. Firebase Admin obtains project/service-account configuration from:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

The Admin SDK accesses the configured Firebase project's default Firestore database. No database URL is read from the application environment.

## Collections and ownership

Current persisted data is limited to:

```text
users/{verifiedUid}/transactions/{transactionId}
users/{verifiedUid}/budgets/{budgetId}
users/{verifiedUid}/goals/{goalId}
```

The UID comes from a verified Firebase ID token. Repositories construct the user-scoped collection paths; the client cannot select another owner.

Transactions store integer paise in `amountMinor`, fixed currency `INR`, type, merchant, category, date, optional payment/notes/receipt metadata, source, and server timestamps. Budgets and goals also store integer paise and server-owned IDs/timestamps. Derived totals, budget usage, analytics, financial-health scores, forecasts, receipt extraction results, and AI outputs are not persisted as separate collections.

For full field-level data shapes and historical implementation notes, retain and consult the existing root [`DATABASE.md`](../DATABASE.md).

## Provisioning, rules, indexes, migrations, and seeds

- A Firebase project and Firestore database must be provisioned manually. Source code does not create the cloud project or database.
- Collections and documents are created lazily by the first successful write; there is no bootstrap script.
- There are no migrations or seed-data requirements in the application.
- `firestore.rules` denies direct client access to private data. Backend Admin operations bypass those rules, so server token verification and UID scoping are the authorization boundary.
- `firestore.indexes.json` currently defines no composite indexes. No `firebase.json` or Firebase CLI deployment command is present in the repository; deploy the checked-in rules/index file with the Firebase project's separately configured administrative tooling.
- No Firestore Emulator configuration exists. Unit/integration tests use in-memory repositories and do not validate live Firestore rules or persistence.

## Production setup and verification

1. Select or create the intended Firebase project.
2. Provision its Firestore database and enable Firebase Authentication Email/Password.
3. Deploy `firestore.rules` and `firestore.indexes.json` using an authorized Firebase administration workflow.
4. Configure the server-side Firebase Admin variables in the backend secret manager.
5. Add the production frontend domain to Firebase Authentication Authorized domains.
6. Create or verify a test user and call a Firestore-backed API route with that user's Firebase ID token.

`GET /api/health` only confirms the HTTP service is live; it is not a database connectivity check. A successful authenticated read such as `GET /api/transactions?pageSize=1` is a more meaningful operational test. Use a non-production account or a separate Firebase project for deployment verification that could create or edit records.