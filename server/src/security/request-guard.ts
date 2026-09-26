import type { RequestHandler } from "express";

type RequestGuardOptions = {
  windowMs: number;
  maxRequests: number;
  maxConcurrent: number;
  now?: () => number;
};

type RequestState = {
  timestamps: number[];
  active: number;
};

export function createRequestGuard(options: RequestGuardOptions): RequestHandler {
  const states = new Map<string, RequestState>();
  const now = options.now ?? Date.now;

  return (request, response, next) => {
    const key = request.auth?.uid ?? `ip:${request.ip || request.socket.remoteAddress || "unknown"}`;
    const timestamp = now();
    const current = states.get(key) ?? { timestamps: [], active: 0 };
    current.timestamps = current.timestamps.filter((value) => timestamp - value < options.windowMs);

    if (current.timestamps.length >= options.maxRequests || current.active >= options.maxConcurrent) {
      response.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Please try again shortly.",
        },
      });
      return;
    }

    current.timestamps.push(timestamp);
    current.active += 1;
    states.set(key, current);

    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      current.active = Math.max(0, current.active - 1);
      if (current.active === 0 && current.timestamps.length === 0) states.delete(key);
    };
    response.once("finish", release);
    response.once("close", release);
    next();
  };
}