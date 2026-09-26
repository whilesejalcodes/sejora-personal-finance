# Sejora database and derived analytics

## Firestore structure

Transactions are stored in a user-scoped subcollection:

```text
users/{uid}/transactions/{transactionId}
```

The `uid` is always derived from the verified Firebase ID token on the server. The client cannot choose the owner path.

## Transaction schema

```text
amountMinor: integer
currency: "INR"
type: "income" | "expense"
merchant: string
category: string
occurredAt: Firestore Timestamp
paymentMethod?: string
notes?: string
source: "manual" | "receipt"
receiptId?: string
createdAt: Firestore Timestamp
updatedAt: Firestore Timestamp
```

The initial UI creates `source: "manual"` records. `receiptId` is reserved for the later receipt workflow and is not created by this phase's UI.

## Money representation

Money is stored as a positive integer number of paise in `amountMinor`. For example, ₹1,240.50 is stored as `124050`. The transaction `type` determines whether the amount is income or expense; negative magnitudes are rejected.

The API accepts `amountMinor` and the UI converts a rupee amount string into integer paise before submission. Display uses the existing `formatCurrency` helper with Indian locale formatting and the INR symbol.

No balance, savings rate, health score, budget usage, or other derived financial value is stored on a transaction.

## Budgets

Budgets are stored under the same verified-user boundary:

```text
users/{uid}/budgets/{budgetId}
```

The persisted budget schema is:

```text
name: string
category?: string
amountMinor: integer
currency: "INR"
period: "monthly"
startDate: Firestore Timestamp
endDate?: Firestore Timestamp
createdAt: Firestore Timestamp
updatedAt: Firestore Timestamp
```

`amountMinor` is a positive integer number of paise. The API owns the budget ID, currency, and audit timestamps. A monthly budget created without an end date is normalized to the last day of the month containing `startDate`.

Budget usage is never stored as an independently editable total. For each budget, the service queries the existing transaction repository within the budget date window, restricts the source data to `type: "expense"`, and applies an exact category match when the budget has a category. Income, other categories, and transactions outside the inclusive date boundaries do not count.

The deterministic calculation engine returns:

```text
spentMinor       = sum of matching expense amountMinor values
remainingMinor   = amountMinor - spentMinor
usagePercent     = rounded to two decimal places
status           = healthy | approaching | at_limit | overspent
```

Status thresholds are intentionally simple:

- `< 80%`: Healthy
- `80%` through `< 100%`: Approaching limit
- `100%`: At limit
- `> 100%`: Overspent

The UI caps the progress bar visually at 100% while retaining the negative remaining amount and overspent status.

All budget reads and writes are scoped to the verified UID. The budget list is limited to 100 records and the transaction source query retains the existing bounded transaction-list behavior. No separate spending ledger, background event system, or AI calculation is introduced.

## Goals

Goals are stored in a verified-user subcollection:

```text
users/{uid}/goals/{goalId}
```

The persisted schema is:

```text
name: string
targetAmountMinor: integer
currentAmountMinor: integer
currency: "INR"
targetDate: Firestore Timestamp
category?: string
notes?: string
createdAt: Firestore Timestamp
updatedAt: Firestore Timestamp
```

Target and current amounts are positive/non-negative integer paise values. The API owns the goal ID, currency, timestamps, and owner path. Current amount cannot exceed target amount. The server derives `remainingAmountMinor`, `percentageComplete`, and a display status; these values are not stored as editable fields.

Budget list filtering by `month` is an overlap check against the budget's stored date window. The current list query uses Firestore's single-field `startDate` ordering; `firestore.indexes.json` contains no composite indexes because the API's filtered transaction path is bounded and does not require them.

## Ownership and authorization

Every transaction endpoint uses the existing Firebase Admin token middleware. The repository receives only the verified `uid` and constructs:

```text
users/{verifiedUid}/transactions
```

The API rejects unknown request fields, never accepts an owner UID, and never queries a global transaction collection. Firestore Admin SDK requests bypass Firestore Rules, so the verified-UID repository path is the backend authorization boundary.

`firestore.rules` denies direct client access to private transaction, budget, and goal collections. Sejora intentionally uses the server-only Firebase Admin SDK repositories for these records; Admin SDK operations bypass Firestore Rules, so the verified-token middleware and UID-scoped repository path remain the application authorization boundary. All other document paths are denied as well.

## API shape

Successful responses use:

```json
{ "data": {} }
```

List responses use:

```json
{
  "data": {
    "items": [],
    "nextCursor": "opaque-cursor-or-null",
    "hasNextPage": false
  }
}
```

The cursor is an opaque server-generated Firestore cursor. Clients must send it back unchanged as `pageToken`.

## Validation

Zod validates request bodies, route IDs, and query parameters. Create and update requests are strict objects; arbitrary fields are rejected. The server owns the transaction ID, source, owner context, created timestamp, and updated timestamp.

Supported transaction types are `income` and `expense`. Currency is fixed to `INR` in this initial phase.

## Pagination

Normal list requests use Firestore cursor pagination with a maximum page size of 50. The repository orders by either `occurredAt` or `amountMinor`, adds a document-ID tie breaker, and uses `startAfter`.

Search and every filtered list query use a deterministic, bounded Phase 3 fallback because Firestore does not provide general full-text search and each filter/sort combination can require another composite index. A UID-scoped, ordered query scans at most 500 documents, then applies date, amount, type, category, payment-method, and text filters in memory. Results are still paged from that bounded set; a dedicated search service is intentionally out of scope.

## Filtering, sorting, and search

Supported filters:

- `from` and `to` date-only boundaries
- `type`
- exact `category`
- exact `paymentMethod`
- `minAmountMinor` and `maxAmountMinor`
- `q` over merchant, category, and notes

Supported sort values:

- `newest`
- `oldest`
- `amountAsc`
- `amountDesc`

Firestore automatically maintains the single-field indexes needed by the unfiltered ordered scan. The current bounded filtered path does not require composite indexes, so `firestore.indexes.json` intentionally contains none. If the bounded limit is ever removed or filters move into Firestore, add and deploy the specific composite index for that query shape rather than introducing a global or unbounded read.

## Error handling

The API exposes safe codes:

- `AUTHENTICATION_REQUIRED`
- `AUTHENTICATION_UNAVAILABLE`
- `VALIDATION_ERROR`
- `RESOURCE_NOT_FOUND`
- `FIRESTORE_ERROR`
- `INTERNAL_ERROR`

Firestore exceptions and stack traces are not returned to clients.

## Testing

The transaction API tests use an in-memory repository and injected token verifier. They exercise API behavior, validation, user scoping, CRUD, pagination, filtering, sorting, and cross-user isolation without claiming to be Firestore Emulator or production Firestore tests.

No Firestore Emulator is configured in this workspace, so Firestore Security Rules and live Firestore persistence remain explicitly unverified until an emulator or deployed Firestore test environment is provided.

## Dashboard and analytics

Phase 5 adds two authenticated, read-only derived views:

```text
GET /api/dashboard?month=YYYY-MM
GET /api/analytics?from=YYYY-MM&to=YYYY-MM
```

Both endpoints derive their user scope exclusively from the verified Firebase UID. They do not accept a client-supplied owner ID and do not write data.

The dashboard defaults to the current month and returns:

- selected date range
- income, expenses, balance, savings, and savings rate
- spending totals by expense category
- selected-month budget views using the existing budget calculation engine
- the latest five transactions in the selected month
- transaction-count metadata

The analytics endpoint defaults to the latest six months, including the current month. The maximum range is twelve inclusive calendar months. It returns:

- total income, expenses, net flow, savings, and savings rate
- one monthly point for every month in the requested range, including empty months
- monthly income, expense, net-flow, and transaction-count values
- expense-category totals and percentages
- budget-versus-actual views for budgets overlapping the requested range
- transaction-count metadata

For both views:

```text
balance = income - expenses
savings = income - expenses
savingsRate = savings / income * 100 when income > 0
savingsRate = unavailable when income = 0
```

These values are calculated in integer paise/minor units. The UI converts to INR strings only at the display boundary. Transaction dates are date-oriented values; month grouping uses the intended `occurredAt` date rather than browser-local timezone conversion.

Analytics reads are server-side and bounded. The Firestore repository uses a UID-scoped date-oriented query and pages results before aggregation. The service rejects ranges containing more than 10,000 transactions instead of silently returning partial totals. The existing transaction list endpoint's 500-record filtered fallback is not used as a complete analytics dataset.

No analytics collection or persisted aggregate is introduced. Dashboard and analytics values are recomputed from the current transactions and budgets, so transaction edits and deletions are reflected on the next read.

## Phase 6 deterministic intelligence

Phase 6 uses the same `users/{uid}/transactions` source of truth. It adds no Firestore collection, no duplicate history, and no writes:

```text
GET /api/insights?month=YYYY-MM
GET /api/recurring-payments?from=YYYY-MM&to=YYYY-MM
```

Both routes require Firebase authentication and derive ownership only from the verified UID. Month and range parameters use the existing strict `YYYY-MM` validation; recurring-payment ranges are limited to twelve inclusive months.

### Spending insights

The Insights service reads a selected focus month, the immediately previous month for comparison, and the prior twelve months for anomaly baselines. It returns structured observations rather than persisted text:

- **Largest category:** the expense category with the highest total in the focus month.
- **Largest expense:** the highest individual expense, with deterministic date and ID tie-breakers.
- **Category change:** only when both months contain at least two expense entries, the relative change is at least 20%, and the absolute difference is at least ₹500.
- **Spending concentration:** only when at least three categories exist and the top two represent at least 70% of expenses.
- **High frequency:** only when the focus month has at least five expenses and one category appears at least four times.

Income is excluded from all expense intelligence. Legacy expenses without a category are represented as `Uncategorized` for Phase 6 observations; income without a category is never assigned a synthetic category.

### Unusual-spending methodology

Anomaly detection is intentionally conservative and user-relative:

- Fewer than five historical expenses produce no anomaly flags.
- With at least three historical expenses in the same category, a focus expense is flagged when it is at least twice that category's historical average and at least ₹500 higher.
- Otherwise, the overall baseline can flag an expense when it is at least three times the historical expense average and at least ₹1,000 higher.
- The baseline contains only transactions before the focus month, so the current expense does not inflate its own comparison.

Each anomaly includes the transaction ID, amount, merchant, category, date, signal type, baseline average, and baseline count so the UI can explain why it was shown. The product uses “unusual spending” wording and does not claim fraud detection.

### Recurring-payment methodology

Recurring detection reads a bounded expense window and groups merchants after trimming, lowercasing, and collapsing whitespace. A group needs at least three observations. Every consecutive interval must fit one supported pattern:

- weekly: 6–8 days
- monthly: 27–33 days
- quarterly: 80–100 days

Intervals must have a small deterministic spread, and every amount must be within 15% of the group's median amount with a minimum ₹1 tolerance. The response includes the representative merchant, category when consistent, median typical amount, frequency, last occurrence, next expected date, occurrence count, interval length, and confidence. Confidence is a bounded deterministic evidence indicator, not a probability or guarantee.

### Phase 6 bounds

All intelligence reads use UID-scoped pagination with a 250-record page size and a 10,000-transaction safety cap. The service rejects an oversized range rather than calculating from partial history. Deleting a transaction changes the next derived result because no detection result is cached.

## Phase 7 derived financial views

The Goals API provides authenticated CRUD at `/api/goals`. Goal records are always queried through `users/{verifiedUid}/goals`; a request cannot supply an owner UID. Goal progress is calculated from the persisted target/current amounts and the current UTC date.

Financial Health is calculated on demand from the selected month's transactions, six months of bounded transaction history, overlapping budgets, derived recurring patterns, and current goals. It has five explainable components:

- Savings: selected-month savings rate when income exists.
- Budget discipline: average usage of selected-month budgets.
- Spending stability: variation across at least three months with expenses.
- Recurring-cost pressure: detected recurring monthly equivalent compared with income.
- Goal progress: average progress across stored goals.

The score is normalized across available components. If there is no transaction history, fewer than three active history months, or fewer than 60 of 100 supported points are available, the response uses `score: null` and `status: "insufficient_data"` rather than presenting a misleading number.

Upcoming Cash Flow is available at `/api/cash-flow/upcoming` for a maximum inclusive 31-day window. It recomputes Phase 6 recurring detections from a bounded lookback, includes only expense patterns with a reliable next expected occurrence, and returns expected expenses plus net flow. It does not persist projections, create future transactions, or invent recurring income.

Phase 7 integration tests use in-memory repositories and an injected token verifier for authentication, validation, CRUD, UID isolation, health response shape, and recurring cash-flow behavior. No Firestore Emulator is configured in this workspace, so live Firestore persistence and Security Rules execution remain unverified until an emulator or deployed Firestore test environment is provided.

## Phase 8 receipt scanning

Receipt scanning does not add a Firestore collection or permanently store uploaded image bytes. `POST /api/receipts/scan` accepts an authenticated multipart field named `receipt`, keeps the image in memory for the provider call, and returns a structured review payload.

The server validates the upload as a JPEG, PNG, or WebP image no larger than 5 MB. Gemini is accessed only by the server through the `GEMINI_API_KEY` Replit Secret. The key is never returned, logged, bundled into the client, or stored in Firestore.

The provider response is validated against a strict Zod shape, then normalized:

```text
merchant: string | null
occurredAt: YYYY-MM-DD | null
amountMinor: positive integer paise | null
currency: "INR" | null
type: "income" | "expense" | null
category: string | null
paymentMethod: string | null
lineItems: normalized visible items
needsReview: missing/unsupported field names
```

Money conversion occurs only at the server boundary and rejects malformed values rather than inventing amounts. The response is not authoritative financial data. The client must complete the review and then calls the existing transaction create endpoint, which applies the same transaction validation and stores `source: "receipt"`. Receipt scanning itself never writes a transaction.

Phase 8 tests use a mocked extractor; live Gemini API behavior and production provider quotas remain not verified.