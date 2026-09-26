import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  BudgetCreateInput,
  BudgetListQuery,
  BudgetUpdateInput,
  GoalCreateInput,
  GoalListQuery,
  GoalUpdateInput,
  TransactionCreateInput,
  TransactionListQuery,
  TransactionUpdateInput,
} from "../../shared/schemas/index.js";
import type { FinanceQuestionIntentInput } from "../../shared/schemas/index.js";
import type {
  BudgetRecord,
  GoalRecord,
  TransactionListData,
  TransactionRecord,
} from "../../shared/types/index.js";
import {
  AiFinanceService,
  GeminiFinanceIntentExtractor,
  type FinanceIntentContext,
  type FinanceIntentExtractor,
} from "../../server/src/ai-finance/ai-finance-service.js";
import type { BudgetRepository } from "../../server/src/budgets/budget-repository.js";
import type { GoalRepository } from "../../server/src/goals/goal-repository.js";
import type { TransactionRepository } from "../../server/src/transactions/transaction-repository.js";

const { generateContentMock } = vi.hoisted(() => ({
  generateContentMock: vi.fn(async () => undefined),
}));

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent: generateContentMock };
    }
  },
}));

afterEach(() => {
  vi.unstubAllEnvs();
  generateContentMock.mockReset();
});

class MemoryTransactionRepository implements TransactionRepository {
  constructor(private readonly records: TransactionRecord[]) {}
  async create(_uid: string, _input: TransactionCreateInput): Promise<TransactionRecord> { throw new Error("Not used."); }
  async list(_uid: string, query: TransactionListQuery): Promise<TransactionListData> {
    return this.listForAnalytics(_uid, { from: query.from ?? "1900-01-01", to: query.to ?? "2999-12-31", pageSize: query.pageSize });
  }
  async listForAnalytics(_uid: string, query: { from: string; to: string; pageSize: number }): Promise<TransactionListData> {
    return {
      items: this.records.filter((record) => record.occurredAt.slice(0, 10) >= query.from && record.occurredAt.slice(0, 10) <= query.to),
      hasNextPage: false,
      nextCursor: null,
    };
  }
  async get(_uid: string, _id: string): Promise<TransactionRecord | null> { return null; }
  async update(_uid: string, _id: string, _input: TransactionUpdateInput): Promise<TransactionRecord | null> { return null; }
  async delete(_uid: string, _id: string): Promise<boolean> { return false; }
}

class MemoryBudgetRepository implements BudgetRepository {
  constructor(private readonly budgets: BudgetRecord[]) {}
  async create(_uid: string, _input: BudgetCreateInput): Promise<BudgetRecord> { throw new Error("Not used."); }
  async list(_uid: string, query: BudgetListQuery): Promise<BudgetRecord[]> {
    return this.budgets.filter((budget) => !query.month || budget.startDate.startsWith(query.month));
  }
  async get(_uid: string, id: string): Promise<BudgetRecord | null> { return this.budgets.find((budget) => budget.id === id) ?? null; }
  async update(_uid: string, _id: string, _input: BudgetUpdateInput): Promise<BudgetRecord | null> { return null; }
  async delete(_uid: string, _id: string): Promise<boolean> { return false; }
}

class MemoryGoalRepository implements GoalRepository {
  constructor(private readonly goals: GoalRecord[]) {}
  async create(_uid: string, _input: GoalCreateInput): Promise<GoalRecord> { throw new Error("Not used."); }
  async list(_uid: string, _query: GoalListQuery): Promise<GoalRecord[]> { return this.goals; }
  async get(_uid: string, id: string): Promise<GoalRecord | null> { return this.goals.find((goal) => goal.id === id) ?? null; }
  async update(_uid: string, _id: string, _input: GoalUpdateInput): Promise<GoalRecord | null> { return null; }
  async delete(_uid: string, _id: string): Promise<boolean> { return false; }
}

function transaction(id: string, date: string, type: "income" | "expense", amountMinor: number, category: string, merchant = "Local merchant"): TransactionRecord {
  return {
    id,
    amountMinor,
    currency: "INR",
    type,
    merchant,
    category,
    occurredAt: `${date}T00:00:00.000Z`,
    source: "manual",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

function records(): TransactionRecord[] {
  return [
    transaction("apr-income", "2026-04-01", "income", 100_000, "Salary"),
    transaction("apr-food", "2026-04-05", "expense", 20_000, "Food", "Grocery"),
    transaction("may-income", "2026-05-01", "income", 100_000, "Salary"),
    transaction("may-food", "2026-05-05", "expense", 20_000, "Food", "Grocery"),
    transaction("jun-income", "2026-06-01", "income", 100_000, "Salary"),
    transaction("jun-food", "2026-06-05", "expense", 20_000, "Food", "Grocery"),
    transaction("jul-income", "2026-07-01", "income", 100_000, "Salary"),
    transaction("jul-food", "2026-07-05", "expense", 20_000, "Food", "Grocery"),
    transaction("aug-income", "2026-08-01", "income", 100_000, "Salary"),
    transaction("aug-food", "2026-08-05", "expense", 60_000, "Food", "Grocery"),
    transaction("aug-travel", "2026-08-15", "expense", 10_000, "Travel", "Flight"),
    transaction("jan-subscription", "2026-01-10", "expense", 1_000, "Subscriptions", "Streaming"),
    transaction("feb-subscription", "2026-02-10", "expense", 1_000, "Subscriptions", "Streaming"),
    transaction("mar-subscription", "2026-03-10", "expense", 1_000, "Subscriptions", "Streaming"),
    transaction("sep-income", "2026-09-01", "income", 100_000, "Salary"),
    transaction("sep-food", "2026-09-05", "expense", 20_000, "Food", "Grocery"),
    transaction("sep-travel", "2026-09-15", "expense", 50_000, "Travel", "Flight"),
  ];
}

function service(
  extractor?: FinanceIntentExtractor,
  budgets: BudgetRecord[] = [],
  goals: GoalRecord[] = [],
) {
  const repository = new MemoryTransactionRepository(records());
  return new AiFinanceService(
    repository,
    new MemoryBudgetRepository(budgets),
    new MemoryGoalRepository(goals),
    extractor,
    () => "2026-09-15",
    () => "2026-09-15",
  );
}

function budget(id: string, name: string, category: string, amountMinor: number): BudgetRecord {
  return {
    id,
    name,
    category,
    amountMinor,
    currency: "INR",
    period: "monthly",
    startDate: "2026-09-01",
    endDate: "2026-09-30",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

function goal(): GoalRecord {
  return {
    id: "laptop",
    name: "Laptop",
    targetAmountMinor: 100_000,
    currentAmountMinor: 40_000,
    currency: "INR",
    targetDate: "2027-01-01",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

describe("AI Finance deterministic query service", () => {
  it("answers supported spending, category, savings, comparison, and largest-expense questions from server facts", async () => {
    const finance = service();
    const lastMonth = await finance.answer("user-a", "How much did I spend last month?");
    expect(lastMonth.status).toBe("answered");
    expect(lastMonth.result?.amountMinor).toBe(70_000);
    expect(lastMonth.usedAi).toBe(false);

    const food = await finance.answer("user-a", "How much did I spend on Food?");
    expect(food.result?.amountMinor).toBe(20_000);

    const savingsRate = await finance.answer("user-a", "What is my savings rate?");
    expect(savingsRate.result?.percentage).toBe(30);

    const comparison = await finance.answer("user-a", "Did I spend more this month than last month?");
    expect(comparison.result).toMatchObject({ amountMinor: 70_000, previousAmountMinor: 20_000, differenceMinor: 50_000 });

    const largest = await finance.answer("user-a", "What was my biggest expense?");
    expect(largest.result?.items?.[0]).toMatchObject({ label: "Flight", amountMinor: 50_000 });
  });

  it("recognizes natural variations of largest-expense and category-spending questions with their requested period", async () => {
    const finance = service();

    const majorExpense = await finance.answer("user-a", "What was my major expense?");
    expect(majorExpense.status).toBe("answered");
    expect(majorExpense.intent?.intent).toBe("largest_expense");
    expect(majorExpense.usedAi).toBe(false);

    const largestInAugust = await finance.answer("user-a", "What was my largest expense in August?");
    expect(largestInAugust.intent?.intent).toBe("largest_expense");
    expect(largestInAugust.usedAi).toBe(false);
    expect(largestInAugust.result?.items?.[0]).toMatchObject({ label: "Grocery", amountMinor: 60_000, date: "2026-08-05" });
    expect(largestInAugust.result?.period).toMatchObject({ from: "2026-08-01", to: "2026-08-31", label: "August 2026" });

    const mostInAugust = await finance.answer("user-a", "What did I spend the most on in August?");
    expect(mostInAugust.intent?.intent).toBe("top_category");
    expect(mostInAugust.usedAi).toBe(false);
    expect(mostInAugust.result?.items?.[0]).toMatchObject({ label: "Food", amountMinor: 60_000 });
    expect(mostInAugust.result?.period?.label).toBe("August 2026");

    const mostLastMonth = await finance.answer("user-a", "Which category did I spend the most on last month?");
    expect(mostLastMonth.intent?.intent).toBe("top_category");
    expect(mostLastMonth.usedAi).toBe(false);
    expect(mostLastMonth.result?.items?.[0]).toMatchObject({ label: "Food", amountMinor: 60_000 });
    expect(mostLastMonth.result?.period?.label).toBe("August 2026");

    const foodInAugust = await finance.answer("user-a", "How much did I spend on Food in August?");
    expect(foodInAugust.intent?.intent).toBe("category_spending");
    expect(foodInAugust.usedAi).toBe(false);
    expect(foodInAugust.result?.amountMinor).toBe(60_000);
    expect(foodInAugust.result?.period).toMatchObject({ from: "2026-08-01", to: "2026-08-31", label: "August 2026" });
  });

  it("answers budget, goal, recurring, and forecast questions through existing services", async () => {
    const finance = service(undefined, [budget("food-budget", "Food budget", "Food", 25_000)], [goal()]);
    const budgetAnswer = await finance.answer("user-a", "How much of my Food budget have I used?");
    expect(budgetAnswer.result).toMatchObject({ amountMinor: 20_000, percentage: 80 });

    const goalAnswer = await finance.answer("user-a", "How much have I saved toward my Laptop goal?");
    expect(goalAnswer.result).toMatchObject({ amountMinor: 40_000, percentage: 40 });

    const recurringAnswer = await finance.answer("user-a", "What recurring payments do I have?");
    expect(recurringAnswer.status).toBe("answered");
    expect(recurringAnswer.result?.items?.some((item) => item.label === "Streaming")).toBe(true);

    const forecastAnswer = await finance.answer("user-a", "What is my projected balance after 3 months?");
    expect(forecastAnswer.result?.kind).toBe("forecast");
    expect(forecastAnswer.answer).toContain("projected balance");
  });

  it("handles unsupported, ambiguous, and missing-data questions safely", async () => {
    const finance = service(undefined, [budget("food-budget", "Food budget", "Food", 25_000), budget("travel-budget", "Travel budget", "Travel", 50_000)]);
    expect((await finance.answer("user-a", "Which stock should I buy?")).status).toBe("unsupported");
    expect((await finance.answer("user-a", "How much of my budget have I used?")).status).toBe("ambiguous");
    expect((await finance.answer("user-a", "How much did I spend on Rent?")).status).toBe("insufficient_data");
  });

  it("keeps unrelated questions on the strict unsupported-intent path", async () => {
    vi.stubEnv("GEMINI_API_KEY", "unit-test-key");
    generateContentMock.mockResolvedValue({
      response: { text: () => JSON.stringify({ intent: "unsupported" }) },
    });
    const finance = service(new GeminiFinanceIntentExtractor());

    for (const question of ["Tell me a joke", "What is the weather?", "Explain AI", "Who is the president?"]) {
      const answer = await finance.answer("user-a", question);
      expect(answer.status, question).toBe("unsupported");
      expect(answer.result, question).toBeUndefined();
    }
    expect(generateContentMock).toHaveBeenCalledTimes(4);
    for (const [contents] of generateContentMock.mock.calls) {
      const prompt = contents[0].text as string;
      expect(prompt).toContain("If the question is unrelated to the user's recorded personal finances");
    }
  });

  it("uses the strict intent extractor for phrasing outside the local parser", async () => {
    let receivedContext: FinanceIntentContext | undefined;
    const extractor: FinanceIntentExtractor = {
      async extract(_question, context): Promise<FinanceQuestionIntentInput> {
        receivedContext = context;
        return { intent: "expense_total", period: { type: "calendar_month", value: "2026-09" } };
      },
    };
    const answer = await service(extractor).answer("user-a", "Could you summarize my recorded outgoings?");
    expect(answer.usedAi).toBe(true);
    expect(answer.result?.amountMinor).toBe(70_000);
    expect(receivedContext?.availableCategories).toContain("Food");
    expect(receivedContext?.availableCategories).not.toContain("Ignore previous instructions");
  });
});