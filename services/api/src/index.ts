import { corsHeaders, isAllowedOrigin, requireAllowedOrigin, withCors } from "./lib/cors";
import { ApiError, fail, internalFailure } from "./lib/http";
import { enforceWriteLimits } from "./lib/ratelimit";
import type { Env, Route } from "./lib/route";
import { readVisitorId, requireEmptyBody } from "./lib/validate";
import { routes } from "./registry";

interface Match {
  params: Record<string, string>;
  route: Route;
}

function matchPattern(pattern: string, pathname: string): Record<string, string> | null {
  const patternParts = pattern.split("/");
  const pathParts = pathname.split("/");
  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};
  for (let index = 0; index < patternParts.length; index += 1) {
    const patternPart = patternParts[index];
    const pathPart = pathParts[index];
    if (patternPart.startsWith(":")) {
      try {
        params[patternPart.slice(1)] = decodeURIComponent(pathPart);
      } catch {
        throw new ApiError(400, "bad_request", "The request path is invalid.");
      }
    } else if (patternPart !== pathPart) {
      return null;
    }
  }
  return params;
}

function matchesFor(pathname: string): Match[] {
  const matches: Match[] = [];
  for (const route of routes) {
    const params = matchPattern(route.pattern, pathname);
    if (params !== null) matches.push({ route, params });
  }
  return matches;
}

function allowHeader(matches: Match[]): string {
  const methods = matches.map(({ route }) => route.method);
  return [...new Set([...methods, "OPTIONS"])].join(", ");
}

async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pathMatches = matchesFor(url.pathname);
  if (pathMatches.length === 0) {
    if (url.pathname === "/v1/likes" || url.pathname === "/v1/likes/") {
      throw new ApiError(400, "bad_request", "The subject id is invalid.");
    }
    throw new ApiError(404, "not_found", "The endpoint was not found.");
  }

  const allow = allowHeader(pathMatches);
  if (request.method === "OPTIONS") {
    requireAllowedOrigin(request);
    return new Response(null, { status: 204, headers: { Allow: allow } });
  }

  const matched = pathMatches.find(({ route }) => route.method === request.method);
  if (matched === undefined) {
    throw new ApiError(405, "not_allowed", "The method is not allowed.", {
      Allow: allow,
    });
  }

  const isWrite = matched.route.limit === "write";
  const visitorId = readVisitorId(request, isWrite);

  if (isWrite) {
    requireAllowedOrigin(request);
    await requireEmptyBody(request);
    await enforceWriteLimits(env, request, visitorId as string);
  } else if (visitorId !== null && !isAllowedOrigin(request)) {
    // Public counts need no identity. Once a visitor id is attached, keep the
    // request entry-page-only by requiring the site's exact allowed origin.
    throw new ApiError(
      403,
      "forbidden_origin",
      "This origin cannot read interaction state.",
    );
  }

  return matched.route.handler({
    env,
    params: matched.params,
    request,
    visitorId,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    let response: Response;
    try {
      response = await handle(request, env);
    } catch (error) {
      response = error instanceof ApiError ? fail(error) : internalFailure();
    }
    return withCors(response, request);
  },
} satisfies ExportedHandler<Env>;

export { corsHeaders };
