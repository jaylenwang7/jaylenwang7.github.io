export interface Env {
  DB: D1Database;
  LIKES_HMAC_SECRET: string;
  MAX_SUBJECTS: string;
  RL_IP: RateLimit;
  RL_VISITOR: RateLimit;
  SUBJECT_MANIFEST_URL: string;
}

export type RouteMethod = "GET" | "PUT" | "DELETE" | "POST";

export interface Ctx {
  env: Env;
  params: Record<string, string>;
  request: Request;
  visitorId: string | null;
}

export interface Route {
  method: RouteMethod;
  pattern: string;
  handler: (ctx: Ctx) => Promise<Response>;
  limit?: "write";
}
