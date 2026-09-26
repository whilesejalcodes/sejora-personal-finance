# SEJORA Architecture and Technical Design

**Status:** Phase 0 planning document  
**Scope:** Architecture and implementation plan only. This document does not claim that the application, external integrations, or credentials are configured.

## 1. Product boundary and guiding principles

Sejora is a portfolio/educational personal-finance intelligence application. It is not a bank, payment processor, financial-advice service, or fraud-detection product. It will use user-entered or receipt-derived sample data unless bank connectivity is deliberately added in a later phase.

The core product loop is:

> **Track → Understand → Predict → Act**

The transaction ledger is the source of truth. Budgets, analytics, anomaly detection, recurring-payment detection, forecasts, health scoring, and insights consume normalized transaction data rather than maintaining independent financial totals.

The most important architectural rule is to keep reliable calculations deterministic:

- Application logic calculates balances, totals, percentages, scores, forecasts, comparisons, and detection signals.
- AI explains, summarizes, extracts receipt fields, and answers natural-language questions using a small, calculated context.
- AI never receives unrestricted database access and never becomes the authority for numerical results.
- AI-generated structured data is validated with Zod and shown to the user for confirmation before it can be persisted.
- The application remains useful when Gemini is unavailable.

## 2. Proposed high-level architecture

```text
┌────────────────────────────────────────────────────────────┐
│ React + TypeScript + Vite + Tailwind + shadcn/ui           │
│ Pages, route protection, forms, charts, tables, UI states  │
└──────────────────────────────┬─────────────────────────────┘
                               │ HTTPS / JSON
                               │ Authorization: Bearer Firebase ID token
                               v
┌────────────────────────────────────────────────────────────┐
│ Node.js + Express + TypeScript API                         │
│ auth middleware → validation → services → response mapper  │
└───────────────┬─────────────────────────────┬───────────────┘
                │                             │
                v                             v
┌─────────────────────────┐       ┌──────────────────────────┐
│ Firestore repository     │       │ Finance/AI services       │
│ Admin SDK, user-scoped  │       │ deterministic engine       │
│ subcollections          │       │ Gemini adapter (optional)  │
└──────────────┬──────────┘       └──────────────┬────────────┘
               │                                 │
               v                                 v
       ┌───────────────┐                 ┌───────────────┐
       │ Cloud         │                 │ Gemini API    │
       │ Firestore     │                 │ server-side   │
       └───────────────┘                 └───────────────┘
```

### Request/data flow

1. Firebase Authentication signs the user in on the client.
2. The client obtains a Firebase ID token and sends it to the Express API.
3. Express verifies the token server-side with the Firebase Admin SDK.
4. Middleware derives `uid` from verified claims. A user-provided `userId` is never used for ownership.
5. Zod validates the request body, query parameters, and route parameters.
6. A service calls the repository with the verified `uid`.
7. Deterministic finance services calculate the requested result from normalized data.
8. An AI service is invoked only for features that need language or image understanding, and receives minimized structured context.
9. The API returns a stable response envelope to the UI.

### Why this architecture

- **Why:** It demonstrates understandable full-stack boundaries relevant to fintech and SDE interviews.
- **Responsibility:** React presents data; Express authenticates and orchestrates; repositories own persistence; the finance engine owns calculations; the AI adapter owns model-specific behavior.
- **Alternatives considered:** A client-only Firebase application, a single monolithic route file, GraphQL, or microservices.
- **Why this choice fits:** Express provides explicit REST boundaries and is easier to trace than a distributed or over-abstracted system. Firestore keeps the specified NoSQL storage model. A client-only design would make server-side AI and authorization harder to enforce.
- **Tradeoff:** The API introduces more code than direct Firestore calls, but it provides a safer and more interview-ready enforcement point.

## 3. Planned repository structure

The initial implementation should preserve a conventional Vite/Express layout and grow by responsibility, not by feature-specific duplication.

```text
/
├── client/
│   ├── src/
│   │   ├── app/
│   │   │   ├── App.tsx
│   │   │   ├── router.tsx
│   │   │   └── providers.tsx
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   ├── ui/
│   │   │   ├── charts/
│   │   │   ├── transactions/
│   │   │   ├── budgets/
│   │   │   └── goals/
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── dashboard/
│   │   │   ├── transactions/
│   │   │   ├── budgets/
│   │   │   ├── analytics/
│   │   │   ├── goals/
│   │   │   ├── recurring/
│   │   │   ├── receipts/
│   │   │   ├── insights/
│   │   │   ├── cash-flow/
│   │   │   └── ai-finance/
│   │   ├── lib/
│   │   │   ├── firebase.ts
│   │   │   ├── api-client.ts
│   │   │   ├── formatters.ts
│   │   │   └── errors.ts
│   │   ├── hooks/
│   │   ├── types/
│   │   └── styles/
│   └── index.html
├── server/
│   └── src/
│       ├── index.ts
│       ├── app.ts
│       ├── config/
│       ├── middleware/
│       │   ├── auth.ts
│       │   ├── validate.ts
│       │   ├── errors.ts
│       │   └── request-id.ts
│       ├── routes/
│       │   ├── health.routes.ts
│       │   ├── transactions.routes.ts
│       │   ├── budgets.routes.ts
│       │   ├── analytics.routes.ts
│       │   ├── goals.routes.ts
│       │   ├── recurring.routes.ts
│       │   ├── receipts.routes.ts
│       │   ├── cash-flow.routes.ts
│       │   ├── insights.routes.ts
│       │   └── ai-finance.routes.ts
│       ├── controllers/
│       ├── services/
│       │   ├── transaction.service.ts
│       │   ├── budget.service.ts
│       │   ├── analytics.service.ts
│       │   ├── goal.service.ts
│       │   ├── intelligence.service.ts
│       │   ├── forecast.service.ts
│       │   ├── receipt.service.ts
│       │   ├── insight.service.ts
│       │   └── ai/
│       │       ├── ai-provider.ts
│       │       ├── gemini-provider.ts
│       │       ├── prompts.ts
│       │       └── schemas.ts
│       ├── finance/
│       │   ├── calculations.ts
│       │   ├── health-score.ts
│       │   ├── anomaly-detection.ts
│       │   ├── recurring-detection.ts
│       │   ├── forecasting.ts
│       │   ├── what-if.ts
│       │   └── rules.ts
│       ├── repositories/
│       │   ├── firestore.ts
│       │   ├── transaction.repository.ts
│       │   ├── budget.repository.ts
│       │   ├── goal.repository.ts
│       │   ├── receipt.repository.ts
│       │   └── insight.repository.ts
│       ├── schemas/
│       └── types/
├── shared/
│   ├── types/
│   ├── schemas/
│   └── constants/
├── tests/
│   ├── unit/
│   │   ├── finance/
│   │   └── validation/
│   ├── integration/
│   ├── security/
│   └── fixtures/
├── firestore.rules
├── firestore.indexes.json
├── README.md
├── ARCHITECTURE.md
├── TESTING.md
├── DATABASE.md
└── package.json
```

The exact filenames may be adjusted to match the generated starter project, but responsibilities should remain separated. Shared schemas and types should be small and dependency-light so the browser does not import server-only code.

## 4. Frontend architecture

### Application shell

The first UI should establish the product identity and navigation without pretending every page is implemented. The shell contains:

- Responsive sidebar on desktop and compact navigation on smaller screens.
- Sejora wordmark and a clear “portfolio project” boundary in settings/about copy.
- Primary navigation: Dashboard, Transactions, Budgets, Analytics, Goals, Recurring, Receipts, Insights, AI Finance.
- Settings and account menu.
- Route-level loading, empty, unauthorized, and error states.

### Page responsibilities

- `Dashboard`: current financial snapshot, budget health, meaningful trend chart, recent transactions, upcoming payments, health score, and a small prioritized insight list.
- `Transactions`: searchable, filterable, sortable ledger with create/edit/delete and detail review.
- `Budgets`: category/month budgets with deterministic usage, remaining amount, status, and warnings.
- `Analytics`: category breakdown, monthly income/expense, savings trend, merchant concentration, and month-over-month comparisons.
- `Goals`: create and track savings goals with contribution/progress calculations.
- `Recurring`: review predicted recurring payments, confidence, and expected dates.
- `Receipts`: upload, processing, extracted-field review, edit, and confirm flow.
- `Insights`: proactive deterministic-context insights with optional AI explanations.
- `AI Finance`: constrained, read-only natural-language questions about the user’s own calculated financial context.
- Future placeholders should explain what is not available rather than display fake values.

### State and data fetching

The client should use a small API client around `fetch` and feature hooks for loading/error/cache state. It should not import Firestore repositories or calculate authoritative totals locally. Lightweight UI state (dialog visibility, form drafts, filters) can remain in components; server state belongs in feature hooks.

Forms should:

- Validate basic shape client-side for immediate feedback.
- Validate again on the server.
- Use accessible labels, keyboard support, focus management, and confirmation dialogs for destructive actions.
- Show explicit pending and retry states.

Recharts is appropriate for the small set of explanatory charts. Charts should have text summaries or tables so the information is accessible and useful without visual interpretation.

## 5. Backend architecture

### Layers

1. **Routes:** Declare URL/method and attach middleware.
2. **Controllers:** Translate HTTP input/output and delegate to services.
3. **Services:** Orchestrate repositories, finance modules, and AI adapters.
4. **Finance modules:** Pure deterministic calculations, easy to unit test.
5. **Repositories:** The only layer that knows Firestore collection paths and query details.
6. **AI provider:** A replaceable adapter that receives a deliberately small context.
7. **Error middleware:** Converts known errors into safe, consistent responses.

Routes should never contain financial formulas or call Gemini directly. React components should never contain authoritative finance formulas or provider credentials.

### Response envelope

Successful responses should use predictable JSON, for example:

```json
{
  "data": {},
  "meta": { "requestId": "..." }
}
```

Errors should use:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The transaction amount must be greater than zero.",
    "details": {}
  },
  "meta": { "requestId": "..." }
}
```

The public message must be useful without exposing stack traces, tokens, raw model output, or database internals.

## 6. Firestore schema

All user-owned collections are subcollections below the verified user document:

```text
users/{uid}
├── transactions/{transactionId}
├── budgets/{budgetId}
├── goals/{goalId}
├── recurringPayments/{paymentId}
├── receipts/{receiptId}
└── insights/{insightId}
```

### `users/{uid}`

Profile and product preferences only:

```text
displayName
email
currency
timezone
createdAt
updatedAt
```

Firebase Auth remains the identity source. The profile document is not a password store.

### `transactions/{transactionId}`

```text
amountMinor: integer          // positive magnitude in the smallest currency unit
currency: string              // initially INR is supported in the UI
type: "income" | "expense"
merchant: string
category: string
occurredAt: timestamp
paymentMethod?: string
notes?: string
source: "manual" | "receipt"
receiptId?: string
createdAt: timestamp
updatedAt: timestamp
```

Amounts should be stored as integers in minor units to avoid floating-point currency errors. A display formatter converts them to currency strings. The transaction type determines whether an amount contributes to income or expenses; negative magnitudes are rejected for normal entries.

### `budgets/{budgetId}`

```text
name: string
category?: string
period: "monthly"
amountMinor: integer
currency: string
startDate: timestamp
endDate?: timestamp
createdAt: timestamp
updatedAt: timestamp
```

Budget usage is derived from matching expense transactions. It should not be stored as an independently editable total. If a material performance issue appears, a documented server-maintained summary can be added later with a rebuild path.

### `goals/{goalId}`

```text
name: string
targetAmountMinor: integer
currentAmountMinor: integer
currency: "INR"
targetDate: timestamp
category?: string
notes?: string
createdAt: timestamp
updatedAt: timestamp
```

The initial version treats `currentAmountMinor` as an explicit user-managed goal balance. Remaining amount, percentage, and display status are derived on the server; future versions can introduce a separate contribution ledger instead of guessing goal contributions from arbitrary transactions.

### `recurringPayments/{paymentId}`

```text
merchant: string
typicalAmountMinor: integer
currency: string
frequency: "weekly" | "monthly" | "quarterly" | "unknown"
nextExpectedAt?: timestamp
confidence: number
evidenceTransactionIds: string[]
status: "detected" | "confirmed" | "dismissed"
updatedAt: timestamp
```

This is a prediction cache/review record. It is not treated as guaranteed truth and should be recomputable from transactions.

### `receipts/{receiptId}`

```text
status: "uploaded" | "processing" | "review" | "confirmed" | "rejected" | "failed"
storagePath?: string
mimeType: string
extractedData?: object
validationIssues?: string[]
confirmedTransactionId?: string
createdAt: timestamp
updatedAt: timestamp
```

Images should use Firebase Storage only if that service is configured in a later phase. Do not put large image bytes in Firestore.

### `insights/{insightId}`

```text
kind: "spending_pattern" | "budget_risk" | "recurring" | "savings_opportunity" | "anomaly"
title: string
body: string
severity: "info" | "attention" | "warning"
contextVersion: string
source: "deterministic" | "gemini"
metricRefs: object
readAt?: timestamp
expiresAt?: timestamp
createdAt: timestamp
```

`metricRefs` stores trusted source metric identifiers/values needed to explain the insight, not an opaque AI claim. Persisting generated insight text is optional; initial versions can generate insights on demand and persist only user-dismissed/read state.

### Relationships and consistency

- `transactions.receiptId` is an optional reference to a receipt document.
- `receipts.confirmedTransactionId` links back after confirmation.
- Recurring records contain evidence transaction IDs but remain derived predictions.
- Budgets query transactions by user scope, date window, type, and category.
- Goals are independent from the transaction ledger in the first version to avoid assuming how a user earmarks money.
- Server timestamps are used for audit fields.
- Transaction confirmation from a receipt should use a controlled write sequence or Firestore batch so the receipt status and transaction link do not diverge.

### Query/index plan

Likely composite indexes will be added only when a real query requires them, such as:

- `transactions`: `occurredAt` + `type`
- `transactions`: `category` + `occurredAt`
- `transactions`: `merchant` + `occurredAt`
- `budgets`: `period` + `startDate`
- `insights`: `status/readAt` + `createdAt` if read state is modeled

The repository layer should document each index requirement and keep query limits/pagination explicit. Avoid unbounded reads for analytics.

## 7. Authentication and protected access

### Authentication flow

1. The user signs up or signs in using Firebase Authentication.
2. Firebase handles password storage, reset, verification, and session persistence.
3. The client observes Firebase auth state and shows a loading shell while it resolves.
4. A signed-in client obtains an ID token and sends it in the `Authorization` header.
5. Express verifies the token with Firebase Admin.
6. Middleware attaches only verified identity claims to the request context.
7. Protected routes reject missing, invalid, or expired tokens with `401`.
8. The client refreshes the token through the Firebase SDK and retries one request when appropriate.
9. Sign-out clears Firebase client state and returns the user to `/login`.

Protected UI routes should redirect unauthenticated users without rendering private data. The backend remains the actual security boundary.

The first authentication scope includes email/password sign-up, sign-in, sign-out, forgot-password, email verification state, persistent auth state, loading states, and useful error messages. Google sign-in is optional later.

### Ownership model

The server takes `uid` only from verified Firebase credentials. It constructs repository paths from that `uid`. Client-supplied `userId` fields are ignored or rejected. Resource lookups are always scoped under the verified user's path; a foreign resource therefore behaves as not found/unauthorized without revealing its existence.

## 8. REST API endpoint plan

All endpoints below, except health and authentication handled by Firebase client SDK, require Firebase authentication.

### Health

```text
GET /api/health
```

Returns service status and a non-sensitive version/build identifier. It must not expose secrets or database contents.

### Transactions

```text
GET    /api/transactions?from=&to=&type=&category=&q=&sort=&pageToken=
POST   /api/transactions
GET    /api/transactions/:transactionId
PATCH  /api/transactions/:transactionId
DELETE /api/transactions/:transactionId
```

`POST` and `PATCH` validate amounts, dates, categories, enum values, and string lengths. List results are paginated and sorted server-side.

### Budgets

```text
GET    /api/budgets?month=
POST   /api/budgets
PATCH  /api/budgets/:budgetId
DELETE /api/budgets/:budgetId
GET    /api/budgets/summary?month=
```

The summary computes spent, remaining, usage percentage, and a documented status such as healthy, approaching, at-limit, or overspent.

### Analytics and dashboard

```text
GET /api/dashboard?month=
GET /api/analytics/monthly?from=&to=
GET /api/analytics/categories?from=&to=
GET /api/analytics/merchants?from=&to=
GET /api/analytics/patterns?from=&to=
GET /api/analytics/health-score?month=
```

Dashboard data can be aggregated into one read model response for UI efficiency, while the underlying computations remain modular and independently testable.

### Goals

```text
GET    /api/goals
POST   /api/goals
GET    /api/goals/:goalId
PATCH  /api/goals/:goalId
DELETE /api/goals/:goalId
```

The service calculates progress, remaining amount, and required monthly/weekly contribution from target date and current values.

### Recurring and cash flow

```text
GET /api/recurring-payments
PATCH /api/recurring-payments/:paymentId
GET /api/cash-flow/upcoming?days=
GET /api/cash-flow/forecast?month=
```

Detection and forecast responses identify assumptions and confidence rather than presenting certainty.

### Receipts

```text
POST /api/receipts
POST /api/receipts/:receiptId/process
GET  /api/receipts/:receiptId
PATCH /api/receipts/:receiptId/review
POST /api/receipts/:receiptId/confirm
POST /api/receipts/:receiptId/reject
```

Receipt confirmation is the only operation that creates the linked transaction. Processing does not persist unvalidated extracted data as a transaction.

### Insights and AI finance

```text
GET  /api/insights?month=
POST /api/insights/refresh
PATCH /api/insights/:insightId/read
POST /api/ai-finance/ask
POST /api/ai-finance/explain-forecast
POST /api/finance/what-if
```

`/api/finance/what-if` is deterministic and should not require Gemini. AI explanation endpoints are optional enhancements and must degrade to a deterministic explanation when unavailable.

## 9. Deterministic financial engine

The finance layer should use pure functions over typed input objects. No Firestore calls, HTTP requests, or model calls belong inside these functions.

### Core calculations

- `calculateBalance`: income minus expense over a defined period, with a clear opening-balance assumption.
- `calculateIncome`: sum income magnitudes.
- `calculateExpenses`: sum expense magnitudes.
- `calculateSavings`: income minus expenses.
- `calculateSavingsRate`: savings divided by income, with an explicit zero-income result.
- `calculateBudgetUsage`: category/date-matched expenses divided by budget amount.
- `calculateBudgetStatus`: documented thresholds:
  - Healthy: `< 80%`
  - Approaching limit: `80%–99.99%`
  - At limit: `100%`
  - Overspent: `> 100%`
- `calculateGoalProgress`: current divided by target, clamped for display while preserving over-target information.
- `calculateMonthComparison`: current versus previous period with zero-baseline handling.

### Financial health score

The score is a portfolio metric, not professional financial advice. A transparent initial model can be:

```text
savingsScore       = clamp(savingsRate / 0.20, 0, 1) * 30
budgetScore        = adherenceRatio * 25
stabilityScore     = stabilityFactor * 15
recurringScore     = clamp(1 - recurringExpenseRatio / 0.60, 0, 1) * 15
goalScore          = averageGoalProgress * 15
healthScore        = round(sum of components), bounded 0–100
```

Where:

- `adherenceRatio` rewards staying within active budgets and is bounded `0–1`.
- `stabilityFactor` is based on the variation of recent monthly expenses, with insufficient history receiving a neutral documented value.
- `recurringExpenseRatio` is recurring monthly cost divided by monthly income, with no-income handling.
- `averageGoalProgress` is the average active-goal progress, or a neutral value when there are no goals.

The exact constants should be placed in a documented rules module and covered by independent tests. UI copy must say “Sejora financial health metric” and explain the factors.

### Spending patterns

Rule-based patterns can include:

- Weekend expense share versus weekday expense share.
- Category growth compared with the previous month.
- Largest category share of expenses.
- Merchant concentration.
- Spending concentration by day of month.
- Discretionary-category increase.

Each result must include the observed values, comparison window, threshold, and explanation so it can be shown as an explainable finding.

### Anomaly detection

For a transaction or category, use robust, understandable signals:

- Transaction amount above a configured multiple of the user’s historical category median.
- Category period spending above a multiple of its historical average.
- Sudden frequency increase.
- New merchant combined with a large amount.

Return `isAnomaly`, `severity`, `reason`, and the baseline used. This is personal spending anomaly detection, not production fraud detection.

### Recurring-payment detection

Group expense transactions using normalized merchant names and amount tolerance. For each group:

1. Require a minimum number of historical occurrences.
2. Sort dates and calculate intervals.
3. Identify weekly, monthly, or quarterly patterns within tolerance.
4. Calculate typical amount and next expected date.
5. Produce a confidence score from occurrence count, interval regularity, merchant similarity, and amount similarity.

The UI labels results “potential recurring payment” and lets the user confirm or dismiss them.

### Forecasting

The initial forecast is intentionally simple:

- Use the current period’s elapsed days and expense run rate.
- Optionally blend recent completed-month averages when sufficient history exists.
- Project remaining-period expenses.
- Add known confirmed recurring items in the projection window.
- Calculate projected savings and balance from deterministic inputs.

Every forecast response includes:

- Inputs and period.
- Formula/method identifier.
- Assumptions.
- Limitations.
- Confidence or data sufficiency note.

It is not a guaranteed future outcome.

### What-if simulations

Examples:

- Category reduction percentage.
- Additional monthly savings amount.
- Income decrease amount.

The server reads current category spending, validates the scenario bounds, then calculates monthly and annual deltas. For example, category savings are `currentCategoryExpense * reductionRate`, and annual opportunity is the monthly delta multiplied by 12. Gemini may explain the already-calculated result, but cannot change it.

## 10. Analytics and intelligence architecture

Analytics is a service composition over a bounded transaction query:

```text
transaction repository
        ↓
normalized period data
        ↓
finance calculations + intelligence rules
        ↓
dashboard / chart / insight view models
```

The analytics API should provide chart-ready points and textual summaries together. Planned outputs:

- Monthly income versus expenses.
- Savings and savings rate.
- Category breakdown with amount and share.
- Trend over time.
- Top merchants and concentration.
- Budget performance.
- Month-over-month changes.
- Pattern findings.
- Anomalies.

Do not create a visualization unless it answers a financial question. Large datasets should use server-side aggregation and date limits rather than loading the entire history into the browser.

## 11. Receipt scanning architecture

### Workflow

```text
upload image
  → validate mime type/size
  → create receipt record: uploaded
  → store image outside Firestore if Storage is configured
  → mark processing
  → server-side Gemini multimodal extraction
  → parse structured response
  → Zod validation and sanity checks
  → receipt status: review
  → user edits or rejects
  → user confirms
  → create transaction and link receipt
```

### Extracted schema

The first version focuses on expense receipts:

```text
merchant?: string
totalMinor?: integer
currency?: string
occurredAt?: ISO date
categorySuggestion?: string
taxMinor?: integer
discountMinor?: integer
lineItems?: [{ description, quantity?, amountMinor }]
```

Merchant, total, and date may be missing. Missing fields cause a review issue, not an automatic save. Sanity checks verify nonnegative values, line-item consistency where possible, supported currencies, reasonable dates, and total/tax/discount relationships.

### Failure handling

- Poor image: return a reviewable failure with a retry option.
- Missing merchant/date: keep status `review` with highlighted fields.
- Malformed model output: reject it at the schema boundary.
- Gemini unavailable: allow manual transaction creation; do not block the rest of Sejora.
- User rejection: mark receipt rejected without creating a transaction.

The AI result is never directly persisted as a transaction. Confirmation uses the user-approved fields.

## 12. Gemini integration architecture

Gemini calls happen only in server-side `ai` modules. The provider interface should make model replacement possible:

```text
AiProvider
├── extractReceipt(image, schema)
├── explainInsight(context)
├── answerFinanceQuestion(context)
└── explainScenario(context)
```

The Gemini implementation owns SDK configuration, model selection, prompt construction, structured-output configuration, timeout/retry behavior, and provider error mapping. The rest of the application depends on `AiProvider`, not on Gemini-specific imports.

### Context minimization

Before a model call, the server:

1. Classifies the feature and required intent.
2. Queries only the necessary user-scoped records.
3. Performs all arithmetic and comparisons.
4. Builds a small typed context containing trusted metrics, date windows, and relevant labels.
5. Sends concise instructions that say not to invent numbers.

The model never gets Firestore access, arbitrary query execution, credentials, or the entire transaction history by default. Prompts should separate trusted context from user-authored text to reduce prompt injection risk.

### Structured output

For receipt extraction, request the official structured-output format supported by the installed Gemini SDK/model and validate the parsed result with Zod. Unexpected fields can be stripped or rejected according to the schema policy. Model output is untrusted input.

### Graceful degradation

- If no Gemini key is configured, AI sections show an honest “AI enhancement unavailable” state.
- Proactive deterministic insights remain visible.
- Natural-language questions can support a small deterministic intent set with a clear unsupported-question response.
- AI failures are logged with request IDs and provider error categories, never secrets or raw financial payloads.

## 13. AI insight workflow

```text
bounded transaction/budget data
  → deterministic metrics and findings
  → insight candidates with trusted metric references
  → optional Gemini wording/explanation
  → validate response
  → return or persist safe insight
```

Initial candidates:

- Spending pattern: “Food spending increased compared with the previous period.”
- Budget risk: projected category overspend based on deterministic forecast.
- Recurring expense: repeated amount/merchant pattern.
- Savings opportunity: a deterministic reduction scenario.
- Anomaly: transaction/category deviation with baseline.

Gemini is a presentation layer for context, not the candidate generator of financial facts. If it fails, a deterministic template can render the same trusted numbers.

## 14. Natural-language finance workflow

The endpoint should not send a raw question and the whole database to Gemini. Instead:

1. Validate question length and rate-limit the endpoint.
2. Detect a constrained intent using deterministic patterns or a small intent classifier:
   - category total
   - period total
   - biggest expenses
   - month comparison
   - spending increase
   - budget usage
3. Extract category/date parameters and validate them.
4. Query only the relevant user-scoped records.
5. Compute the answer deterministically.
6. Return a structured result with source metrics.
7. Optionally ask Gemini to phrase the result conversationally.
8. If the intent is ambiguous, ask for clarification rather than guessing.

Example:

```text
“How much did I spend on food in the last three months?”
  → intent: category_total
  → category: Food
  → date window: last three calendar months
  → server sum: authoritative amount
  → optional Gemini: concise explanation
```

An empty result is a valid response: “No Food expenses were found in this period.” It is not an excuse for the model to invent a value.

## 15. Security model and Firestore rules

### Application security

- Firebase Authentication handles password storage and reset.
- All private Express routes require a verified Firebase ID token.
- User identity comes from verified claims, never request body/path ownership fields.
- Every repository path is built from the verified `uid`.
- Zod validates all external input.
- Amounts, date ranges, enum values, pagination sizes, uploads, and question lengths have limits.
- Use HTTPS in deployed environments and secure CORS configuration.
- Apply request body size limits and rate limits, especially to receipt and AI endpoints.
- Redact authorization headers, tokens, images, and unnecessary financial details from logs.
- Keep Gemini credentials server-side in Replit Secrets.
- Do not include server-only environment variables in Vite client bundles.

### Firestore rules strategy

The preferred architecture is backend-only Firestore data access through the Admin SDK. Because Admin SDK access bypasses Firestore client rules, the server’s verified-token and user-scoped repository checks are the primary authorization controls.

Client-side Firestore access should be disabled for private collections. Rules should:

- Deny by default.
- Allow only explicitly safe profile reads/writes if the design ever needs them directly.
- Require `request.auth.uid == userId` for any permitted user document path.
- Never allow one user to read another user’s subcollections.
- Validate immutable ownership fields if any document is written directly.
- Avoid trusting client-supplied ownership fields.

Rules should be tested in the Firebase emulator where feasible, while API authorization tests verify the server path because Admin SDK operations do not exercise Firestore rules.

### Security cases to verify

- Unauthenticated protected-page access.
- Missing, expired, or malformed bearer token.
- User A attempting to use User B’s resource ID.
- User A attempting to submit User B’s `userId`.
- Unauthorized receipt confirmation.
- Malformed request and oversized upload.
- Gemini key absent from client bundle.
- Sensitive data absent from logs.

## 16. Testing strategy

Testing is part of each phase, not a final cleanup step. The exact test runner should follow the starter setup, but the test suite should separate pure unit tests from API, security, and UI checks.

### Unit tests

Cover:

- balance, income, expenses, savings, and savings rate
- budget usage/status boundaries at 0%, 80%, 100%, and over 100%
- health-score components and zero-data behavior
- date windows and month boundaries
- spending-pattern thresholds
- anomaly baselines and missing history
- recurring interval/amount tolerance
- forecast assumptions and partial-month calculations
- what-if reductions/income changes
- goal progress and required contributions
- transaction and receipt Zod schemas

Test normal, empty, invalid, negative, very large, conflicting, missing-optional-field, and boundary inputs.

### API integration tests

Use an emulator or repository test double—not production data—to verify:

- authenticated CRUD flows
- pagination/filter/sort behavior
- validation errors
- not-found behavior
- budget summaries after transaction changes
- receipt review/confirm flow
- deterministic analytics and what-if endpoints
- AI-disabled fallback behavior

### Security tests

Verify:

- missing and invalid authentication are rejected
- manipulated user IDs do not alter the verified owner
- cross-user reads/updates/deletes fail
- resource IDs cannot escape the user path
- Firestore emulator rules enforce ownership
- server logs and built client assets contain no secrets

### AI contract/failure tests

Mock the provider boundary to test:

- valid receipt output
- poor-quality receipt
- missing merchant/date
- incorrect types
- malformed structured output
- user edit/reject before confirmation
- provider timeout/failure/rate limit
- normal financial question
- no matching data
- ambiguous question
- unusual metric values
- malformed explanation response

Do not claim a live Gemini integration is verified without a real configured test request. A provider mock verifies application behavior, not external credentials or model availability.

### UI verification

For implemented flows, verify through the actual preview:

- auth loading/error/protected redirects
- transaction create/edit/delete
- budget status changes after transactions
- chart/table empty states
- receipt review before confirm
- responsive navigation
- keyboard and focus behavior
- browser console errors

Each phase report should list tests performed, passed, failed, bugs found/fixed, limitations, and anything not verified.

## 17. Error-handling strategy

Use typed application errors with safe public codes:

```text
VALIDATION_ERROR       400
UNAUTHENTICATED        401
FORBIDDEN              403
NOT_FOUND              404
CONFLICT               409
RATE_LIMITED           429
PROVIDER_UNAVAILABLE   503
INTERNAL_ERROR         500
```

Rules:

- Handle expected errors at the service boundary.
- Convert Firestore errors into safe domain errors.
- Return a request ID for support/debug correlation.
- Log server-side with structured metadata, but redact credentials and unnecessary financial content.
- Use bounded retries only for transient provider/network failures.
- Do not retry validation, authorization, or malformed model responses.
- Show recovery options: retry, edit manually, reload, or continue without AI.
- Avoid silent fallback when a calculation cannot be trusted; show a data-sufficiency message.

## 18. Services, credentials, and environment variables

### Services/accounts needed

1. Firebase project with Authentication enabled.
2. Cloud Firestore database.
3. Optionally Firebase Storage for receipt images.
4. Google Gemini API access for AI-only features.
5. Replit deployment for hosting.

No service should be assumed to exist merely because the application has code for it.

### Client-safe Firebase configuration

Firebase web configuration values are designed to identify a Firebase project and may be exposed to the browser, but they still belong in environment configuration rather than hardcoded source:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

These values are not substitutes for Firestore rules or server authorization.

### Server-only variables

```text
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
GEMINI_API_KEY                 # optional until AI features are enabled
SESSION_SECRET                 # only if a server session/cookie layer is later chosen
```

The private key, Gemini key, and session secret belong in Replit Secrets and must never be committed, logged, sent to the client, or placed in a `VITE_` variable. The exact Firebase Admin credential format should be verified against the installed SDK and current Firebase documentation before implementation.

### Credential boundary decision

The initial design uses Firebase ID tokens and server verification rather than custom sessions. `SESSION_SECRET` is therefore not required for the first authentication implementation unless a later decision introduces server-managed session cookies. This avoids inventing a second auth mechanism.

## 19. Dependency/package plan

Use the requested stack with the smallest practical dependency set:

### Client

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui primitives
- Recharts
- Firebase web SDK
- Zod (shared request/form schemas where useful)

### Server

- Node.js
- Express
- TypeScript
- Firebase Admin SDK
- Zod
- Gemini’s official current SDK, after verifying the installed/current API

### Development/testing

- TypeScript compiler
- A lightweight test runner compatible with the starter project
- Supertest or equivalent only if needed for Express endpoint tests
- Firebase Emulator Suite only if it can be configured without obscuring the core architecture

Do not add PostgreSQL, Prisma, Supabase, an ORM, Redis, Kafka, Kubernetes, Docker, GraphQL, LangChain, a vector database, or another framework without a demonstrated requirement and an explicit architecture update.

## 20. Development phases and checkpoints

The project should be built incrementally. After each phase, stop, report the implementation and actual tests, document limitations, and wait for explicit confirmation before continuing.

### Phase 1 — Foundation, architecture, and UI shell

Create the React/Vite/Tailwind shell, Express health endpoint, shared types, navigation, route placeholders, core error/loading/empty states, and documentation skeleton. No fake data should be presented as real financial history.

### Phase 2 — Firebase Authentication

Implement sign-up, sign-in, sign-out, reset, verification state, persistence, protected UI routes, bearer-token middleware, and auth error states.

### Phase 3 — Firestore data model and transactions

Configure Firestore access, repository boundaries, transaction schemas, user-scoped CRUD, pagination/filtering/sorting, ownership tests, and Firestore rules strategy.

### Phase 4 — Budgets and financial calculations

Implement budgets, usage/status calculations, deterministic core modules, and independent unit tests.

### Phase 5 — Dashboard and analytics

Build dashboard summaries, charts, category/month/merchant analytics, meaningful empty states, and data-range handling.

### Phase 6 — Spending intelligence

Add explainable spending patterns, anomalies, recurring-payment detection, review states, and tests for thresholds/tolerance.

### Phase 7 — Health, goals, and upcoming cash flow

Implement the documented deterministic health score, explicit user-managed goals, and upcoming recurring expense views. Do not create future transactions or introduce forecasting until a later phase.

### Phase 8 — Receipt scanning

Add secure receipt upload/storage, processing states, provider adapter, structured extraction validation, review/edit, rejection, and confirmation-to-transaction flow.

### Phase 9 — Forecasting and what-if

Add deterministic forecasts, assumptions/limitations, scenario validation, and numerical tests. Keep the numerical result independent from Gemini.

### Phase 10 — AI insights

Add bounded insight context, deterministic candidates, optional Gemini wording, fallbacks, persistence/read state if needed, and provider failure tests.

### Phase 11 — Natural-language finance questions (implemented)

Add constrained intent handling, minimal data retrieval, deterministic answers, optional AI intent parsing, ambiguity handling, and safe provider failures. Do not add conversation memory or mutation commands.

### Phase 12 — Security hardening, testing, and error handling (implemented)

Hardened the existing authorization, validation, upload, provider, and error boundaries without adding product features. Direct client access to private Firestore collections is denied because the application uses verified-token, UID-scoped Admin SDK repositories. Added malformed-request, invalid-date, merged-update, provider-failure, request-guard, upload-dimension, client-network, and regression coverage. Firestore emulator rules testing remains unavailable because no emulator is configured.

### Phase 13 — UI polish, performance, deployment, and documentation

Improve responsive/accessibility details, pagination and query efficiency, final README/architecture/testing/database docs, deployment configuration, and final verification. Deployment is not assumed until explicitly configured and tested.

## 21. Major feature interaction

```text
manual transaction ───────────────┐
                                  v
receipt → review → confirmed transaction
                                  │
             ┌────────────────────┼─────────────────────┐
             v                    v                     v
       budget usage          analytics              ledger history
             │                    │                     │
             v                    v                     ├── anomaly rules
       budget risk          patterns/compare            ├── recurring detection
             │                    │                     ├── forecasts
             └──────────────┬─────┘                     └── health score
                            v
                    structured insight context
                            │
                 optional Gemini explanation
                            │
                            v
                    user insight / action
```

Goals consume the same trusted financial metrics while their current balances remain explicit user-managed values. Upcoming cash flow consumes derived recurring predictions only; it does not require confirmed predictions, forecast assumptions, or future transaction writes. Every feature should be traceable back to source transactions and documented rules.

## 22. Deterministic versus AI-powered responsibilities

| Responsibility | Deterministic application logic | Gemini/AI |
|---|---:|---:|
| Authentication and authorization | Yes | No |
| CRUD and Firestore access | Yes | No |
| Balance, income, expenses, savings | Yes | No |
| Budget usage and warning thresholds | Yes | No |
| Health-score number and factors | Yes | No |
| Category/month/merchant analytics | Yes | No |
| Pattern and anomaly signals | Yes | No |
| Recurring-payment prediction | Yes | No |
| Forecast and what-if numbers | Yes | No |
| Receipt image understanding | Supporting role | Yes |
| Receipt structured field extraction | Validation authority | Yes, untrusted output |
| Insight candidate generation | Yes | No |
| Insight wording/explanation | Fallback available | Optional |
| Natural-language intent/data retrieval | Yes | Optional classifier/phrasing |
| Financial numerical answer | Yes | No |
| Financial explanation and summary | Fallback available | Optional |

## 23. Architectural risks and mitigations

### Missing external credentials

**Risk:** Firebase or Gemini configuration is unavailable.  
**Mitigation:** Separate configuration validation from startup where possible; keep deterministic features usable; show actionable setup errors; never create fake credentials.

### Firestore query cost and unbounded history

**Risk:** Analytics loads too many documents or repeats expensive reads.  
**Mitigation:** bounded date windows, pagination, server aggregation, composite indexes, and later documented summary materialization only if measurements justify it.

### Floating-point currency errors

**Risk:** Decimal arithmetic causes off-by-one display/calculation errors.  
**Mitigation:** store and calculate integer minor units; test large values and currency formatting.

### AI hallucination or malformed output

**Risk:** Model invents numbers or returns invalid receipt data.  
**Mitigation:** deterministic context, structured output, Zod validation, sanity checks, source metric references, confirmation gate, and fallback templates.

### Prompt injection through notes or merchant text

**Risk:** User-controlled financial text attempts to alter model behavior.  
**Mitigation:** minimize context, delimit untrusted fields, give strict system instructions, never grant tools/database access, and treat output as untrusted.

### Recurring detection false positives

**Risk:** Similar purchases are mislabeled subscriptions.  
**Mitigation:** minimum evidence, amount/interval tolerance, confidence display, review/dismiss states, and “potential” wording.

### Forecast overconfidence

**Risk:** Users interpret a simple run-rate projection as a guarantee.  
**Mitigation:** show assumptions, data sufficiency, method, limitations, and uncertainty language.

### Overbuilding the first release

**Risk:** Too many features reduce reliability and explainability.  
**Mitigation:** phase checkpoints, one source of truth, pure finance modules, no unnecessary infrastructure, and no automatic progression between phases.

## 24. Important tradeoffs and decisions needing approval

1. **Backend-only Firestore access vs direct client Firestore access:** Backend-only is preferred for consistent authorization and centralized business logic, at the cost of extra API plumbing.
2. **Firebase ID tokens vs server session cookies:** ID tokens are simpler and align directly with Firebase Auth. Session cookies can be considered later for web-specific session behavior; they are not needed initially.
3. **Goal balance model:** Initial goals use an explicit current amount. A future contribution ledger would be more auditable but adds another domain model.
4. **Derived versus stored analytics:** Initial analytics are computed from transactions to avoid stale duplicated totals. Summary documents can be added only after measuring a performance need.
5. **Gemini optionality:** AI is an enhancement and should be disabled cleanly without blocking the ledger, budgets, analytics, or deterministic insights.
6. **Receipt image storage:** Firebase Storage is preferred for images, but it is a separate service/configuration requirement and should not be faked if unavailable.
7. **Currency scope:** Start with one clearly supported display currency, likely INR based on the product examples, while storing currency on records so multi-currency support can be added deliberately later.
8. **Health score constants:** The weights and thresholds must be written down and tested, then treated as a portfolio metric rather than a claim of professional financial assessment.

Before Phase 1, the key decisions to approve are the backend-only Firestore access model, the initial currency scope, whether Firebase Storage is included in the first receipt phase, and whether AI credentials will be configured immediately or after deterministic features are complete.

## 25. Documentation deliverables

The final project should contain:

- `README.md`: overview, features, setup, scripts, environment variables, limitations, and phase status.
- `ARCHITECTURE.md`: concise implementation architecture linked to this planning document.
- `TESTING.md`: commands, test layers, security matrix, emulator notes, and verified/untested areas.
- `DATABASE.md`: schema, ownership, indexes, consistency, and rules strategy.
- Optional `API.md`: endpoint contracts and example safe responses.

Documentation must describe only implemented/verified behavior and must not claim real banking connectivity, fraud detection, professional advice, model retraining, or production banking infrastructure unless those capabilities are actually built and tested.

## 26. Implemented Phase 6 alignment

The current implementation follows the planned backend-only, deterministic finance architecture:

- `shared/finance/intelligence.ts` contains pure spending-insight, anomaly, and recurring-pattern rules.
- `server/src/intelligence/` owns authenticated orchestration and bounded transaction reads.
- `/api/insights` returns monthly spending observations and integrated unusual-spending signals.
- `/api/recurring-payments` returns derived recurring-looking expense patterns without persistence.
- Both routes use the verified UID and the existing transaction repository; no intelligence collection or duplicated ledger is introduced.
- Phase 6 thresholds and minimum-data requirements are documented in `README.md` and `DATABASE.md`.

Phase 7 health/goals/cash-flow, Phase 8 receipt scanning, Phase 9 deterministic forecasting/what-if behavior, Phase 10 on-demand AI insights, and Phase 11 read-only natural-language financial questions are implemented and documented in `README.md` and `DATABASE.md`. Phase 11 translates supported questions into validated intents and executes them against authenticated server-side data; Gemini does not calculate financial truth. Chat memory, mutation commands, and later phases remain deferred.
# SEJORA Architecture and Technical Design

**Status:** Phase 0 planning document  
**Scope:** Architecture and implementation plan only. This document does not claim that the application, external integrations, or credentials are configured.

## 1. Product boundary and guiding principles

Sejora is a portfolio/educational personal-finance intelligence application. It is not a bank, payment processor, financial-advice service, or fraud-detection product. It will use user-entered or receipt-derived sample data unless bank connectivity is deliberately added in a later phase.

The core product loop is:

> **Track → Understand → Predict → Act**

The transaction ledger is the source of truth. Budgets, analytics, anomaly detection, recurring-payment detection, forecasts, health scoring, and insights consume normalized transaction data rather than maintaining independent financial totals.

The most important architectural rule is to keep reliable calculations deterministic:

- Application logic calculates balances, totals, percentages, scores, forecasts, comparisons, and detection signals.
- AI explains, summarizes, extracts receipt fields, and answers natural-language questions using a small, calculated context.
- AI never receives unrestricted database access and never becomes the authority for numerical results.
- AI-generated structured data is validated with Zod and shown to the user for confirmation before it can be persisted.
- The application remains useful when Gemini is unavailable.

## 2. Proposed high-level architecture

```text
┌────────────────────────────────────────────────────────────┐
│ React + TypeScript + Vite + Tailwind + shadcn/ui           │
│ Pages, route protection, forms, charts, tables, UI states  │
└──────────────────────────────┬─────────────────────────────┘
                               │ HTTPS / JSON
                               │ Authorization: Bearer Firebase ID token
                               v
┌────────────────────────────────────────────────────────────┐
│ Node.js + Express + TypeScript API                         │
│ auth middleware → validation → services → response mapper  │
└───────────────┬─────────────────────────────┬───────────────┘
                │                             │
                v                             v
┌─────────────────────────┐       ┌──────────────────────────┐
│ Firestore repository     │       │ Finance/AI services       │
│ Admin SDK, user-scoped  │       │ deterministic engine       │
│ subcollections          │       │ Gemini adapter (optional)  │
└──────────────┬──────────┘       └──────────────┬────────────┘
               │                                 │
               v                                 v
       ┌───────────────┐                 ┌───────────────┐
       │ Cloud         │                 │ Gemini API    │
       │ Firestore     │                 │ server-side   │
       └───────────────┘                 └───────────────┘
```

### Request/data flow

1. Firebase Authentication signs the user in on the client.
2. The client obtains a Firebase ID token and sends it to the Express API.
3. Express verifies the token server-side with the Firebase Admin SDK.
4. Middleware derives `uid` from verified claims. A user-provided `userId` is never used for ownership.
5. Zod validates the request body, query parameters, and route parameters.
6. A service calls the repository with the verified `uid`.
7. Deterministic finance services calculate the requested result from normalized data.
8. An AI service is invoked only for features that need language or image understanding, and receives minimized structured context.
9. The API returns a stable response envelope to the UI.

### Why this architecture

- **Why:** It demonstrates understandable full-stack boundaries relevant to fintech and SDE interviews.
- **Responsibility:** React presents data; Express authenticates and orchestrates; repositories own persistence; the finance engine owns calculations; the AI adapter owns model-specific behavior.
- **Alternatives considered:** A client-only Firebase application, a single monolithic route file, GraphQL, or microservices.
- **Why this choice fits:** Express provides explicit REST boundaries and is easier to trace than a distributed or over-abstracted system. Firestore keeps the specified NoSQL storage model. A client-only design would make server-side AI and authorization harder to enforce.
- **Tradeoff:** The API introduces more code than direct Firestore calls, but it provides a safer and more interview-ready enforcement point.

## 3. Planned repository structure

The initial implementation should preserve a conventional Vite/Express layout and grow by responsibility, not by feature-specific duplication.

```text
/
├── client/
│   ├── src/
│   │   ├── app/
│   │   │   ├── App.tsx
│   │   │   ├── router.tsx
│   │   │   └── providers.tsx
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   ├── ui/
│   │   │   ├── charts/
│   │   │   ├── transactions/
│   │   │   ├── budgets/
│   │   │   └── goals/
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── dashboard/
│   │   │   ├── transactions/
│   │   │   ├── budgets/
│   │   │   ├── analytics/
│   │   │   ├── goals/
│   │   │   ├── recurring/
│   │   │   ├── receipts/
│   │   │   ├── insights/
│   │   │   ├── cash-flow/
│   │   │   └── ai-finance/
│   │   ├── lib/
│   │   │   ├── firebase.ts
│   │   │   ├── api-client.ts
│   │   │   ├── formatters.ts
│   │   │   └── errors.ts
│   │   ├── hooks/
│   │   ├── types/
│   │   └── styles/
│   └── index.html
├── server/
│   └── src/
│       ├── index.ts
│       ├── app.ts
│       ├── config/
│       ├── middleware/
│       │   ├── auth.ts
│       │   ├── validate.ts
│       │   ├── errors.ts
│       │   └── request-id.ts
│       ├── routes/
│       │   ├── health.routes.ts
│       │   ├── transactions.routes.ts
│       │   ├── budgets.routes.ts
│       │   ├── analytics.routes.ts
│       │   ├── goals.routes.ts
│       │   ├── recurring.routes.ts
│       │   ├── receipts.routes.ts
│       │   ├── cash-flow.routes.ts
│       │   ├── insights.routes.ts
│       │   └── ai-finance.routes.ts
│       ├── controllers/
│       ├── services/
│       │   ├── transaction.service.ts
│       │   ├── budget.service.ts
│       │   ├── analytics.service.ts
│       │   ├── goal.service.ts
│       │   ├── intelligence.service.ts
│       │   ├── forecast.service.ts
│       │   ├── receipt.service.ts
│       │   ├── insight.service.ts
│       │   └── ai/
│       │       ├── ai-provider.ts
│       │       ├── gemini-provider.ts
│       │       ├── prompts.ts
│       │       └── schemas.ts
│       ├── finance/
│       │   ├── calculations.ts
│       │   ├── health-score.ts
│       │   ├── anomaly-detection.ts
│       │   ├── recurring-detection.ts
│       │   ├── forecasting.ts
│       │   ├── what-if.ts
│       │   └── rules.ts
│       ├── repositories/
│       │   ├── firestore.ts
│       │   ├── transaction.repository.ts
│       │   ├── budget.repository.ts
│       │   ├── goal.repository.ts
│       │   ├── receipt.repository.ts
│       │   └── insight.repository.ts
│       ├── schemas/
│       └── types/
├── shared/
│   ├── types/
│   ├── schemas/
│   └── constants/
├── tests/
│   ├── unit/
│   │   ├── finance/
│   │   └── validation/
│   ├── integration/
│   ├── security/
│   └── fixtures/
├── firestore.rules
├── firestore.indexes.json
├── README.md
├── ARCHITECTURE.md
├── TESTING.md
├── DATABASE.md
└── package.json
```

The exact filenames may be adjusted to match the generated starter project, but responsibilities should remain separated. Shared schemas and types should be small and dependency-light so the browser does not import server-only code.

## 4. Frontend architecture

### Application shell

The first UI should establish the product identity and navigation without pretending every page is implemented. The shell contains:

- Responsive sidebar on desktop and compact navigation on smaller screens.
- Sejora wordmark and a clear “portfolio project” boundary in settings/about copy.
- Primary navigation: Dashboard, Transactions, Budgets, Analytics, Goals, Recurring, Receipts, Insights, AI Finance.
- Settings and account menu.
- Route-level loading, empty, unauthorized, and error states.

### Page responsibilities

- `Dashboard`: current financial snapshot, budget health, meaningful trend chart, recent transactions, upcoming payments, health score, and a small prioritized insight list.
- `Transactions`: searchable, filterable, sortable ledger with create/edit/delete and detail review.
- `Budgets`: category/month budgets with deterministic usage, remaining amount, status, and warnings.
- `Analytics`: category breakdown, monthly income/expense, savings trend, merchant concentration, and month-over-month comparisons.
- `Goals`: create and track savings goals with contribution/progress calculations.
- `Recurring`: review predicted recurring payments, confidence, and expected dates.
- `Receipts`: upload, processing, extracted-field review, edit, and confirm flow.
- `Insights`: proactive deterministic-context insights with optional AI explanations.
- `AI Finance`: constrained, read-only natural-language questions about the user’s own calculated financial context.
- Future placeholders should explain what is not available rather than display fake values.

### State and data fetching

The client should use a small API client around `fetch` and feature hooks for loading/error/cache state. It should not import Firestore repositories or calculate authoritative totals locally. Lightweight UI state (dialog visibility, form drafts, filters) can remain in components; server state belongs in feature hooks.

Forms should:

- Validate basic shape client-side for immediate feedback.
- Validate again on the server.
- Use accessible labels, keyboard support, focus management, and confirmation dialogs for destructive actions.
- Show explicit pending and retry states.

Recharts is appropriate for the small set of explanatory charts. Charts should have text summaries or tables so the information is accessible and useful without visual interpretation.

## 5. Backend architecture

### Layers

1. **Routes:** Declare URL/method and attach middleware.
2. **Controllers:** Translate HTTP input/output and delegate to services.
3. **Services:** Orchestrate repositories, finance modules, and AI adapters.
4. **Finance modules:** Pure deterministic calculations, easy to unit test.
5. **Repositories:** The only layer that knows Firestore collection paths and query details.
6. **AI provider:** A replaceable adapter that receives a deliberately small context.
7. **Error middleware:** Converts known errors into safe, consistent responses.

Routes should never contain financial formulas or call Gemini directly. React components should never contain authoritative finance formulas or provider credentials.

### Response envelope

Successful responses should use predictable JSON, for example:

```json
{
  "data": {},
  "meta": { "requestId": "..." }
}
```

Errors should use:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The transaction amount must be greater than zero.",
    "details": {}
  },
  "meta": { "requestId": "..." }
}
```

The public message must be useful without exposing stack traces, tokens, raw model output, or database internals.

## 6. Firestore schema

All user-owned collections are subcollections below the verified user document:

```text
users/{uid}
├── transactions/{transactionId}
├── budgets/{budgetId}
├── goals/{goalId}
├── recurringPayments/{paymentId}
├── receipts/{receiptId}
└── insights/{insightId}
```

### `users/{uid}`

Profile and product preferences only:

```text
displayName
email
currency
timezone
createdAt
updatedAt
```

Firebase Auth remains the identity source. The profile document is not a password store.

### `transactions/{transactionId}`

```text
amountMinor: integer          // positive magnitude in the smallest currency unit
currency: string              // initially INR is supported in the UI
type: "income" | "expense"
merchant: string
category: string
occurredAt: timestamp
paymentMethod?: string
notes?: string
source: "manual" | "receipt"
receiptId?: string
createdAt: timestamp
updatedAt: timestamp
```

Amounts should be stored as integers in minor units to avoid floating-point currency errors. A display formatter converts them to currency strings. The transaction type determines whether an amount contributes to income or expenses; negative magnitudes are rejected for normal entries.

### `budgets/{budgetId}`

```text
name: string
category?: string
period: "monthly"
amountMinor: integer
currency: string
startDate: timestamp
endDate?: timestamp
createdAt: timestamp
updatedAt: timestamp
```

Budget usage is derived from matching expense transactions. It should not be stored as an independently editable total. If a material performance issue appears, a documented server-maintained summary can be added later with a rebuild path.

### `goals/{goalId}`

```text
name: string
targetAmountMinor: integer
currentAmountMinor: integer
currency: "INR"
targetDate: timestamp
category?: string
notes?: string
createdAt: timestamp
updatedAt: timestamp
```

The initial version treats `currentAmountMinor` as an explicit user-managed goal balance. Remaining amount, percentage, and display status are derived on the server; future versions can introduce a separate contribution ledger instead of guessing goal contributions from arbitrary transactions.

### `recurringPayments/{paymentId}`

```text
merchant: string
typicalAmountMinor: integer
currency: string
frequency: "weekly" | "monthly" | "quarterly" | "unknown"
nextExpectedAt?: timestamp
confidence: number
evidenceTransactionIds: string[]
status: "detected" | "confirmed" | "dismissed"
updatedAt: timestamp
```

This is a prediction cache/review record. It is not treated as guaranteed truth and should be recomputable from transactions.

### `receipts/{receiptId}`

```text
status: "uploaded" | "processing" | "review" | "confirmed" | "rejected" | "failed"
storagePath?: string
mimeType: string
extractedData?: object
validationIssues?: string[]
confirmedTransactionId?: string
createdAt: timestamp
updatedAt: timestamp
```

Images should use Firebase Storage only if that service is configured in a later phase. Do not put large image bytes in Firestore.

### `insights/{insightId}`

```text
kind: "spending_pattern" | "budget_risk" | "recurring" | "savings_opportunity" | "anomaly"
title: string
body: string
severity: "info" | "attention" | "warning"
contextVersion: string
source: "deterministic" | "gemini"
metricRefs: object
readAt?: timestamp
expiresAt?: timestamp
createdAt: timestamp
```

`metricRefs` stores trusted source metric identifiers/values needed to explain the insight, not an opaque AI claim. Persisting generated insight text is optional; initial versions can generate insights on demand and persist only user-dismissed/read state.

### Relationships and consistency

- `transactions.receiptId` is an optional reference to a receipt document.
- `receipts.confirmedTransactionId` links back after confirmation.
- Recurring records contain evidence transaction IDs but remain derived predictions.
- Budgets query transactions by user scope, date window, type, and category.
- Goals are independent from the transaction ledger in the first version to avoid assuming how a user earmarks money.
- Server timestamps are used for audit fields.
- Transaction confirmation from a receipt should use a controlled write sequence or Firestore batch so the receipt status and transaction link do not diverge.

### Query/index plan

Likely composite indexes will be added only when a real query requires them, such as:

- `transactions`: `occurredAt` + `type`
- `transactions`: `category` + `occurredAt`
- `transactions`: `merchant` + `occurredAt`
- `budgets`: `period` + `startDate`
- `insights`: `status/readAt` + `createdAt` if read state is modeled

The repository layer should document each index requirement and keep query limits/pagination explicit. Avoid unbounded reads for analytics.

## 7. Authentication and protected access

### Authentication flow

1. The user signs up or signs in using Firebase Authentication.
2. Firebase handles password storage, reset, verification, and session persistence.
3. The client observes Firebase auth state and shows a loading shell while it resolves.
4. A signed-in client obtains an ID token and sends it in the `Authorization` header.
5. Express verifies the token with Firebase Admin.
6. Middleware attaches only verified identity claims to the request context.
7. Protected routes reject missing, invalid, or expired tokens with `401`.
8. The client refreshes the token through the Firebase SDK and retries one request when appropriate.
9. Sign-out clears Firebase client state and returns the user to `/login`.

Protected UI routes should redirect unauthenticated users without rendering private data. The backend remains the actual security boundary.

The first authentication scope includes email/password sign-up, sign-in, sign-out, forgot-password, email verification state, persistent auth state, loading states, and useful error messages. Google sign-in is optional later.

### Ownership model

The server takes `uid` only from verified Firebase credentials. It constructs repository paths from that `uid`. Client-supplied `userId` fields are ignored or rejected. Resource lookups are always scoped under the verified user's path; a foreign resource therefore behaves as not found/unauthorized without revealing its existence.

## 8. REST API endpoint plan

All endpoints below, except health and authentication handled by Firebase client SDK, require Firebase authentication.

### Health

```text
GET /api/health
```

Returns service status and a non-sensitive version/build identifier. It must not expose secrets or database contents.

### Transactions

```text
GET    /api/transactions?from=&to=&type=&category=&q=&sort=&pageToken=
POST   /api/transactions
GET    /api/transactions/:transactionId
PATCH  /api/transactions/:transactionId
DELETE /api/transactions/:transactionId
```

`POST` and `PATCH` validate amounts, dates, categories, enum values, and string lengths. List results are paginated and sorted server-side.

### Budgets

```text
GET    /api/budgets?month=
POST   /api/budgets
PATCH  /api/budgets/:budgetId
DELETE /api/budgets/:budgetId
GET    /api/budgets/summary?month=
```

The summary computes spent, remaining, usage percentage, and a documented status such as healthy, approaching, at-limit, or overspent.

### Analytics and dashboard

```text
GET /api/dashboard?month=
GET /api/analytics/monthly?from=&to=
GET /api/analytics/categories?from=&to=
GET /api/analytics/merchants?from=&to=
GET /api/analytics/patterns?from=&to=
GET /api/analytics/health-score?month=
```

Dashboard data can be aggregated into one read model response for UI efficiency, while the underlying computations remain modular and independently testable.

### Goals

```text
GET    /api/goals
POST   /api/goals
GET    /api/goals/:goalId
PATCH  /api/goals/:goalId
DELETE /api/goals/:goalId
```

The service calculates progress, remaining amount, and required monthly/weekly contribution from target date and current values.

### Recurring and cash flow

```text
GET /api/recurring-payments
PATCH /api/recurring-payments/:paymentId
GET /api/cash-flow/upcoming?days=
GET /api/cash-flow/forecast?month=
```

Detection and forecast responses identify assumptions and confidence rather than presenting certainty.

### Receipts

```text
POST /api/receipts
POST /api/receipts/:receiptId/process
GET  /api/receipts/:receiptId
PATCH /api/receipts/:receiptId/review
POST /api/receipts/:receiptId/confirm
POST /api/receipts/:receiptId/reject
```

Receipt confirmation is the only operation that creates the linked transaction. Processing does not persist unvalidated extracted data as a transaction.

### Insights and AI finance

```text
GET  /api/insights?month=
POST /api/insights/refresh
PATCH /api/insights/:insightId/read
POST /api/ai-finance/ask
POST /api/ai-finance/explain-forecast
POST /api/finance/what-if
```

`/api/finance/what-if` is deterministic and should not require Gemini. AI explanation endpoints are optional enhancements and must degrade to a deterministic explanation when unavailable.

## 9. Deterministic financial engine

The finance layer should use pure functions over typed input objects. No Firestore calls, HTTP requests, or model calls belong inside these functions.

### Core calculations

- `calculateBalance`: income minus expense over a defined period, with a clear opening-balance assumption.
- `calculateIncome`: sum income magnitudes.
- `calculateExpenses`: sum expense magnitudes.
- `calculateSavings`: income minus expenses.
- `calculateSavingsRate`: savings divided by income, with an explicit zero-income result.
- `calculateBudgetUsage`: category/date-matched expenses divided by budget amount.
- `calculateBudgetStatus`: documented thresholds:
  - Healthy: `< 80%`
  - Approaching limit: `80%–99.99%`
  - At limit: `100%`
  - Overspent: `> 100%`
- `calculateGoalProgress`: current divided by target, clamped for display while preserving over-target information.
- `calculateMonthComparison`: current versus previous period with zero-baseline handling.

### Financial health score

The score is a portfolio metric, not professional financial advice. A transparent initial model can be:

```text
savingsScore       = clamp(savingsRate / 0.20, 0, 1) * 30
budgetScore        = adherenceRatio * 25
stabilityScore     = stabilityFactor * 15
recurringScore     = clamp(1 - recurringExpenseRatio / 0.60, 0, 1) * 15
goalScore          = averageGoalProgress * 15
healthScore        = round(sum of components), bounded 0–100
```

Where:

- `adherenceRatio` rewards staying within active budgets and is bounded `0–1`.
- `stabilityFactor` is based on the variation of recent monthly expenses, with insufficient history receiving a neutral documented value.
- `recurringExpenseRatio` is recurring monthly cost divided by monthly income, with no-income handling.
- `averageGoalProgress` is the average active-goal progress, or a neutral value when there are no goals.

The exact constants should be placed in a documented rules module and covered by independent tests. UI copy must say “Sejora financial health metric” and explain the factors.

### Spending patterns

Rule-based patterns can include:

- Weekend expense share versus weekday expense share.
- Category growth compared with the previous month.
- Largest category share of expenses.
- Merchant concentration.
- Spending concentration by day of month.
- Discretionary-category increase.

Each result must include the observed values, comparison window, threshold, and explanation so it can be shown as an explainable finding.

### Anomaly detection

For a transaction or category, use robust, understandable signals:

- Transaction amount above a configured multiple of the user’s historical category median.
- Category period spending above a multiple of its historical average.
- Sudden frequency increase.
- New merchant combined with a large amount.

Return `isAnomaly`, `severity`, `reason`, and the baseline used. This is personal spending anomaly detection, not production fraud detection.

### Recurring-payment detection

Group expense transactions using normalized merchant names and amount tolerance. For each group:

1. Require a minimum number of historical occurrences.
2. Sort dates and calculate intervals.
3. Identify weekly, monthly, or quarterly patterns within tolerance.
4. Calculate typical amount and next expected date.
5. Produce a confidence score from occurrence count, interval regularity, merchant similarity, and amount similarity.

The UI labels results “potential recurring payment” and lets the user confirm or dismiss them.

### Forecasting

The initial forecast is intentionally simple:

- Use the current period’s elapsed days and expense run rate.
- Optionally blend recent completed-month averages when sufficient history exists.
- Project remaining-period expenses.
- Add known confirmed recurring items in the projection window.
- Calculate projected savings and balance from deterministic inputs.

Every forecast response includes:

- Inputs and period.
- Formula/method identifier.
- Assumptions.
- Limitations.
- Confidence or data sufficiency note.

It is not a guaranteed future outcome.

### What-if simulations

Examples:

- Category reduction percentage.
- Additional monthly savings amount.
- Income decrease amount.

The server reads current category spending, validates the scenario bounds, then calculates monthly and annual deltas. For example, category savings are `currentCategoryExpense * reductionRate`, and annual opportunity is the monthly delta multiplied by 12. Gemini may explain the already-calculated result, but cannot change it.

## 10. Analytics and intelligence architecture

Analytics is a service composition over a bounded transaction query:

```text
transaction repository
        ↓
normalized period data
        ↓
finance calculations + intelligence rules
        ↓
dashboard / chart / insight view models
```

The analytics API should provide chart-ready points and textual summaries together. Planned outputs:

- Monthly income versus expenses.
- Savings and savings rate.
- Category breakdown with amount and share.
- Trend over time.
- Top merchants and concentration.
- Budget performance.
- Month-over-month changes.
- Pattern findings.
- Anomalies.

Do not create a visualization unless it answers a financial question. Large datasets should use server-side aggregation and date limits rather than loading the entire history into the browser.

## 11. Receipt scanning architecture

### Workflow

```text
upload image
  → validate mime type/size
  → create receipt record: uploaded
  → store image outside Firestore if Storage is configured
  → mark processing
  → server-side Gemini multimodal extraction
  → parse structured response
  → Zod validation and sanity checks
  → receipt status: review
  → user edits or rejects
  → user confirms
  → create transaction and link receipt
```

### Extracted schema

The first version focuses on expense receipts:

```text
merchant?: string
totalMinor?: integer
currency?: string
occurredAt?: ISO date
categorySuggestion?: string
taxMinor?: integer
discountMinor?: integer
lineItems?: [{ description, quantity?, amountMinor }]
```

Merchant, total, and date may be missing. Missing fields cause a review issue, not an automatic save. Sanity checks verify nonnegative values, line-item consistency where possible, supported currencies, reasonable dates, and total/tax/discount relationships.

### Failure handling

- Poor image: return a reviewable failure with a retry option.
- Missing merchant/date: keep status `review` with highlighted fields.
- Malformed model output: reject it at the schema boundary.
- Gemini unavailable: allow manual transaction creation; do not block the rest of Sejora.
- User rejection: mark receipt rejected without creating a transaction.

The AI result is never directly persisted as a transaction. Confirmation uses the user-approved fields.

## 12. Gemini integration architecture

Gemini calls happen only in server-side `ai` modules. The provider interface should make model replacement possible:

```text
AiProvider
├── extractReceipt(image, schema)
├── explainInsight(context)
├── answerFinanceQuestion(context)
└── explainScenario(context)
```

The Gemini implementation owns SDK configuration, model selection, prompt construction, structured-output configuration, timeout/retry behavior, and provider error mapping. The rest of the application depends on `AiProvider`, not on Gemini-specific imports.

### Context minimization

Before a model call, the server:

1. Classifies the feature and required intent.
2. Queries only the necessary user-scoped records.
3. Performs all arithmetic and comparisons.
4. Builds a small typed context containing trusted metrics, date windows, and relevant labels.
5. Sends concise instructions that say not to invent numbers.

The model never gets Firestore access, arbitrary query execution, credentials, or the entire transaction history by default. Prompts should separate trusted context from user-authored text to reduce prompt injection risk.

### Structured output

For receipt extraction, request the official structured-output format supported by the installed Gemini SDK/model and validate the parsed result with Zod. Unexpected fields can be stripped or rejected according to the schema policy. Model output is untrusted input.

### Graceful degradation

- If no Gemini key is configured, AI sections show an honest “AI enhancement unavailable” state.
- Proactive deterministic insights remain visible.
- Natural-language questions can support a small deterministic intent set with a clear unsupported-question response.
- AI failures are logged with request IDs and provider error categories, never secrets or raw financial payloads.

## 13. AI insight workflow

```text
bounded transaction/budget data
  → deterministic metrics and findings
  → insight candidates with trusted metric references
  → optional Gemini wording/explanation
  → validate response
  → return or persist safe insight
```

Initial candidates:

- Spending pattern: “Food spending increased compared with the previous period.”
- Budget risk: projected category overspend based on deterministic forecast.
- Recurring expense: repeated amount/merchant pattern.
- Savings opportunity: a deterministic reduction scenario.
- Anomaly: transaction/category deviation with baseline.

Gemini is a presentation layer for context, not the candidate generator of financial facts. If it fails, a deterministic template can render the same trusted numbers.

## 14. Natural-language finance workflow

The endpoint should not send a raw question and the whole database to Gemini. Instead:

1. Validate question length and rate-limit the endpoint.
2. Detect a constrained intent using deterministic patterns or a small intent classifier:
   - category total
   - period total
   - biggest expenses
   - month comparison
   - spending increase
   - budget usage
3. Extract category/date parameters and validate them.
4. Query only the relevant user-scoped records.
5. Compute the answer deterministically.
6. Return a structured result with source metrics.
7. Optionally ask Gemini to phrase the result conversationally.
8. If the intent is ambiguous, ask for clarification rather than guessing.

Example:

```text
“How much did I spend on food in the last three months?”
  → intent: category_total
  → category: Food
  → date window: last three calendar months
  → server sum: authoritative amount
  → optional Gemini: concise explanation
```

An empty result is a valid response: “No Food expenses were found in this period.” It is not an excuse for the model to invent a value.

## 15. Security model and Firestore rules

### Application security

- Firebase Authentication handles password storage and reset.
- All private Express routes require a verified Firebase ID token.
- User identity comes from verified claims, never request body/path ownership fields.
- Every repository path is built from the verified `uid`.
- Zod validates all external input.
- Amounts, date ranges, enum values, pagination sizes, uploads, and question lengths have limits.
- Use HTTPS in deployed environments and secure CORS configuration.
- Apply request body size limits and rate limits, especially to receipt and AI endpoints.
- Redact authorization headers, tokens, images, and unnecessary financial details from logs.
- Keep Gemini credentials server-side in Replit Secrets.
- Do not include server-only environment variables in Vite client bundles.

### Firestore rules strategy

The preferred architecture is backend-only Firestore data access through the Admin SDK. Because Admin SDK access bypasses Firestore client rules, the server’s verified-token and user-scoped repository checks are the primary authorization controls.

Client-side Firestore access should be disabled for private collections. Rules should:

- Deny by default.
- Allow only explicitly safe profile reads/writes if the design ever needs them directly.
- Require `request.auth.uid == userId` for any permitted user document path.
- Never allow one user to read another user’s subcollections.
- Validate immutable ownership fields if any document is written directly.
- Avoid trusting client-supplied ownership fields.

Rules should be tested in the Firebase emulator where feasible, while API authorization tests verify the server path because Admin SDK operations do not exercise Firestore rules.

### Security cases to verify

- Unauthenticated protected-page access.
- Missing, expired, or malformed bearer token.
- User A attempting to use User B’s resource ID.
- User A attempting to submit User B’s `userId`.
- Unauthorized receipt confirmation.
- Malformed request and oversized upload.
- Gemini key absent from client bundle.
- Sensitive data absent from logs.

## 16. Testing strategy

Testing is part of each phase, not a final cleanup step. The exact test runner should follow the starter setup, but the test suite should separate pure unit tests from API, security, and UI checks.

### Unit tests

Cover:

- balance, income, expenses, savings, and savings rate
- budget usage/status boundaries at 0%, 80%, 100%, and over 100%
- health-score components and zero-data behavior
- date windows and month boundaries
- spending-pattern thresholds
- anomaly baselines and missing history
- recurring interval/amount tolerance
- forecast assumptions and partial-month calculations
- what-if reductions/income changes
- goal progress and required contributions
- transaction and receipt Zod schemas

Test normal, empty, invalid, negative, very large, conflicting, missing-optional-field, and boundary inputs.

### API integration tests

Use an emulator or repository test double—not production data—to verify:

- authenticated CRUD flows
- pagination/filter/sort behavior
- validation errors
- not-found behavior
- budget summaries after transaction changes
- receipt review/confirm flow
- deterministic analytics and what-if endpoints
- AI-disabled fallback behavior

### Security tests

Verify:

- missing and invalid authentication are rejected
- manipulated user IDs do not alter the verified owner
- cross-user reads/updates/deletes fail
- resource IDs cannot escape the user path
- Firestore emulator rules enforce ownership
- server logs and built client assets contain no secrets

### AI contract/failure tests

Mock the provider boundary to test:

- valid receipt output
- poor-quality receipt
- missing merchant/date
- incorrect types
- malformed structured output
- user edit/reject before confirmation
- provider timeout/failure/rate limit
- normal financial question
- no matching data
- ambiguous question
- unusual metric values
- malformed explanation response

Do not claim a live Gemini integration is verified without a real configured test request. A provider mock verifies application behavior, not external credentials or model availability.

### UI verification

For implemented flows, verify through the actual preview:

- auth loading/error/protected redirects
- transaction create/edit/delete
- budget status changes after transactions
- chart/table empty states
- receipt review before confirm
- responsive navigation
- keyboard and focus behavior
- browser console errors

Each phase report should list tests performed, passed, failed, bugs found/fixed, limitations, and anything not verified.

## 17. Error-handling strategy

Use typed application errors with safe public codes:

```text
VALIDATION_ERROR       400
UNAUTHENTICATED        401
FORBIDDEN              403
NOT_FOUND              404
CONFLICT               409
RATE_LIMITED           429
PROVIDER_UNAVAILABLE   503
INTERNAL_ERROR         500
```

Rules:

- Handle expected errors at the service boundary.
- Convert Firestore errors into safe domain errors.
- Return a request ID for support/debug correlation.
- Log server-side with structured metadata, but redact credentials and unnecessary financial content.
- Use bounded retries only for transient provider/network failures.
- Do not retry validation, authorization, or malformed model responses.
- Show recovery options: retry, edit manually, reload, or continue without AI.
- Avoid silent fallback when a calculation cannot be trusted; show a data-sufficiency message.

## 18. Services, credentials, and environment variables

### Services/accounts needed

1. Firebase project with Authentication enabled.
2. Cloud Firestore database.
3. Optionally Firebase Storage for receipt images.
4. Google Gemini API access for AI-only features.
5. Replit deployment for hosting.

No service should be assumed to exist merely because the application has code for it.

### Client-safe Firebase configuration

Firebase web configuration values are designed to identify a Firebase project and may be exposed to the browser, but they still belong in environment configuration rather than hardcoded source:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

These values are not substitutes for Firestore rules or server authorization.

### Server-only variables

```text
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
GEMINI_API_KEY                 # optional until AI features are enabled
SESSION_SECRET                 # only if a server session/cookie layer is later chosen
```

The private key, Gemini key, and session secret belong in Replit Secrets and must never be committed, logged, sent to the client, or placed in a `VITE_` variable. The exact Firebase Admin credential format should be verified against the installed SDK and current Firebase documentation before implementation.

### Credential boundary decision

The initial design uses Firebase ID tokens and server verification rather than custom sessions. `SESSION_SECRET` is therefore not required for the first authentication implementation unless a later decision introduces server-managed session cookies. This avoids inventing a second auth mechanism.

## 19. Dependency/package plan

Use the requested stack with the smallest practical dependency set:

### Client

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui primitives
- Recharts
- Firebase web SDK
- Zod (shared request/form schemas where useful)

### Server

- Node.js
- Express
- TypeScript
- Firebase Admin SDK
- Zod
- Gemini’s official current SDK, after verifying the installed/current API

### Development/testing

- TypeScript compiler
- A lightweight test runner compatible with the starter project
- Supertest or equivalent only if needed for Express endpoint tests
- Firebase Emulator Suite only if it can be configured without obscuring the core architecture

Do not add PostgreSQL, Prisma, Supabase, an ORM, Redis, Kafka, Kubernetes, Docker, GraphQL, LangChain, a vector database, or another framework without a demonstrated requirement and an explicit architecture update.

## 20. Development phases and checkpoints

The project should be built incrementally. After each phase, stop, report the implementation and actual tests, document limitations, and wait for explicit confirmation before continuing.

### Phase 1 — Foundation, architecture, and UI shell

Create the React/Vite/Tailwind shell, Express health endpoint, shared types, navigation, route placeholders, core error/loading/empty states, and documentation skeleton. No fake data should be presented as real financial history.

### Phase 2 — Firebase Authentication

Implement sign-up, sign-in, sign-out, reset, verification state, persistence, protected UI routes, bearer-token middleware, and auth error states.

### Phase 3 — Firestore data model and transactions

Configure Firestore access, repository boundaries, transaction schemas, user-scoped CRUD, pagination/filtering/sorting, ownership tests, and Firestore rules strategy.

### Phase 4 — Budgets and financial calculations

Implement budgets, usage/status calculations, deterministic core modules, and independent unit tests.

### Phase 5 — Dashboard and analytics

Build dashboard summaries, charts, category/month/merchant analytics, meaningful empty states, and data-range handling.

### Phase 6 — Spending intelligence

Add explainable spending patterns, anomalies, recurring-payment detection, review states, and tests for thresholds/tolerance.

### Phase 7 — Health, goals, and upcoming cash flow

Implement the documented deterministic health score, explicit user-managed goals, and upcoming recurring expense views. Do not create future transactions or introduce forecasting until a later phase.

### Phase 8 — Receipt scanning

Add secure receipt upload/storage, processing states, provider adapter, structured extraction validation, review/edit, rejection, and confirmation-to-transaction flow.

### Phase 9 — Forecasting and what-if

Add deterministic forecasts, assumptions/limitations, scenario validation, and numerical tests. Keep the numerical result independent from Gemini.

### Phase 10 — AI insights

Add bounded insight context, deterministic candidates, optional Gemini wording, fallbacks, persistence/read state if needed, and provider failure tests.

### Phase 11 — Natural-language finance questions (implemented)

Add constrained intent handling, minimal data retrieval, deterministic answers, optional AI intent parsing, ambiguity handling, and safe provider failures. Do not add conversation memory or mutation commands.

### Phase 12 — Security hardening, testing, and error handling

Complete authorization matrices, emulator rules tests, malformed-request tests, secret-bundle checks, provider failures, logging review, and regression coverage.

### Phase 13 — UI polish, performance, deployment, and documentation

Improve responsive/accessibility details, pagination and query efficiency, final README/architecture/testing/database docs, deployment configuration, and final verification. Deployment is not assumed until explicitly configured and tested.

## 21. Major feature interaction

```text
manual transaction ───────────────┐
                                  v
receipt → review → confirmed transaction
                                  │
             ┌────────────────────┼─────────────────────┐
             v                    v                     v
       budget usage          analytics              ledger history
             │                    │                     │
             v                    v                     ├── anomaly rules
       budget risk          patterns/compare            ├── recurring detection
             │                    │                     ├── forecasts
             └──────────────┬─────┘                     └── health score
                            v
                    structured insight context
                            │
                 optional Gemini explanation
                            │
                            v
                    user insight / action
```

Goals consume the same trusted financial metrics while their current balances remain explicit user-managed values. Upcoming cash flow consumes derived recurring predictions only; it does not require confirmed predictions, forecast assumptions, or future transaction writes. Every feature should be traceable back to source transactions and documented rules.

## 22. Deterministic versus AI-powered responsibilities

| Responsibility | Deterministic application logic | Gemini/AI |
|---|---:|---:|
| Authentication and authorization | Yes | No |
| CRUD and Firestore access | Yes | No |
| Balance, income, expenses, savings | Yes | No |
| Budget usage and warning thresholds | Yes | No |
| Health-score number and factors | Yes | No |
| Category/month/merchant analytics | Yes | No |
| Pattern and anomaly signals | Yes | No |
| Recurring-payment prediction | Yes | No |
| Forecast and what-if numbers | Yes | No |
| Receipt image understanding | Supporting role | Yes |
| Receipt structured field extraction | Validation authority | Yes, untrusted output |
| Insight candidate generation | Yes | No |
| Insight wording/explanation | Fallback available | Optional |
| Natural-language intent/data retrieval | Yes | Optional classifier/phrasing |
| Financial numerical answer | Yes | No |
| Financial explanation and summary | Fallback available | Optional |

## 23. Architectural risks and mitigations

### Missing external credentials

**Risk:** Firebase or Gemini configuration is unavailable.  
**Mitigation:** Separate configuration validation from startup where possible; keep deterministic features usable; show actionable setup errors; never create fake credentials.

### Firestore query cost and unbounded history

**Risk:** Analytics loads too many documents or repeats expensive reads.  
**Mitigation:** bounded date windows, pagination, server aggregation, composite indexes, and later documented summary materialization only if measurements justify it.

### Floating-point currency errors

**Risk:** Decimal arithmetic causes off-by-one display/calculation errors.  
**Mitigation:** store and calculate integer minor units; test large values and currency formatting.

### AI hallucination or malformed output

**Risk:** Model invents numbers or returns invalid receipt data.  
**Mitigation:** deterministic context, structured output, Zod validation, sanity checks, source metric references, confirmation gate, and fallback templates.

### Prompt injection through notes or merchant text

**Risk:** User-controlled financial text attempts to alter model behavior.  
**Mitigation:** minimize context, delimit untrusted fields, give strict system instructions, never grant tools/database access, and treat output as untrusted.

### Recurring detection false positives

**Risk:** Similar purchases are mislabeled subscriptions.  
**Mitigation:** minimum evidence, amount/interval tolerance, confidence display, review/dismiss states, and “potential” wording.

### Forecast overconfidence

**Risk:** Users interpret a simple run-rate projection as a guarantee.  
**Mitigation:** show assumptions, data sufficiency, method, limitations, and uncertainty language.

### Overbuilding the first release

**Risk:** Too many features reduce reliability and explainability.  
**Mitigation:** phase checkpoints, one source of truth, pure finance modules, no unnecessary infrastructure, and no automatic progression between phases.

## 24. Important tradeoffs and decisions needing approval

1. **Backend-only Firestore access vs direct client Firestore access:** Backend-only is preferred for consistent authorization and centralized business logic, at the cost of extra API plumbing.
2. **Firebase ID tokens vs server session cookies:** ID tokens are simpler and align directly with Firebase Auth. Session cookies can be considered later for web-specific session behavior; they are not needed initially.
3. **Goal balance model:** Initial goals use an explicit current amount. A future contribution ledger would be more auditable but adds another domain model.
4. **Derived versus stored analytics:** Initial analytics are computed from transactions to avoid stale duplicated totals. Summary documents can be added only after measuring a performance need.
5. **Gemini optionality:** AI is an enhancement and should be disabled cleanly without blocking the ledger, budgets, analytics, or deterministic insights.
6. **Receipt image storage:** Firebase Storage is preferred for images, but it is a separate service/configuration requirement and should not be faked if unavailable.
7. **Currency scope:** Start with one clearly supported display currency, likely INR based on the product examples, while storing currency on records so multi-currency support can be added deliberately later.
8. **Health score constants:** The weights and thresholds must be written down and tested, then treated as a portfolio metric rather than a claim of professional financial assessment.

Before Phase 1, the key decisions to approve are the backend-only Firestore access model, the initial currency scope, whether Firebase Storage is included in the first receipt phase, and whether AI credentials will be configured immediately or after deterministic features are complete.

## 25. Documentation deliverables

The final project should contain:

- `README.md`: overview, features, setup, scripts, environment variables, limitations, and phase status.
- `ARCHITECTURE.md`: concise implementation architecture linked to this planning document.
- `TESTING.md`: commands, test layers, security matrix, emulator notes, and verified/untested areas.
- `DATABASE.md`: schema, ownership, indexes, consistency, and rules strategy.
- Optional `API.md`: endpoint contracts and example safe responses.

Documentation must describe only implemented/verified behavior and must not claim real banking connectivity, fraud detection, professional advice, model retraining, or production banking infrastructure unless those capabilities are actually built and tested.

## 26. Implemented Phase 6 alignment

The current implementation follows the planned backend-only, deterministic finance architecture:

- `shared/finance/intelligence.ts` contains pure spending-insight, anomaly, and recurring-pattern rules.
- `server/src/intelligence/` owns authenticated orchestration and bounded transaction reads.
- `/api/insights` returns monthly spending observations and integrated unusual-spending signals.
- `/api/recurring-payments` returns derived recurring-looking expense patterns without persistence.
- Both routes use the verified UID and the existing transaction repository; no intelligence collection or duplicated ledger is introduced.
- Phase 6 thresholds and minimum-data requirements are documented in `README.md` and `DATABASE.md`.

Phase 7 health/goals/cash-flow, Phase 8 receipt scanning, Phase 9 deterministic forecasting/what-if behavior, Phase 10 on-demand AI insights, and Phase 11 read-only natural-language financial questions are implemented and documented in `README.md` and `DATABASE.md`. Phase 11 translates supported questions into validated intents and executes them against authenticated server-side data; Gemini does not calculate financial truth. Chat memory, mutation commands, and later phases remain deferred.
