import type { HealthPayload } from "../../shared/types/index.js";

export function getHealthPayload(): HealthPayload {
  return {
    status: "ok",
    service: "sejora-api",
    phase: "foundation",
  };
}