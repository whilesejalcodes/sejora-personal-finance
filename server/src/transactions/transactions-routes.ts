import { Router, type RequestHandler } from "express";
import { transactionCreateSchema, transactionIdSchema, transactionListQuerySchema, transactionUpdateSchema } from "../../../shared/schemas/index.js";
import { ApiError, validationError } from "../errors.js";
import { FirestoreTransactionRepository } from "./firestore-transaction-repository.js";
import { TransactionService } from "./transaction-service.js";
import type { TransactionRepository } from "./transaction-repository.js";

type TransactionRouterOptions = {
  repository?: TransactionRepository;
  authenticate: RequestHandler;
};

function uidFrom(request: import("express").Request): string {
  if (!request.auth?.uid) {
    throw new ApiError(401, "AUTHENTICATION_REQUIRED", "Authentication is required.");
  }
  return request.auth.uid;
}

function parseOrThrow<T>(result: { success: true; data: T } | { success: false; error: import("zod").ZodError }): T {
  if (!result.success) throw validationError(result.error);
  return result.data;
}

export function createTransactionsRouter(options: TransactionRouterOptions): Router {
  const router = Router();
  const service = new TransactionService(options.repository ?? new FirestoreTransactionRepository());
  router.use(options.authenticate);

  router.get("/", async (request, response, next) => {
    try {
      const query = parseOrThrow(transactionListQuerySchema.safeParse(request.query));
      response.json({ data: await service.list(uidFrom(request), query) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/", async (request, response, next) => {
    try {
      const input = parseOrThrow(transactionCreateSchema.safeParse(request.body));
      response.status(201).json({ data: await service.create(uidFrom(request), input) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id", async (request, response, next) => {
    try {
      const transactionId = parseOrThrow(transactionIdSchema.safeParse(request.params.id));
      response.json({ data: await service.get(uidFrom(request), transactionId) });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:id", async (request, response, next) => {
    try {
      const transactionId = parseOrThrow(transactionIdSchema.safeParse(request.params.id));
      const input = parseOrThrow(transactionUpdateSchema.safeParse(request.body));
      response.json({ data: await service.update(uidFrom(request), transactionId, input) });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:id", async (request, response, next) => {
    try {
      const transactionId = parseOrThrow(transactionIdSchema.safeParse(request.params.id));
      await service.delete(uidFrom(request), transactionId);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}