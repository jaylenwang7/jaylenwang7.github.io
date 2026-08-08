import { voterHash } from "../../lib/identity";
import { json } from "../../lib/http";
import { manifestSubject } from "../../lib/manifest";
import type { Ctx, Route } from "../../lib/route";
import { maxSubjects, validateSubjectId } from "../../lib/validate";
import { getLikeState, getSubject, writeLikeState } from "./queries";

async function readLike(ctx: Ctx): Promise<Response> {
  const id = validateSubjectId(ctx.params.id);
  const hash =
    ctx.visitorId === null
      ? null
      : await voterHash(ctx.env.LIKES_HMAC_SECRET, id, ctx.visitorId);
  const state = await getLikeState(ctx.env.DB, id, hash);
  return json(state ?? { count: 0, liked: false });
}

async function writeLike(ctx: Ctx, liked: boolean): Promise<Response> {
  const id = validateSubjectId(ctx.params.id);
  const visitorId = ctx.visitorId as string;
  const existing = await getSubject(ctx.env.DB, id);
  const subject = existing ?? (await manifestSubject(ctx.env, id));
  const hash = await voterHash(ctx.env.LIKES_HMAC_SECRET, id, visitorId);
  const state = await writeLikeState(
    ctx.env.DB,
    subject,
    existing === null,
    hash,
    liked,
    maxSubjects(ctx.env.MAX_SUBJECTS),
  );
  return json(state);
}

export const likeRoutes: Route[] = [
  {
    method: "GET",
    pattern: "/v1/likes/:id",
    handler: readLike,
  },
  {
    method: "PUT",
    pattern: "/v1/likes/:id",
    handler: (ctx) => writeLike(ctx, true),
    limit: "write",
  },
  {
    method: "DELETE",
    pattern: "/v1/likes/:id",
    handler: (ctx) => writeLike(ctx, false),
    limit: "write",
  },
];
