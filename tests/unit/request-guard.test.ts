import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { createRequestGuard } from "../../server/src/security/request-guard.js";

function response() {
  const value = new EventEmitter() as EventEmitter & { status: (code: number) => typeof value; json: (body: unknown) => typeof value };
  value.status = (code) => {
    (value as EventEmitter & { statusCode?: number }).statusCode = code;
    return value;
  };
  value.json = (body) => {
    (value as EventEmitter & { body?: unknown }).body = body;
    return value;
  };
  return value;
}

describe("provider request guard", () => {
  it("limits bursts per authenticated user and releases concurrency after completion", () => {
    let now = 1_000;
    const guard = createRequestGuard({ windowMs: 60_000, maxRequests: 2, maxConcurrent: 1, now: () => now });
    const request = { auth: { uid: "user-a" }, ip: "127.0.0.1", socket: { remoteAddress: "127.0.0.1" } } as never;
    const first = response();
    const next = () => undefined;

    guard(request, first as never, next);
    const concurrent = response();
    guard(request, concurrent as never, next);
    expect((concurrent as typeof concurrent & { statusCode?: number }).statusCode).toBe(429);

    first.emit("finish");
    const second = response();
    guard(request, second as never, next);
    expect((second as typeof second & { statusCode?: number }).statusCode).toBeUndefined();

    second.emit("finish");
    const limited = response();
    guard(request, limited as never, next);
    expect((limited as typeof limited & { statusCode?: number }).statusCode).toBe(429);

    now += 60_001;
    const afterWindow = response();
    guard(request, afterWindow as never, next);
    expect((afterWindow as typeof afterWindow & { statusCode?: number }).statusCode).toBeUndefined();
  });
});