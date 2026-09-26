import type { GoalRecord, GoalStatus, GoalView } from "../types/index.js";

function roundedPercentage(numerator: number, denominator: number): number {
  return Math.round((numerator * 10000) / denominator) / 100;
}

export function calculateGoalProgress(goal: Pick<GoalRecord, "targetAmountMinor" | "currentAmountMinor" | "targetDate">, asOf: string): Pick<GoalView, "remainingAmountMinor" | "percentageComplete" | "status"> {
  const percentageComplete = Math.min(100, roundedPercentage(goal.currentAmountMinor, goal.targetAmountMinor));
  const remainingAmountMinor = Math.max(goal.targetAmountMinor - goal.currentAmountMinor, 0);
  let status: GoalStatus;
  if (goal.currentAmountMinor >= goal.targetAmountMinor) status = "completed";
  else if (goal.targetDate < asOf) status = "overdue";
  else if (percentageComplete >= 80) status = "nearly_there";
  else if (goal.currentAmountMinor === 0) status = "not_started";
  else status = "in_progress";
  return { remainingAmountMinor, percentageComplete, status };
}

export function goalView(goal: GoalRecord, asOf: string): GoalView {
  return { ...goal, ...calculateGoalProgress(goal, asOf) };
}