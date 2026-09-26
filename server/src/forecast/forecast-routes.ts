import { Router, type RequestHandler } from "express";
import { forecastQuerySchema, forecastSimulationSchema } from "../../../shared/schemas/index.js";
import { ApiError, validationError } from "../errors.js";
import { FirestoreTransactionRepository } from "../transactions/firestore-transaction-repository.js";
import type { TransactionRepository } from "../transactions/transaction-repository.js";
import { ForecastService } from "./forecast-service.js";

type ForecastRouterOptions = {
  authenticate: RequestHandler;
  transactionRepository?: TransactionRepository;
  clock?: () => string;
};

function uidFrom(request: import("express").Request): string {
  if (!request.auth?.uid) throw new ApiError(401, "AUTHENTICATION_REQUIRED", "Authentication is required.");
  return request.auth.uid;
}

function parseOrThrow<T>(result: { success: true; data: T } | { success: false; error: import("zod").ZodError }): T {
  if (!result.success) throw validationError(result.error);
  return result.data;
}

export function createForecastRouter(options: ForecastRouterOptions): Router {
  const router = Router();
  const service = new ForecastService(options.transactionRepository ?? new FirestoreTransactionRepository(), options.clock);
  router.use(options.authenticate);

  router.get("/forecast", async (request, response, next) => {
    try {
      const query = parseOrThrow(forecastQuerySchema.safeParse(request.query));
      response.json({ data: await service.forecast(uidFrom(request), query.horizon ?? 3) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/forecast/simulate", async (request, response, next) => {
    try {
      const input = parseOrThrow(forecastSimulationSchema.safeParse(request.body));
      response.json({ data: await service.simulate(uidFrom(request), input) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}