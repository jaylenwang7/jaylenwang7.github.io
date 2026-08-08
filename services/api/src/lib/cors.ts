import { ApiError } from "./http";

const ALLOWED_ORIGINS = new Set([
  "https://jaylenwang.com",
  "https://www.jaylenwang.com",
  "http://localhost:4000",
  "http://127.0.0.1:4000",
]);

export function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get("Origin");
  return origin !== null && ALLOWED_ORIGINS.has(origin);
}

export function requireAllowedOrigin(request: Request): void {
  if (!isAllowedOrigin(request)) {
    throw new ApiError(
      403,
      "forbidden_origin",
      "This origin cannot write interactions.",
    );
  }
}

export function corsHeaders(request: Request): Headers {
  const headers = new Headers({
    "Access-Control-Allow-Headers": "Content-Type, X-Visitor-Id",
    "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  });
  const origin = request.headers.get("Origin");

  if (origin !== null && ALLOWED_ORIGINS.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }

  return headers;
}

export function withCors(response: Response, request: Request): Response {
  const headers = new Headers(response.headers);
  corsHeaders(request).forEach((value, key) => headers.set(key, value));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
