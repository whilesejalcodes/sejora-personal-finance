# API reference

All routes use the `/api` prefix. The browser sends root-relative requests to the current origin. Every route except `GET /api/health` requires a Firebase ID token in `Authorization: Bearer <token>` and a verified email.

Successful JSON responses use `{ "data": ... }`, except successful DELETE requests, which return `204 No Content`. Request objects are strict: unknown fields are rejected. Dates use `YYYY-MM-DD`; calendar months use `YYYY-MM`. Money values are integer paise (`amountMinor`) and currency is `INR`.

## Health and authentication

| Method and path | Auth | Request | Success |
|---|---|---|---|
| `GET /api/health` | Public | None | `200 {data:{status:"ok",service:"sejora-api",phase:"foundation"}}`. Liveness only; does not probe Firebase or Gemini. |
| `GET /api/auth/me` | Required | None | `200 {data:{uid,email,emailVerified}}` for the verified token. |

## Transactions

| Method and path | Auth | Request | Success |
|---|---|---|---|
| `GET /api/transactions` | Required | Query: `pageSize` integer 0–50 (default 20), `pageToken` string up to 2,000 chars, `from`/`to` dates, `type=income\|expense`, `category` up to 80 chars, `paymentMethod` up to 60 chars, `q` up to 100 chars, `minAmountMinor`/`maxAmountMinor` nonnegative integers up to 9,999,999,999, `sort=newest\|oldest\|amountAsc\|amountDesc` (default `newest`). Date bounds and amount bounds must be ordered correctly. | `200 {data:{items,nextCursor,hasNextPage}}` |
| `POST /api/transactions` | Required | JSON: required `amountMinor` positive integer up to 9,999,999,999, `type`, trimmed `merchant` (1–120 chars), `occurredAt`; optional trimmed `category` (up to 80 chars), `paymentMethod` (up to 60 chars), `notes` (up to 1,000 chars), `receiptId` (1–200 chars), `source=manual\|receipt`. Expense requires a category. | `201 {data:TransactionRecord}` |
| `GET /api/transactions/:id` | Required | ID: 1–150 characters, letters, digits, underscore, or hyphen. | `200 {data:TransactionRecord}` |
| `PATCH /api/transactions/:id` | Required | Same ID; nonempty partial transaction JSON. `source` is not accepted for updates. The merged transaction is revalidated. | `200 {data:TransactionRecord}` |
| `DELETE /api/transactions/:id` | Required | Same ID. | `204`, empty body |

`TransactionRecord` includes `id`, `amountMinor`, `currency`, `type`, `merchant`, optional `category`, `occurredAt`, optional payment/notes/receipt metadata, `source`, `createdAt`, and `updatedAt`. List filters include date, type, exact category/payment method, text `q` over merchant/category/notes, amount range, and sort.

## Budgets

| Method and path | Auth | Request | Success |
|---|---|---|---|
| `GET /api/budgets` | Required | Optional `month=YYYY-MM`. | `200 {data:{items:BudgetView[]}}` |
| `POST /api/budgets` | Required | JSON: trimmed `name` (1–120 chars), positive `amountMinor` up to 9,999,999,999, `period:"monthly"`, `startDate`; optional trimmed `category` (1–80 chars), `endDate` (not before start). | `201 {data:BudgetView}` |
| `GET /api/budgets/:id` | Required | Validated ID. | `200 {data:BudgetView}` |
| `PATCH /api/budgets/:id` | Required | Validated ID; nonempty partial budget JSON. | `200 {data:BudgetView}` |
| `DELETE /api/budgets/:id` | Required | Validated ID. | `204`, empty body |

`BudgetView` contains the stored budget fields plus server-derived `spentMinor`, `remainingMinor`, `usagePercent`, and status.

## Dashboard and analytics

| Method and path | Auth | Request | Success |
|---|---|---|---|
| `GET /api/dashboard` | Required | Optional `month=YYYY-MM`; defaults to current UTC month. | `200 {data:DashboardData}` |
| `GET /api/analytics` | Required | Optional paired `from`/`to=YYYY-MM`; both are required together, ordered, and limited to 12 inclusive months. Defaults to the latest six months. | `200 {data:AnalyticsData}` |

Dashboard data includes period totals, spending by category, budgets, the latest five transactions, and metadata. Analytics includes period totals, monthly points, spending by category, budgets, and metadata. Both are read-only server calculations.

## Intelligence and AI insights

| Method and path | Auth | Request | Success |
|---|---|---|---|
| `GET /api/insights` | Required | Optional `month=YYYY-MM`; defaults to current UTC month. | `200 {data:InsightsData}` |
| `GET /api/recurring-payments` | Required | Optional paired `from`/`to=YYYY-MM`, at most 12 inclusive months; defaults to the current and prior 11 months. | `200 {data:RecurringPaymentsData}` |
| `POST /api/insights/ai` | Required; AI rate guard | Optional `month=YYYY-MM`; no body. | `200 {data:AiInsightsData}` with status, disclosure, validated insights, supporting facts, and metadata. |

`GET /api/insights` and recurring-payment results are derived from transactions and are not persisted. AI Insights uses Gemini only after deriving server-owned facts; output is validated and is not persisted.

## Goals, health, and cash flow

| Method and path | Auth | Request | Success |
|---|---|---|---|
| `GET /api/goals` | Required | No query fields. | `200 {data:{items:GoalView[]}}` |
| `POST /api/goals` | Required | JSON: trimmed `name` (1–120 chars), positive `targetAmountMinor` and nonnegative `currentAmountMinor` up to 9,999,999,999 (current cannot exceed target), `targetDate`; optional `category` (up to 80 chars), `notes` (up to 1,000 chars). | `201 {data:GoalView}` |
| `GET /api/goals/:id` | Required | Validated ID. | `200 {data:GoalView}` |
| `PATCH /api/goals/:id` | Required | Validated ID; nonempty partial goal JSON, merged and revalidated. | `200 {data:GoalView}` |
| `DELETE /api/goals/:id` | Required | Validated ID. | `204`, empty body |
| `GET /api/financial-health` | Required | Optional `month=YYYY-MM`; defaults to current UTC month. | `200 {data:FinancialHealthData}` |
| `GET /api/cash-flow/upcoming` | Required | Optional paired `from`/`to=YYYY-MM-DD`, ordered, at most 31 inclusive days; defaults to today through 30 days ahead. | `200 {data:UpcomingCashFlowData}` |

`GoalView` includes server-derived remaining amount, percentage complete, and status. Financial health and cash flow are derived responses; they do not create stored records.

## Forecasting

| Method and path | Auth | Request | Success |
|---|---|---|---|
| `GET /api/forecast` | Required | Optional `horizon=1\|3\|6`, default 3. | `200 {data:ForecastData}` |
| `POST /api/forecast/simulate` | Required | JSON: optional `horizon=1\|3\|6` (default 3), finite `incomeAdjustmentPercent` and `expenseAdjustmentPercent` (-100 to 500, default 0), `oneTimeExpenseMinor` (nonnegative integer up to 9,999,999,999, default 0), optional `savingsTargetMinor` (nonnegative integer up to 9,999,999,999). | `200 {data:ForecastSimulationData}` |

Forecasts and simulations are read-only calculations; the simulation does not write financial records.

## Receipt scan and AI Finance

| Method and path | Auth | Request | Success |
|---|---|---|---|
| `POST /api/receipts/scan` | Required; max 4 requests/minute, 2 concurrent | `multipart/form-data`, one file field named `receipt`; JPEG, PNG, or WebP; maximum 5 MiB. At most four non-file fields are accepted but unused. File signature and image dimensions are validated. | `200 {data:{extraction,reviewMessage}}`; extraction contains candidate transaction fields and `needsReview`. No file is persisted and no transaction is created by this endpoint. |
| `POST /api/ai-finance/questions` | Required; max 20 requests/minute, 2 concurrent | Strict JSON `{ "question": "..." }`, trimmed length 1–500. | `200 {data:FinanceQuestionData}` with question, status, answer, optional intent/result, supporting facts, disclosure, and `usedAi`. |

`POST /api/insights/ai` allows up to six requests per minute and two concurrent requests per process.

AI Finance is read-only. Gemini may classify an intent, but the server computes all financial values from the verified user's data.

## Common errors

Except for the direct unknown-route response, errors use:

```json
{"error":{"code":"CODE","message":"safe message","details":[{"path":[],"message":"..."}]}}
```

`details` is omitted when not applicable.

| Status | Code | Common cause |
|---:|---|---|
| 400 | `VALIDATION_ERROR` | Invalid body, query, path, JSON, or cursor. |
| 400 | `RECEIPT_UPLOAD_INVALID` | Unsupported or invalid receipt upload. |
| 401 | `AUTHENTICATION_REQUIRED` | Missing, malformed, or invalid Firebase Bearer token. |
| 403 | `EMAIL_VERIFICATION_REQUIRED` | Token is valid but email is not verified. |
| 404 | `RESOURCE_NOT_FOUND` | Transaction, budget, or goal does not exist. |
| 404 | `NOT_FOUND` | Unknown `/api/*` path; direct `{error:{code,message}}` response. |
| 413 | `REQUEST_TOO_LARGE` | JSON body exceeds 1 MiB. |
| 429 | `RATE_LIMITED` | Receipt/AI in-memory request or concurrency guard exceeded. |
| 500 | `INTERNAL_ERROR` | Unexpected server error. |
| 502 | `RECEIPT_EXTRACTION_INVALID`, `AI_INSIGHTS_EXTRACTION_INVALID`, `AI_FINANCE_EXTRACTION_INVALID` | Gemini response cannot be parsed or validated. |
| 503 | `AUTHENTICATION_UNAVAILABLE` | Firebase Admin configuration is incomplete. |
| 503 | `FIRESTORE_ERROR` | Firestore-backed repository operation failed. |
| 503 | `RECEIPT_PROVIDER_ERROR`, `AI_INSIGHTS_PROVIDER_ERROR`, `AI_FINANCE_PROVIDER_ERROR` | Gemini is not configured, unavailable, or timed out. |

The receipt-upload and unknown-route codes are emitted by current source but are not included in the declared `ApiErrorCode` TypeScript union.