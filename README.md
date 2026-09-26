# Sejora

Sejora is a personal finance intelligence platform designed as a portfolio-grade full-stack application. It is being built incrementally according to [`SEJORA_ARCHITECTURE.md`](./SEJORA_ARCHITECTURE.md).

## Current status

Sejora currently includes:

- React/Vite frontend with the calm Sejora visual language
- Firebase email/password authentication with verified protected routes
- UID-scoped Firestore transaction and monthly budget CRUD
- Deterministic INR/paise transaction, budget, dashboard, and analytics calculations
- Authenticated Dashboard and Analytics read models
- Responsive Recharts spending and monthly trend visualizations
- Deterministic spending insights, unusual-spending flags, and recurring-payment detection
- Savings goals with UID-scoped CRUD and server-derived progress
- Explainable Financial Health scoring and recurring-only Upcoming Cash Flow
- Receipt scanning with server-side multimodal Gemini extraction and mandatory review
- Deterministic six-month historical forecasting and server-side what-if simulations

Generic AI assistant behavior remains intentionally deferred to later phases. Phase 11 now provides a deliberately limited, read-only natural-language financial Q&A surface.

## Run locally

```bash
npm install
npm run dev
```

The application listens on port `5000` and serves the Vite UI plus the Express API. Verify the service at `/api/health`.

## Checks

```bash
npm run typecheck
npm test
npm run build
```

## Phase 5 analytics

Dashboard data is available through the authenticated `GET /api/dashboard?month=YYYY-MM` endpoint. It derives the selected-month income, expenses, balance, savings rate, category spending, budget performance, and latest five transactions from the user's existing records.

Analytics data is available through the authenticated `GET /api/analytics?from=YYYY-MM&to=YYYY-MM` endpoint. The range defaults to the latest six months when omitted and is limited to twelve months. Analytics are derived on the server and are not persisted as a second ledger or analytics collection.

Balance and savings use the selected period:

```text
balance = income - expenses
savings = income - expenses
savingsRate = savings / income * 100  (when income > 0)
```

Amounts are stored as positive integer paise in `amountMinor`, and the transaction type determines whether they contribute to income or expenses.

## Phase 6 spending intelligence

Phase 6 adds two authenticated, read-only endpoints derived from the existing transaction ledger:

```text
GET /api/insights?month=YYYY-MM
GET /api/recurring-payments?from=YYYY-MM&to=YYYY-MM
```

Insights focus on one month. They include the largest expense category, largest individual expense, meaningful month-over-month category changes, spending concentration, and high-frequency expense categories. Category changes require at least two expense entries in both the focus and previous month, a 20% relative change, and a ₹500 absolute change.

Unusual-spending flags are integrated into the Insights response. They require at least five historical expenses. Category-relative flags require at least three historical expenses in that category and compare against twice the category average with a minimum ₹500 gap. The overall fallback compares against three times the historical expense average with a minimum ₹1,000 gap. These are personal spending comparisons, not fraud detection.

Recurring-payment detection uses up to twelve selected months of expenses. A pattern requires at least three observations, a normalized merchant name, amounts within 15% of the median amount (with a minimum ₹1 tolerance), and consistent weekly (6–8 days), monthly (27–33 days), or quarterly (80–100 days) intervals. Results expose observations, typical amount, frequency, last occurrence, expected next occurrence, and a deterministic confidence percentage.

Phase 6 reads are UID-scoped, paginated, and capped at 10,000 transactions. No intelligence, anomaly, or recurring-payment records are persisted.

## Phase 7 financial health, goals, and upcoming cash flow

Phase 7 adds:

```text
GET    /api/goals
POST   /api/goals
GET    /api/goals/:id
PATCH  /api/goals/:id
DELETE /api/goals/:id
GET    /api/financial-health?month=YYYY-MM
GET    /api/cash-flow/upcoming?from=YYYY-MM-DD&to=YYYY-MM-DD
```

Goals are stored under `users/{uid}/goals/{goalId}`. Target and current amounts are positive integer paise values, and the server derives remaining amount, percentage complete, and one of `not_started`, `in_progress`, `nearly_there`, `completed`, or `overdue`.

Financial Health is a deterministic, explainable score across savings, budget discipline, spending stability, recurring-cost pressure, and goal progress. The server returns an explicit insufficient-data state until there are at least three months of activity and at least 60% of supported scoring dimensions are available. It never stores or accepts a client-supplied score.

Upcoming Cash Flow is an expected view, not a forecast. It includes only detected recurring expenses with reliable next dates, uses a maximum 31-day window, reports expected income as zero when recurring income is not supported, and never creates future transaction records.

## Phase 8 receipt scanning

Receipt scanning uses the authenticated `POST /api/receipts/scan` endpoint. The server accepts only JPEG, PNG, and WebP images up to 5 MB, processes them in memory, and does not persist the uploaded image or add a receipt collection.

Gemini is called only from the backend using the `GEMINI_API_KEY` Replit Secret. It extracts structured receipt fields such as merchant, date, total, currency, type, category, payment method, and visible line items. Gemini output is untrusted: the server validates the response, normalizes rupee values into integer paise, marks missing or unsupported fields for review, and never calculates balances, budgets, analytics, health, or future cash flow.

The scanner UI always shows a review state. The user can edit extracted fields before the final confirmation is sent through the existing `/api/transactions` create path with `source: "receipt"`. Scanning alone never creates a transaction.

Automated tests mock the extractor and cover authentication, upload limits/signatures, missing credentials, provider failures, malformed structured responses, paise conversion, review-required fields, and the no-automatic-transaction boundary. Live Gemini behavior is not claimed as verified.

## Phase 9 forecasting and what-if simulations

Forecasting is deterministic and uses no Gemini, LLM, chat, recommendations, or new transaction types. The authenticated endpoints are:

```text
GET  /api/forecast?horizon=1|3|6
POST /api/forecast/simulate
```

The forecast reads the authenticated user's transaction ledger and uses the last six completed calendar months, excluding the current partial month. All six months remain explicit in the response, including zero-activity months. Baseline income and expense projections use a simple arithmetic average of months with recorded activity; no missing history is fabricated. At least two active completed months are required for a projection. Fewer than four active months returns a visible limited-history state, while fewer than two returns an explicit insufficient-data state.

The response includes actual cumulative recorded balance (income minus expenses through the as-of date), historical monthly income/expenses/net savings, projected monthly income/expenses/net savings, projected future balances, savings rates, data coverage, and assumptions. The “actual balance” is a calculated ledger balance, not a connected bank-account balance.

Simulations accept a 1-, 3-, or 6-month horizon, percentage adjustments to projected income and expenses, an optional one-time expense applied in the first projected month, and an optional monthly savings target. Simulation results are calculated in memory and never write transactions, budgets, goals, recurring payments, or forecast records. Automated coverage includes pure arithmetic, data sufficiency, authentication, validation, UID isolation, projection horizons, scenario differences, and the no-persistence boundary.

## Phase 10 AI financial insights

The existing deterministic `GET /api/insights?month=YYYY-MM` endpoint remains the source for factual spending observations and anomalies. Phase 10 adds an explicit, authenticated `POST /api/insights/ai?month=YYYY-MM` action for on-demand AI interpretation.

The server first derives a structured context from existing calculations: current and comparison-period totals, recent active-month coverage, category spending, Phase 6 spending observations and anomalies, recurring patterns, and the Phase 9 forecast when sufficient data exists. It sends only aggregated facts to Gemini through the server-side `GEMINI_API_KEY`; it does not send Firebase credentials, authentication tokens, email addresses, or raw transaction records.

Gemini is not the source of financial truth. It returns at most five structured insights containing a title, neutral summary, controlled type/severity, and IDs for supporting facts. The server validates the schema, rejects unknown fact IDs, rejects unsupported numerical claims, resolves every displayed supporting value from server-owned facts, and returns safe provider or validation errors. Insights are not persisted and generation is read-only.

The Insights page keeps deterministic observations visible and adds an explicit Generate/Regenerate action, loading/error/insufficient-data states, AI disclosure, controlled insight cards, and server-derived supporting facts. Phase 10 does not add chat, natural-language finance questions, recommendations, or financial-product advice.

## Phase 11 natural-language financial questions

AI Finance is a dedicated authenticated, read-only Q&A page at `/ai-finance` backed by `POST /api/ai-finance/questions`. It supports deterministic questions about expense totals, category spending and share, top categories, largest expenses, income, savings and savings rate, month comparisons, merchant/description matches, budgets, goals, recurring payments, and forecast balance or expenses.

Each question is independently processed. Common supported phrasing is mapped locally to a controlled intent so deterministic answers remain available without an unnecessary provider call. Other phrasing is sent to the server-only Gemini intent adapter. Gemini returns only a strict intent object; it never receives raw transaction history, never selects a UID, never executes tools, and never calculates the answer. The server validates the intent, resolves periods and categories, runs the existing UID-scoped services, and returns an authoritative result plus supporting facts.

Period rules are deterministic: omitted periods use the current calendar month because that is Sejora's established default; “last month” means the previous calendar month; named months use the appropriate year relative to the application month; “this year” and “last year” use calendar years; and “last N months” includes the current month and the preceding N-1 calendar months. Forecast questions accept only 1, 3, or 6 months and reuse Phase 9 calculations.

Unsupported advice requests, ambiguous questions, missing categories/goals, insufficient forecast history, provider failures, malformed intents, and invalid request bodies receive explicit safe states. There is no chat history, conversation memory, natural-language mutation command, or persistence created by Q&A. Financial numbers in the answer and supporting data are always produced by deterministic server calculations.

## Phase 12 security hardening and testing

Phase 12 preserves the existing backend-only Firestore architecture and hardens its boundaries:

- Every private API requires a verified Firebase ID token and verified email; user identity always comes from the verified token, never request data.
- Transaction, budget, goal, analytics, intelligence, forecast, receipt, AI Insights, and AI Finance data paths remain UID-scoped.
- Direct client access to private Firestore collections is denied by `firestore.rules`; server requests use the Firebase Admin SDK and server-side Zod/business validation.
- Calendar dates, integer paise amounts, enum values, IDs, request bodies, question lengths, forecast inputs, and uploads are bounded and validated.
- Transaction updates validate the merged resulting record, preventing an expense from losing its required category.
- Malformed JSON, oversized bodies, provider failures, upload failures, and unexpected errors return safe structured errors without stack traces or provider internals.
- Receipt scanning remains in-memory, limited to JPEG/PNG/WebP images up to 5 MB, requires image signatures and bounded dimensions, and never creates a transaction before confirmation.
- Receipt, AI Insights, and AI Finance provider routes have simple bounded request/concurrency guards; this is intentionally not a distributed rate-limiting system.
- Gemini credentials remain server-only. Gemini output is strictly validated, provider errors are sanitized, and user-controlled text is treated as data rather than instructions.
- Forecast, What-If, AI Insights, and AI Finance remain read-only; receipt scanning remains review-only until the user confirms a transaction.

Phase 12 also adds regression coverage for authentication, UID isolation, invalid calendar dates, malformed JSON, merged transaction validation, upload dimensions, provider failures, rate guards, client network errors, and the existing no-write guarantees. No Firestore emulator is configured, so rules-level emulator testing is not available.

## Configuration

Copy `.env.example` to `.env` only when configuring a future phase. Phase 1 does not require Firebase or Gemini credentials.