# Reader interactions API

One Cloudflare Worker and one D1 database back reader interactions for
`jaylenwang.com`. Likes are the first feature. The service stores no raw visitor
IDs or IP addresses: it stores a subject-scoped HMAC for each like, while IPs
are used only as ephemeral Cloudflare rate-limit keys.

The site is the allowlist. On the first write to an unknown subject, the Worker
checks `https://jaylenwang.com/api/subjects.json`, caches a valid manifest for
five minutes, and records the matching subject metadata. Known subjects never
fetch the manifest. A miss forces one uncached refresh before rejection, so a
newly published entry is usable immediately; misses themselves are not cached.

## Local setup

```sh
npm ci
cp .dev.vars.example .dev.vars
openssl rand -base64 32
# Paste that value after LIKES_HMAC_SECRET= in .dev.vars.
npm run db:migrate:local
npm run dev
```

Run `npm run check` before committing. Tests use Vitest inside the Workers
runtime and a real local D1 database; they do not require a Cloudflare account.

The local Worker reads the manifest URL from `wrangler.jsonc`. Before the site
manifest exists, use a small local HTTP fixture or rely on the automated tests
for subject-creation requests. Reads of unknown subjects still return zero.

## API

Every response uses one envelope:

```json
{ "ok": true, "data": {} }
{ "ok": false, "error": { "code": "bad_request", "message": "..." } }
```

- `GET /v1/likes/:id` returns `{ count, liked }`. `liked` is authoritative when
  a valid `X-Visitor-Id` is supplied; without one it is `false`.
- `PUT /v1/likes/:id` creates an idempotent like. It requires an allowed
  `Origin`, a UUID v4 `X-Visitor-Id`, and an empty body.
- `DELETE /v1/likes/:id` removes that browser's like with the same requirements.

Identified reads are accepted only from the site's exact origin allowlist.
Public count reads return normally from any origin, while CORS headers are
reflected only for allowed site and local-development origins.

Example after `npm run dev`:

```sh
curl http://127.0.0.1:8787/v1/likes/example-entry

curl -X PUT http://127.0.0.1:8787/v1/likes/example-entry \
  -H 'Origin: http://127.0.0.1:4000' \
  -H 'X-Visitor-Id: 7bcb7300-7590-4bb2-8d4c-7ab72195584f'
```

## Production and deployment

The production Worker is:

<https://jaylenwang-interactions-api.jaylenwang.workers.dev>

Its D1 binding and database ID are committed in `wrangler.jsonc`; the HMAC
secret exists only in Cloudflare. To deploy an update locally, run:

```sh
npm run check
npm run db:migrate:remote
npm run deploy
```

To recreate the service in another Cloudflare account:

1. Authenticate Wrangler with `npx wrangler login`, or export a scoped
   `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
2. Run `npx wrangler d1 create jaylenwang-interactions` and replace the
   committed `database_id` in `wrangler.jsonc` with the returned ID.
3. Run `npm run db:migrate:remote`.
4. Generate at least 32 random bytes, then run
   `npx wrangler secret put LIKES_HMAC_SECRET` and paste the value.
5. Register an account-wide `workers.dev` subdomain, run `npm run deploy`, then
   repeat the curl checks against the returned URL.

The GitHub workflow runs the full check only when `services/api/` changes. A
deployment is manual (`workflow_dispatch`), waits for that check to pass,
applies remote migrations, and then deploys. Configure repository secrets
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` before using it.

## Reconciliation and repair

This query should return no rows:

```sql
SELECT
  subjects.id,
  COALESCE(like_counts.count, 0) AS recorded,
  COUNT(likes.voter_hash) AS actual
FROM subjects
LEFT JOIN like_counts ON like_counts.subject_id = subjects.id
LEFT JOIN likes ON likes.subject_id = subjects.id
GROUP BY subjects.id, like_counts.count
HAVING COALESCE(like_counts.count, 0) != COUNT(likes.voter_hash);
```

If it finds drift, back up D1 and run this repair:

```sql
INSERT INTO like_counts (subject_id, count)
SELECT subjects.id, COUNT(likes.voter_hash)
FROM subjects
LEFT JOIN likes ON likes.subject_id = subjects.id
GROUP BY subjects.id
ON CONFLICT(subject_id) DO UPDATE SET count = excluded.count;
```

Rotating `LIKES_HMAC_SECRET` intentionally makes every existing stored hash
unmatchable. Counts remain correct, but returning readers can like again and
cannot remove the old like. Rotate only after a suspected compromise and note
the event operationally.

## Cost limits

Cloudflare's free limits, verified 2026-08-08, are 100,000 Worker requests per
day; 5 million D1 rows read per day; 100,000 D1 rows written per day; and 5 GB
total D1 storage. Free accounts stop serving over-limit work rather than accrue
usage charges. Current sources:

- <https://developers.cloudflare.com/workers/platform/pricing/>
- <https://developers.cloudflare.com/d1/platform/pricing/>

The point-read `like_counts` table avoids metering every individual like row on
each page view. Expected traffic is orders of magnitude below all four limits.

## Adding another feature

Give the feature its own tables and correctness constraints in a new migration.
Put its handlers and queries in `src/features/<name>/`, reusing identity, CORS,
rate limiting, and the response envelope from `src/lib/`. Register its routes
in `src/registry.ts`. Keep writes idempotent, never store raw visitor IDs or
IPs, and do not accept free text or client-reported scores without a moderation
or server-side verification design.
