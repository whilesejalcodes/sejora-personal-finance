import { Router, type RequestHandler } from "express";
import { budgetCreateSchema, budgetIdSchema, budgetListQuerySchema, budgetUpdateSchema } from "../../../shared/schemas/index.js";
import { ApiError, validationError } from "../errors.js";
import { FirestoreBudgetRepository } from "./firestore-budget-repository.js";
import { BudgetService } from "./budget-service.js";
import type { BudgetRepository } from "./budget-repository.js";
import { FirestoreTransactionRepository } from "../transactions/firestore-transaction-repository.js";
import type { TransactionRepository } from "../transactions/transaction-repository.js";

type BudgetRouterOptions = {
  repository?: BudgetRepository;
  transactionRepository?: TransactionRepository;
  authenticate: RequestHandler;
};

function uidFrom(request: import("express").Request): string {
  if (!request.auth?.uid) throw new ApiError(401, "AUTHENTICATION_REQUIRED", "Authentication is required.");
  return request.auth.uid;
}

function parseOrThrow<T>(result: { success: true; data: T } | { success: false; error: import("zod").ZodError }): T {
  if (!result.success) throw validationError(result.error);
  return result.data;
}

export function createBudgetsRouter(options: BudgetRouterOptions): Router {
  const router = Router();
  const service = new BudgetService(
    options.repository ?? new FirestoreBudgetRepository(),
    options.transactionRepository ?? new FirestoreTransactionRepository(),
  );
  router.use(options.authenticate);

  router.get("/", async (request, response, next) => {
    try {
      response.json({ data: await service.list(uidFrom(request), parseOrThrow(budgetListQuerySchema.safeParse(request.query))) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/", async (request, response, next) => {
    try {
      response.status(201).json({ data: await service.create(uidFrom(request), parseOrThrow(budgetCreateSchema.safeParse(request.body))) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id", async (request, response, next) => {
    try {
      response.json({ data: await service.get(uidFrom(request), parseOrThrow(budgetIdSchema.safeParse(request.params.id))) });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:id", async (request, response, next) => {
    try {
      const budgetId = parseOrThrow(budgetIdSchema.safeParse(request.params.id));
      response.json({ data: await service.update(uidFrom(request), budgetId, parseOrThrow(budgetUpdateSchema.safeParse(request.body))) });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:id", async (request, response, next) => {
    try {
      await service.delete(uidFrom(request), parseOrThrow(budgetIdSchema.safeParse(request.params.id)));
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}