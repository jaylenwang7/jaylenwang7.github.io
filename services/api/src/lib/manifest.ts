import { ApiError } from "./http";
import { validateSubjectId } from "./validate";
import type { Env } from "./route";

export interface ManifestSubject {
  id: string;
  kind: string;
  path: string;
}

const CACHE_NAME = "jw-subject-manifest-v1";
const CACHE_TTL_SECONDS = 300;
const KIND = /^[a-z][a-z0-9-]{0,31}$/;

function cacheKey(env: Env): Request {
  return new Request(
    `https://interaction-cache.invalid/subjects?source=${encodeURIComponent(
      env.SUBJECT_MANIFEST_URL,
    )}`,
  );
}

function parseManifest(value: unknown): ManifestSubject[] {
  if (!Array.isArray(value)) throw new Error("manifest is not an array");

  return value.map((entry) => {
    if (entry === null || typeof entry !== "object") {
      throw new Error("manifest entry is not an object");
    }
    const candidate = entry as Record<string, unknown>;
    if (
      typeof candidate.id !== "string" ||
      typeof candidate.kind !== "string" ||
      typeof candidate.path !== "string"
    ) {
      throw new Error("manifest entry has invalid fields");
    }
    validateSubjectId(candidate.id);
    if (!KIND.test(candidate.kind) || !candidate.path.startsWith("/")) {
      throw new Error("manifest entry has invalid metadata");
    }
    return {
      id: candidate.id,
      kind: candidate.kind,
      path: candidate.path,
    };
  });
}

async function fetchManifest(env: Env, bypass: boolean): Promise<ManifestSubject[]> {
  const url = new URL(env.SUBJECT_MANIFEST_URL);
  if (bypass) url.searchParams.set("jw_refresh", String(Date.now()));

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new ApiError(
      503,
      "subject_registry_unavailable",
      "New interactions are temporarily unavailable.",
    );
  }

  if (!response.ok) {
    throw new ApiError(
      503,
      "subject_registry_unavailable",
      "New interactions are temporarily unavailable.",
    );
  }

  let subjects: ManifestSubject[];
  try {
    subjects = parseManifest(await response.json());
  } catch {
    throw new ApiError(
      503,
      "subject_registry_unavailable",
      "New interactions are temporarily unavailable.",
    );
  }

  const cache = await caches.open(CACHE_NAME);
  await cache.put(
    cacheKey(env),
    new Response(JSON.stringify(subjects), {
      headers: {
        "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}`,
        "Content-Type": "application/json; charset=utf-8",
      },
    }),
  );
  return subjects;
}

async function readManifest(env: Env, bypass: boolean): Promise<ManifestSubject[]> {
  if (!bypass) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(cacheKey(env));
    if (cachedResponse !== undefined) {
      try {
        return parseManifest(await cachedResponse.json());
      } catch {
        await cache.delete(cacheKey(env));
      }
    }
  }
  return fetchManifest(env, bypass);
}

export async function manifestSubject(env: Env, id: string): Promise<ManifestSubject> {
  const first = await readManifest(env, false);
  const cachedMatch = first.find((subject) => subject.id === id);
  if (cachedMatch !== undefined) return cachedMatch;

  // A cached manifest may predate a just-published entry. Re-fetch once while
  // bypassing both this Worker's Cache API key and upstream URL caches. The
  // miss itself is never stored, so publishing cannot create a dead zone.
  const refreshed = await readManifest(env, true);
  const freshMatch = refreshed.find((subject) => subject.id === id);
  if (freshMatch !== undefined) return freshMatch;

  throw new ApiError(
    404,
    "unknown_subject",
    "This subject is not available for interactions.",
  );
}

export async function clearManifestCacheForTest(env: Env): Promise<void> {
  const cache = await caches.open(CACHE_NAME);
  await cache.delete(cacheKey(env));
}
