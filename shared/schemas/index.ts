import { z } from "zod";

export const plannedRouteSchema = z.enum([
  "/dashboard",
  "/transactions",
  "/budgets",
  "/analytics",
  "/goals",
  "/recurring-payments",
  "/receipts",
  "/insights",
  "/ai-finance",
  "/settings",
]);

export type PlannedRouteValue = z.infer<typeof plannedRouteSchema>;

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date in YYYY-MM-DD format.");
const validDateOnlySchema = dateOnlySchema.refine((value) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}, "Use a valid calendar date.");

const optionalQueryInt = (max: number) => z.preprocess(
  (value) => value === undefined || value === "" ? undefined : value,
  z.coerce.number().int().nonnegative().max(max).optional(),
);

export const transactionTypeSchema = z.enum(["income", "expense"]);
export const transactionSourceSchema = z.enum(["manual", "receipt"]);

export function isCategoryRequired(type: z.infer<typeof transactionTypeSchema> | undefined): boolean {
  return type === "expense";
}

export const transactionCreateSchema = z.object({
  amountMinor: z.number().int().positive().max(9_999_999_999),
  type: transactionTypeSchema,
  merchant: z.string().trim().min(1).max(120),
  category: z.string().trim().max(80).optional(),
  occurredAt: validDateOnlySchema,
  paymentMethod: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(1000).optional(),
  receiptId: z.string().trim().min(1).max(200).optional(),
  source: transactionSourceSchema.optional(),
}).strict().superRefine((value, context) => {
  if (isCategoryRequired(value.type) && !value.category) {
    context.addIssue({ code: "custom", path: ["category"], message: "Category is required for expense transactions." });
  }
});

const transactionUpdateFieldsSchema = z.object({
  amountMinor: z.number().int().positive().max(9_999_999_999).optional(),
  type: transactionTypeSchema.optional(),
  merchant: z.string().trim().min(1).max(120).optional(),
  category: z.string().trim().max(80).optional(),
  occurredAt: validDateOnlySchema.optional(),
  paymentMethod: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(1000).optional(),
  receiptId: z.string().trim().min(1).max(200).optional(),
}).strict();

export const transactionUpdateSchema = transactionUpdateFieldsSchema.refine(
  (value) => Object.keys(value).length > 0,
  "At least one transaction field must be provided.",
).superRefine((value, context) => {
  if (isCategoryRequired(value.type) && value.category === "") {
    context.addIssue({ code: "custom", path: ["category"], message: "Category is required for expense transactions." });
  }
});

export const transactionListQuerySchema = z.object({
  pageSize: optionalQueryInt(50).default(20),
  pageToken: z.string().trim().min(1).max(2000).optional(),
  from: validDateOnlySchema.optional(),
  to: validDateOnlySchema.optional(),
  type: transactionTypeSchema.optional(),
  category: z.string().trim().max(80).optional(),
  paymentMethod: z.string().trim().max(60).optional(),
  q: z.string().trim().max(100).optional(),
  minAmountMinor: optionalQueryInt(9_999_999_999),
  maxAmountMinor: optionalQueryInt(9_999_999_999),
  sort: z.enum(["newest", "oldest", "amountAsc", "amountDesc"]).default("newest"),
}).strict().superRefine((value, context) => {
  if (value.from && value.to && value.from > value.to) {
    context.addIssue({ code: "custom", path: ["to"], message: "The end date must be on or after the start date." });
  }
  if (value.minAmountMinor !== undefined && value.maxAmountMinor !== undefined && value.minAmountMinor > value.maxAmountMinor) {
    context.addIssue({ code: "custom", path: ["maxAmountMinor"], message: "The maximum amount must be at least the minimum amount." });
  }
});

export const transactionIdSchema = z.string().trim().min(1).max(150).regex(/^[A-Za-z0-9_-]+$/, "Invalid transaction ID.");

export type TransactionCreateInput = z.infer<typeof transactionCreateSchema>;
export type TransactionUpdateInput = z.infer<typeof transactionUpdateSchema>;
export type TransactionListQuery = z.infer<typeof transactionListQuerySchema>;

export const budgetPeriodSchema = z.literal("monthly");

const budgetFieldsSchema = z.object({
  name: z.string().trim().min(1, "Budget name is required.").max(120),
  category: z.string().trim().min(1).max(80).optional(),
  amountMinor: z.number().int().positive("Budget amount must be greater than zero.").max(9_999_999_999),
  period: budgetPeriodSchema,
  startDate: validDateOnlySchema,
  endDate: validDateOnlySchema.optional(),
}).strict();

export const budgetCreateSchema = budgetFieldsSchema.superRefine((value, context) => {
  if (value.endDate && value.endDate < value.startDate) {
    context.addIssue({ code: "custom", path: ["endDate"], message: "The end date must be on or after the start date." });
  }
});

export const budgetUpdateSchema = budgetFieldsSchema.partial().strict().refine(
  (value) => Object.keys(value).length > 0,
  "At least one budget field must be provided.",
);

export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use a month in YYYY-MM format.");

export const budgetListQuerySchema = z.object({
  month: monthSchema.optional(),
}).strict();

export const budgetIdSchema = z.string().trim().min(1).max(150).regex(/^[A-Za-z0-9_-]+$/, "Invalid budget ID.");

export type BudgetCreateInput = z.infer<typeof budgetCreateSchema>;
export type BudgetUpdateInput = z.infer<typeof budgetUpdateSchema>;
export type BudgetListQuery = z.infer<typeof budgetListQuerySchema>;

const goalFieldsSchema = z.object({
  name: z.string().trim().min(1, "Goal name is required.").max(120),
  targetAmountMinor: z.number().int().positive("Target amount must be greater than zero.").max(9_999_999_999),
  currentAmountMinor: z.number().int().nonnegative("Current amount cannot be negative.").max(9_999_999_999),
  targetDate: validDateOnlySchema,
  category: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(1000).optional(),
}).strict();

export const goalCreateSchema = goalFieldsSchema.superRefine((value, context) => {
  if (value.currentAmountMinor > value.targetAmountMinor) {
    context.addIssue({
      code: "custom",
      path: ["currentAmountMinor"],
      message: "Current amount cannot exceed the target amount.",
    });
  }
});

export const goalUpdateSchema = goalFieldsSchema.partial().strict().refine(
  (value) => Object.keys(value).length > 0,
  "At least one goal field must be provided.",
).superRefine((value, context) => {
  if (value.currentAmountMinor !== undefined && value.targetAmountMinor !== undefined && value.currentAmountMinor > value.targetAmountMinor) {
    context.addIssue({ code: "custom", path: ["currentAmountMinor"], message: "Current amount cannot exceed the target amount." });
  }
});

export const goalIdSchema = z.string().trim().min(1).max(150).regex(/^[A-Za-z0-9_-]+$/, "Invalid goal ID.");
export const goalListQuerySchema = z.object({}).strict();
export type GoalCreateInput = z.infer<typeof goalCreateSchema>;
export type GoalUpdateInput = z.infer<typeof goalUpdateSchema>;
export type GoalListQuery = z.infer<typeof goalListQuerySchema>;

export const dashboardQuerySchema = z.object({
  month: monthSchema.optional(),
}).strict();

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

function monthDistance(from: string, to: string): number {
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);
  return (toYear - fromYear) * 12 + (toMonth - fromMonth);
}

export const analyticsQuerySchema = z.object({
  from: monthSchema.optional(),
  to: monthSchema.optional(),
}).strict().superRefine((value, context) => {
  if ((value.from && !value.to) || (!value.from && value.to)) {
    context.addIssue({
      code: "custom",
      path: [value.from ? "to" : "from"],
      message: "Both from and to months are required together.",
    });
    return;
  }
  if (value.from && value.to) {
    if (value.from > value.to) {
      context.addIssue({ code: "custom", path: ["to"], message: "The end month must be on or after the start month." });
    } else if (monthDistance(value.from, value.to) > 11) {
      context.addIssue({ code: "custom", path: ["to"], message: "Analytics can cover at most 12 months." });
    }
  }
});

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;

export const insightsQuerySchema = z.object({
  month: monthSchema.optional(),
}).strict();

export type InsightsQuery = z.infer<typeof insightsQuerySchema>;

export const aiInsightModelResponseSchema = z.object({
  insights: z.array(z.object({
    title: z.string().trim().min(1).max(120),
    summary: z.string().trim().min(1).max(500),
    type: z.enum(["spending", "savings", "budget", "recurring", "goals", "forecast", "trend", "attention"]),
    severity: z.enum(["low", "medium", "high"]),
    supportingFactIds: z.array(z.string().trim().min(1).max(100)).min(1).max(4),
  }).strict()).max(5),
}).strict();

export type AiInsightModelResponse = z.infer<typeof aiInsightModelResponseSchema>;

export const financeQuestionInputSchema = z.object({
  question: z.string().trim().min(1, "Ask a financial question.").max(500, "Questions must be 500 characters or fewer."),
}).strict();

export const financeQuestionPeriodSchema = z.object({
  type: z.enum(["current_month", "previous_month", "calendar_month", "calendar_year", "month_window"]),
  value: z.string().trim().max(20).optional(),
  months: z.number().int().min(1).max(12).optional(),
}).strict();

export const financeQuestionIntentSchema = z.object({
  intent: z.enum([
    "unsupported",
    "ambiguous",
    "expense_total",
    "category_spending",
    "category_percentage",
    "top_category",
    "largest_expense",
    "income_total",
    "savings",
    "savings_rate",
    "comparison",
    "merchant_spending",
    "budget_usage",
    "closest_budget",
    "goal_progress",
    "goal_remaining",
    "recurring_summary",
    "recurring_total",
    "forecast_balance",
    "forecast_expenses",
  ]),
  period: financeQuestionPeriodSchema.optional(),
  category: z.string().trim().max(80).optional(),
  merchant: z.string().trim().max(120).optional(),
  goalName: z.string().trim().max(120).optional(),
  horizon: z.union([z.literal(1), z.literal(3), z.literal(6)]).optional(),
}).strict();

export const financeQuestionResultSchema = z.object({
  kind: z.enum(["amount", "percentage", "comparison", "list", "budget", "goal", "forecast"]),
  currency: z.literal("INR"),
  amountMinor: z.number().int().optional(),
  previousAmountMinor: z.number().int().optional(),
  differenceMinor: z.number().int().optional(),
  percentage: z.number().finite().nullable().optional(),
  text: z.string().max(500).optional(),
  period: z.object({
    from: validDateOnlySchema,
    to: validDateOnlySchema,
    label: z.string().min(1).max(80),
  }).strict().optional(),
  items: z.array(z.object({
    label: z.string().min(1).max(160),
    amountMinor: z.number().int().optional(),
    percentage: z.number().finite().nullable().optional(),
    text: z.string().max(300).optional(),
     date: validDateOnlySchema.optional(),
  }).strict()).max(50).optional(),
}).strict().refine((value) => (
  value.amountMinor !== undefined
  || value.previousAmountMinor !== undefined
  || value.differenceMinor !== undefined
  || value.percentage !== undefined
  || value.text !== undefined
  || value.items !== undefined
), "The financial result must contain a value.");

export type FinanceQuestionInput = z.infer<typeof financeQuestionInputSchema>;
export type FinanceQuestionIntentInput = z.infer<typeof financeQuestionIntentSchema>;
export type FinanceQuestionResultInput = z.infer<typeof financeQuestionResultSchema>;

export const recurringPaymentsQuerySchema = analyticsQuerySchema;

export type RecurringPaymentsQuery = z.infer<typeof recurringPaymentsQuerySchema>;

export const upcomingCashFlowQuerySchema = z.object({
  from: validDateOnlySchema.optional(),
  to: validDateOnlySchema.optional(),
}).strict().superRefine((value, context) => {
  if ((value.from && !value.to) || (!value.from && value.to)) {
    context.addIssue({ code: "custom", path: [value.from ? "to" : "from"], message: "Both from and to dates are required together." });
    return;
  }
  if (value.from && value.to) {
    if (value.from > value.to) {
      context.addIssue({ code: "custom", path: ["to"], message: "The end date must be on or after the start date." });
      return;
    }
    const difference = (Date.parse(`${value.to}T00:00:00.000Z`) - Date.parse(`${value.from}T00:00:00.000Z`)) / 86_400_000;
    if (difference > 30) {
      context.addIssue({ code: "custom", path: ["to"], message: "Upcoming cash flow can cover at most 31 days." });
    }
  }
});
export type UpcomingCashFlowQuery = z.infer<typeof upcomingCashFlowQuerySchema>;

export const forecastHorizonSchema = z.union([z.literal(1), z.literal(3), z.literal(6)]);

export const forecastQuerySchema = z.object({
  horizon: z.preprocess((value) => value === undefined || value === "" ? undefined : value, z.coerce.number().int().pipe(forecastHorizonSchema).optional()),
}).strict();

export type ForecastQuery = z.infer<typeof forecastQuerySchema>;

export const forecastSimulationSchema = z.object({
  horizon: z.coerce.number().int().pipe(forecastHorizonSchema).default(3),
  incomeAdjustmentPercent: z.number().finite().min(-100).max(500).default(0),
  expenseAdjustmentPercent: z.number().finite().min(-100).max(500).default(0),
  oneTimeExpenseMinor: z.number().int().nonnegative().max(9_999_999_999).default(0),
  savingsTargetMinor: z.number().int().nonnegative().max(9_999_999_999).optional(),
}).strict();

export type ForecastSimulationInput = z.infer<typeof forecastSimulationSchema>;

const nullableText = (max: number) => z.union([z.string().trim().max(max), z.null()]).optional();
const nullableNumber = z.union([z.number().finite(), z.string().trim().max(40), z.null()]).optional();

export const receiptModelResponseSchema = z.object({
  merchant: nullableText(120),
  date: nullableText(20),
  totalAmount: nullableNumber,
  currency: nullableText(12),
  transactionType: z.union([transactionTypeSchema, z.null()]).optional(),
  category: nullableText(80),
  paymentMethod: nullableText(60),
  lineItems: z.array(z.object({
    description: z.string().trim().min(1).max(160),
    quantity: nullableNumber,
    unitPrice: nullableNumber,
    total: nullableNumber,
  }).strict()).max(100).optional(),
}).strict();

export type ReceiptModelResponse = z.infer<typeof receiptModelResponseSchema>;