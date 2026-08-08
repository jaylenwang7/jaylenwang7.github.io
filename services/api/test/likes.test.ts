import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index";
import { clearManifestCacheForTest } from "../src/lib/manifest";
import type { Env } from "../src/lib/route";

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

interface State {
  count: number;
  liked: boolean;
}

interface Subject {
  id: string;
  kind: string;
  path: string;
}

const ORIGIN = "https://jaylenwang.com";
const VISITOR_A = "7bcb7300-7590-4bb2-8d4c-7ab72195584f";
const VISITOR_B = "6e612c09-2a29-429f-82f0-0a168b402eed";
const SECRET = "test-secret-is-deliberately-longer-than-thirty-two-bytes";
const allowAll: RateLimit = {
  limit: async () => ({ success: true }),
};

function testEnv(): Env {
  return {
    DB: env.DB,
    LIKES_HMAC_SECRET: SECRET,
    MAX_SUBJECTS: "500",
    RL_IP: allowAll,
    RL_VISITOR: allowAll,
    SUBJECT_MANIFEST_URL: "https://site.test/api/subjects.json",
  };
}

function subject(id: string): Subject {
  return { id, kind: "writing", path: `/writing/2026/${id}/` };
}

function mockManifest(...responses: Array<Subject[] | { status: number }>) {
  const queue = responses.slice();
  const mock = vi.fn(async (_input: RequestInfo | URL) => {
    const next = queue.shift();
    if (next === undefined) throw new Error("unexpected manifest fetch");
    if (!Array.isArray(next)) return new Response("unavailable", { status: next.status });
    return new Response(JSON.stringify(next), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

async function request(
  method: string,
  path: string,
  options: {
    body?: string;
    origin?: string | null;
    visitor?: string | null;
  } = {},
): Promise<Response> {
  const headers = new Headers();
  if (options.origin !== null) headers.set("Origin", options.origin ?? ORIGIN);
  if (options.visitor !== null) {
    headers.set("X-Visitor-Id", options.visitor ?? VISITOR_A);
  }
  return worker.fetch(
    new Request(`https://api.test${path}`, {
      method,
      headers,
      body: options.body,
    }),
    testEnv(),
  );
}

async function envelope<T>(response: Response): Promise<Envelope<T>> {
  return response.json<Envelope<T>>();
}

beforeEach(async () => {
  vi.unstubAllGlobals();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM likes"),
    env.DB.prepare("DELETE FROM like_counts"),
    env.DB.prepare("DELETE FROM subjects"),
  ]);
  await clearManifestCacheForTest(testEnv());
});

describe("likes", () => {
  it("makes repeated likes idempotent", async () => {
    const fetchSpy = mockManifest([subject("entry-one")]);
    const first = await request("PUT", "/v1/likes/entry-one");
    const second = await request("PUT", "/v1/likes/entry-one");

    expect(first.status).toBe(200);
    expect(await envelope<State>(first)).toEqual({
      ok: true,
      data: { count: 1, liked: true },
    });
    expect(await envelope<State>(second)).toEqual({
      ok: true,
      data: { count: 1, liked: true },
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("deletes a never-liked subject without changing the count", async () => {
    mockManifest([subject("entry-one")]);
    const response = await request("DELETE", "/v1/likes/entry-one");

    expect(response.status).toBe(200);
    expect(await envelope<State>(response)).toEqual({
      ok: true,
      data: { count: 0, liked: false },
    });
  });

  it("supports like, unlike, then like", async () => {
    mockManifest([subject("entry-one")]);
    await request("PUT", "/v1/likes/entry-one");
    const unlike = await request("DELETE", "/v1/likes/entry-one");
    const relike = await request("PUT", "/v1/likes/entry-one");

    expect((await envelope<State>(unlike)).data).toEqual({ count: 0, liked: false });
    expect((await envelope<State>(relike)).data).toEqual({ count: 1, liked: true });
  });

  it("counts different visitors independently", async () => {
    mockManifest([subject("entry-one")]);
    await request("PUT", "/v1/likes/entry-one", { visitor: VISITOR_A });
    const response = await request("PUT", "/v1/likes/entry-one", {
      visitor: VISITOR_B,
    });

    expect((await envelope<State>(response)).data).toEqual({ count: 2, liked: true });
  });

  it("uses unlinkable hashes for one visitor on two subjects", async () => {
    mockManifest([subject("entry-one"), subject("entry-two")]);
    await request("PUT", "/v1/likes/entry-one");
    await request("PUT", "/v1/likes/entry-two");

    const rows = await env.DB.prepare(
      "SELECT subject_id, voter_hash FROM likes ORDER BY subject_id",
    ).all<{ subject_id: string; voter_hash: string }>();
    expect(rows.results).toHaveLength(2);
    expect(rows.results[0].voter_hash).not.toBe(rows.results[1].voter_hash);
    expect(rows.results.map((row) => row.voter_hash)).not.toContain(VISITOR_A);
  });

  it("returns server-authoritative liked state only when identified", async () => {
    mockManifest([subject("entry-one")]);
    await request("PUT", "/v1/likes/entry-one");

    const identified = await request("GET", "/v1/likes/entry-one", {
      visitor: VISITOR_A,
    });
    const publicRead = await request("GET", "/v1/likes/entry-one", {
      visitor: null,
    });

    expect((await envelope<State>(identified)).data).toEqual({ count: 1, liked: true });
    expect((await envelope<State>(publicRead)).data).toEqual({ count: 1, liked: false });
  });

  it("does not create or consult the manifest on an unknown GET", async () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error("must not fetch")));
    vi.stubGlobal("fetch", fetchSpy);
    const response = await request("GET", "/v1/likes/not-created", {
      origin: "https://elsewhere.example",
      visitor: null,
    });
    const row = await env.DB.prepare(
      "SELECT id FROM subjects WHERE id = 'not-created'",
    ).first();

    expect(response.status).toBe(200);
    expect((await envelope<State>(response)).data).toEqual({ count: 0, liked: false });
    expect(row).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refreshes a cached manifest miss before rejecting a new entry", async () => {
    const oldEntry = subject("old-entry");
    const newEntry = subject("new-entry");
    const initialFetch = mockManifest([oldEntry]);
    await request("PUT", "/v1/likes/old-entry");
    expect(initialFetch).toHaveBeenCalledTimes(1);

    const refreshFetch = mockManifest([oldEntry, newEntry]);
    const response = await request("PUT", "/v1/likes/new-entry");
    const refreshUrl = String(refreshFetch.mock.calls[0][0]);

    expect(response.status).toBe(200);
    expect((await envelope<State>(response)).data).toEqual({ count: 1, liked: true });
    expect(refreshFetch).toHaveBeenCalledTimes(1);
    expect(refreshUrl).toContain("jw_refresh=");
  });

  it("does not negative-cache a manifest miss", async () => {
    const id = "late-entry";
    const firstFetch = mockManifest([], []);
    const rejected = await request("PUT", `/v1/likes/${id}`);
    expect(rejected.status).toBe(404);
    expect(firstFetch).toHaveBeenCalledTimes(2);

    const secondFetch = mockManifest([subject(id)]);
    const accepted = await request("PUT", `/v1/likes/${id}`);
    expect(accepted.status).toBe(200);
    expect(secondFetch).toHaveBeenCalledTimes(1);
  });

  it("returns 503 for a registry failure but keeps known subjects working", async () => {
    await env.DB.prepare(
      "INSERT INTO subjects (id, kind, canonical_path) VALUES (?1, 'writing', ?2)",
    )
      .bind("known-entry", "/writing/2026/known-entry/")
      .run();
    const failedFetch = mockManifest({ status: 503 });

    const known = await request("PUT", "/v1/likes/known-entry");
    const unknown = await request("PUT", "/v1/likes/unknown-entry", {
      visitor: VISITOR_B,
    });

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(503);
    expect((await envelope<never>(unknown)).error?.code).toBe(
      "subject_registry_unavailable",
    );
    expect(failedFetch).toHaveBeenCalledTimes(1);
  });

  it.each(["UPPERCASE", "..%2F", "ab", "a".repeat(200), ""])(
    "rejects malformed subject id %s",
    async (id) => {
      const response = await request("GET", `/v1/likes/${id}`, {
        visitor: null,
      });
      expect(response.status).toBe(400);
      expect((await envelope<never>(response)).error?.code).toBe("bad_request");
    },
  );

  it("rejects missing and malformed visitor ids on writes", async () => {
    const missing = await request("PUT", "/v1/likes/entry-one", {
      visitor: null,
    });
    const malformed = await request("PUT", "/v1/likes/entry-one", {
      visitor: "not-a-uuid",
    });

    expect(missing.status).toBe(400);
    expect(malformed.status).toBe(400);
  });

  it("enforces capacity while allowing writes to existing subjects", async () => {
    await env.DB.prepare(
      `WITH RECURSIVE counter(value) AS (
         SELECT 1 UNION ALL SELECT value + 1 FROM counter WHERE value < 500
       )
       INSERT INTO subjects (id, kind, canonical_path)
       SELECT printf('seed-%03d', value), 'writing', printf('/writing/seed-%03d/', value)
       FROM counter`,
    ).run();
    mockManifest([subject("overflow-entry")]);

    const overflow = await request("PUT", "/v1/likes/overflow-entry");
    const existing = await request("PUT", "/v1/likes/seed-001", {
      visitor: VISITOR_B,
    });

    expect(overflow.status).toBe(507);
    expect(existing.status).toBe(200);
    expect((await envelope<State>(existing)).data).toEqual({ count: 1, liked: true });
  });

  it("keeps denormalised counts reconciled through a mixed operation sequence", async () => {
    const subjects = Array.from({ length: 5 }, (_, index) => subject(`entry-${index}`));
    const visitors = Array.from(
      { length: 8 },
      (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    );
    mockManifest(subjects);
    let seed = 1949;
    for (let index = 0; index < 80; index += 1) {
      seed = (seed * 48271) % 2147483647;
      const selectedSubject = subjects[seed % subjects.length].id;
      seed = (seed * 48271) % 2147483647;
      const selectedVisitor = visitors[seed % visitors.length];
      seed = (seed * 48271) % 2147483647;
      await request(seed % 2 === 0 ? "PUT" : "DELETE", `/v1/likes/${selectedSubject}`, {
        visitor: selectedVisitor,
      });
    }

    const drift = await env.DB.prepare(
      `SELECT subjects.id
       FROM subjects
       LEFT JOIN like_counts ON like_counts.subject_id = subjects.id
       LEFT JOIN likes ON likes.subject_id = subjects.id
       GROUP BY subjects.id, like_counts.count
       HAVING COALESCE(like_counts.count, 0) != COUNT(likes.voter_hash)`,
    ).all();
    expect(drift.results).toEqual([]);
  });
});

describe("CORS and methods", () => {
  it("rejects writes from disallowed or missing origins", async () => {
    const disallowed = await request("PUT", "/v1/likes/entry-one", {
      origin: "https://elsewhere.example",
    });
    const missing = await request("PUT", "/v1/likes/entry-one", {
      origin: null,
    });

    expect(disallowed.status).toBe(403);
    expect(missing.status).toBe(403);
  });

  it("allows public GETs from any origin but protects identified GETs", async () => {
    const publicRead = await request("GET", "/v1/likes/entry-one", {
      origin: "https://elsewhere.example",
      visitor: null,
    });
    const identified = await request("GET", "/v1/likes/entry-one", {
      origin: "https://elsewhere.example",
      visitor: VISITOR_A,
    });

    expect(publicRead.status).toBe(200);
    expect(identified.status).toBe(403);
    expect(publicRead.headers.get("Vary")).toBe("Origin");
  });

  it("answers preflight with the complete policy", async () => {
    const response = await request("OPTIONS", "/v1/likes/entry-one", {
      visitor: null,
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe(
      "GET, PUT, DELETE, OPTIONS",
    );
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe(
      "Content-Type, X-Visitor-Id",
    );
    expect(response.headers.get("Access-Control-Max-Age")).toBe("86400");
  });

  it("returns 405 with Allow for a known path", async () => {
    const response = await request("POST", "/v1/likes/entry-one");

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET, PUT, DELETE, OPTIONS");
  });

  it("rejects bodies over 1 KB", async () => {
    const response = await request("PUT", "/v1/likes/entry-one", {
      body: "x".repeat(2048),
    });

    expect(response.status).toBe(413);
    expect((await envelope<never>(response)).error?.code).toBe("payload_too_large");
  });
});
