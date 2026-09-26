import { goalCreateSchema, type GoalCreateInput, type GoalListQuery, type GoalUpdateInput } from "../../../shared/schemas/index.js";
import { goalView } from "../../../shared/goals/calculations.js";
import type { GoalListData, GoalRecord, GoalView } from "../../../shared/types/index.js";
import { ResourceNotFoundError } from "../errors.js";
import type { GoalRepository } from "./goal-repository.js";

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function completeInput(existing: GoalRecord, input: GoalUpdateInput): GoalCreateInput {
  return goalCreateSchema.parse({
    name: input.name ?? existing.name,
    targetAmountMinor: input.targetAmountMinor ?? existing.targetAmountMinor,
    currentAmountMinor: input.currentAmountMinor ?? existing.currentAmountMinor,
    targetDate: input.targetDate ?? existing.targetDate.slice(0, 10),
    ...(input.category !== undefined ? { category: input.category } : existing.category ? { category: existing.category } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : existing.notes ? { notes: existing.notes } : {}),
  });
}

export class GoalService {
  constructor(private readonly repository: GoalRepository) {}

  private view(goal: GoalRecord): GoalView {
    return goalView(goal, todayUtc());
  }

  async create(uid: string, input: GoalCreateInput): Promise<GoalView> {
    return this.view(await this.repository.create(uid, input));
  }

  async list(uid: string, query: GoalListQuery): Promise<GoalListData> {
    const goals = await this.repository.list(uid, query);
    return { items: goals.map((goal) => this.view(goal)) };
  }

  async get(uid: string, goalId: string): Promise<GoalView> {
    const goal = await this.repository.get(uid, goalId);
    if (!goal) throw new ResourceNotFoundError("Goal");
    return this.view(goal);
  }

  async update(uid: string, goalId: string, input: GoalUpdateInput): Promise<GoalView> {
    const existing = await this.repository.get(uid, goalId);
    if (!existing) throw new ResourceNotFoundError("Goal");
    const updated = await this.repository.update(uid, goalId, completeInput(existing, input));
    if (!updated) throw new ResourceNotFoundError("Goal");
    return this.view(updated);
  }

  async delete(uid: string, goalId: string): Promise<void> {
    const deleted = await this.repository.delete(uid, goalId);
    if (!deleted) throw new ResourceNotFoundError("Goal");
  }
}