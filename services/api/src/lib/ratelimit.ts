import { ApiError } from "./http";
import { rateKey } from "./identity";
import type { Env } from "./route";

export async function enforceWriteLimits(
  env: Env,
  request: Request,
  visitorId: string,
): Promise<void> {
  const visitorKey = await rateKey(env.LIKES_HMAC_SECRET, visitorId);
  const ipKey = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const [visitorResult, ipResult] = await Promise.all([
    env.RL_VISITOR.limit({ key: visitorKey }),
    env.RL_IP.limit({ key: ipKey }),
  ]);

  if (!visitorResult.success || !ipResult.success) {
    throw new ApiError(429, "rate_limited", "Too many requests.");
  }
}
