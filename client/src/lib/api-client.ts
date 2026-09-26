import type {
  AnalyticsData,
  AiInsightsData,
  ApiResponse,
  DashboardData,
  ForecastData,
  ForecastSimulationData,
  FinancialHealthData,
  FinanceQuestionData,
  GoalListData,
  GoalView,
  HealthPayload,
  InsightsData,
  RecurringPaymentsData,
  ReceiptScanData,
  TransactionListData,
  TransactionRecord,
  UpcomingCashFlowData,
} from "../../../shared/types";
import type {
  BudgetCreateInput,
  BudgetListQuery,
  BudgetUpdateInput,
  ForecastSimulationInput,
  GoalCreateInput,
  GoalUpdateInput,
  TransactionCreateInput,
  TransactionListQuery,
  TransactionUpdateInput,
} from "../../../shared/schemas";
import type { BudgetListData, BudgetRecord, BudgetView } from "../../../shared/types";
import { getFirebaseAuth, isFirebaseClientConfigured } from "@/lib/firebase";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code = "API_ERROR",
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = RequestInit & {
  authenticated?: boolean;
};

async function request<T>(path: string, init?: RequestOptions): Promise<T> {
  const { authenticated = false, ...requestInit } = init ?? {};
  const headers = new Headers(requestInit.headers);
  if (!(requestInit.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (authenticated) {
    if (!isFirebaseClientConfigured()) {
      throw new ApiError("Firebase Authentication is not configured.", "AUTHENTICATION_UNAVAILABLE");
    }
    const user = getFirebaseAuth().currentUser;
    if (!user) {
      throw new ApiError("You must be signed in to make this request.", "AUTHENTICATION_REQUIRED");
    }
    try {
      headers.set("Authorization", `Bearer ${await user.getIdToken()}`);
    } catch {
      throw new ApiError("Your secure session could not be verified. Please sign in again.", "AUTHENTICATION_REQUIRED");
    }
  }

  let response: Response;
  try {
    response = await fetch(path, {
      ...requestInit,
      headers,
    });
  } catch {
    throw new ApiError("The network request could not be completed. Check your connection and try again.", "NETWORK_ERROR");
  }

  const rawBody = await response.text();
  if (rawBody.trim() === "") {
    if (!response.ok) {
      throw new ApiError("The request could not be completed.", response.status === 401 ? "AUTHENTICATION_REQUIRED" : "API_ERROR");
    }
    return undefined as T;
  }

  let body: ApiResponse<T> | { error?: { code?: string; message?: string } };
  try {
    body = JSON.parse(rawBody) as ApiResponse<T> | { error?: { code?: string; message?: string } };
  } catch {
    throw new ApiError(
      response.ok ? "The server returned an invalid response." : "The request could not be completed.",
      response.ok ? "INVALID_RESPONSE" : response.status === 401 ? "AUTHENTICATION_REQUIRED" : "API_ERROR",
    );
  }

  if (!response.ok || !("data" in body)) {
    const error = "error" in body ? body.error : undefined;
    throw new ApiError(
      error?.message ?? "The request could not be completed.",
      response.status === 401 ? "AUTHENTICATION_REQUIRED" : error?.code,
    );
  }

  return body.data;
}

export function getHealth(): Promise<HealthPayload> {
  return request<HealthPayload>("/api/health");
}

export type AuthMePayload = {
  uid: string;
  email: string | null;
  emailVerified: boolean;
};

export function getAuthMe(): Promise<AuthMePayload> {
  return request<AuthMePayload>("/api/auth/me", { authenticated: true });
}

function queryString(query: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "" && value !== null) {
      params.set(key, String(value));
    }
  }
  const result = params.toString();
  return result ? `?${result}` : "";
}

export function getTransactions(query: Partial<TransactionListQuery> = {}): Promise<TransactionListData> {
  return request<TransactionListData>(`/api/transactions${queryString(query)}`, { authenticated: true });
}

export function createTransaction(input: TransactionCreateInput): Promise<TransactionRecord> {
  return request<TransactionRecord>("/api/transactions", {
    method: "POST",
    authenticated: true,
    body: JSON.stringify(input),
  });
}

export function updateTransaction(transactionId: string, input: TransactionUpdateInput): Promise<TransactionRecord> {
  return request<TransactionRecord>(`/api/transactions/${encodeURIComponent(transactionId)}`, {
    method: "PATCH",
    authenticated: true,
    body: JSON.stringify(input),
  });
}

export function deleteTransaction(transactionId: string): Promise<void> {
  return request<void>(`/api/transactions/${encodeURIComponent(transactionId)}`, {
    method: "DELETE",
    authenticated: true,
  });
}

export function getBudgets(query: Partial<BudgetListQuery> = {}): Promise<BudgetListData> {
  return request<BudgetListData>(`/api/budgets${queryString(query)}`, { authenticated: true });
}

export function getDashboard(month?: string): Promise<DashboardData> {
  return request<DashboardData>(`/api/dashboard${month ? queryString({ month }) : ""}`, { authenticated: true });
}

export function getAnalytics(from?: string, to?: string): Promise<AnalyticsData> {
  return request<AnalyticsData>(`/api/analytics${from && to ? queryString({ from, to }) : ""}`, { authenticated: true });
}

export function getInsights(month?: string): Promise<InsightsData> {
  return request<InsightsData>(`/api/insights${month ? queryString({ month }) : ""}`, { authenticated: true });
}

export function generateAiInsights(month?: string): Promise<AiInsightsData> {
  return request<AiInsightsData>(`/api/insights/ai${month ? queryString({ month }) : ""}`, {
    method: "POST",
    authenticated: true,
    body: JSON.stringify({}),
  });
}

export function getRecurringPayments(from?: string, to?: string): Promise<RecurringPaymentsData> {
  return request<RecurringPaymentsData>(`/api/recurring-payments${from && to ? queryString({ from, to }) : ""}`, { authenticated: true });
}

export function getGoals(): Promise<GoalListData> {
  return request<GoalListData>("/api/goals", { authenticated: true });
}

export function createGoal(input: GoalCreateInput): Promise<GoalView> {
  return request<GoalView>("/api/goals", { method: "POST", authenticated: true, body: JSON.stringify(input) });
}

export function updateGoal(goalId: string, input: GoalUpdateInput): Promise<GoalView> {
  return request<GoalView>(`/api/goals/${encodeURIComponent(goalId)}`, { method: "PATCH", authenticated: true, body: JSON.stringify(input) });
}

export function deleteGoal(goalId: string): Promise<void> {
  return request<void>(`/api/goals/${encodeURIComponent(goalId)}`, { method: "DELETE", authenticated: true });
}

export function getFinancialHealth(month?: string): Promise<FinancialHealthData> {
  return request<FinancialHealthData>(`/api/financial-health${month ? queryString({ month }) : ""}`, { authenticated: true });
}

export function getUpcomingCashFlow(from?: string, to?: string): Promise<UpcomingCashFlowData> {
  return request<UpcomingCashFlowData>(`/api/cash-flow/upcoming${from && to ? queryString({ from, to }) : ""}`, { authenticated: true });
}

export function scanReceipt(file: File): Promise<ReceiptScanData> {
  const body = new FormData();
  body.append("receipt", file);
  return request<ReceiptScanData>("/api/receipts/scan", {
    method: "POST",
    authenticated: true,
    body,
  });
}

export function getForecast(horizon?: 1 | 3 | 6): Promise<ForecastData> {
  return request<ForecastData>(`/api/forecast${horizon ? `?horizon=${horizon}` : ""}`, { authenticated: true });
}

export function simulateForecast(input: ForecastSimulationInput): Promise<ForecastSimulationData> {
  return request<ForecastSimulationData>("/api/forecast/simulate", {
    method: "POST",
    authenticated: true,
    body: JSON.stringify(input),
  });
}

export function askFinanceQuestion(question: string): Promise<FinanceQuestionData> {
  return request<FinanceQuestionData>("/api/ai-finance/questions", {
    method: "POST",
    authenticated: true,
    body: JSON.stringify({ question }),
  });
}

export function createBudget(input: BudgetCreateInput): Promise<BudgetView> {
  return request<BudgetView>("/api/budgets", {
    method: "POST",
    authenticated: true,
    body: JSON.stringify(input),
  });
}

export function updateBudget(budgetId: string, input: BudgetUpdateInput): Promise<BudgetView> {
  return request<BudgetView>(`/api/budgets/${encodeURIComponent(budgetId)}`, {
    method: "PATCH",
    authenticated: true,
    body: JSON.stringify(input),
  });
}

export function deleteBudget(budgetId: string): Promise<void> {
  return request<void>(`/api/budgets/${encodeURIComponent(budgetId)}`, {
    method: "DELETE",
    authenticated: true,
  });
}