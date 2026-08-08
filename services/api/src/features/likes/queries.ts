import { ApiError } from "../../lib/http";
import type { ManifestSubject } from "../../lib/manifest";

export interface SubjectRow {
  id: string;
  kind: string;
  canonical_path: string;
}

export interface LikeState {
  count: number;
  liked: boolean;
}

interface LikeStateRow {
  count: number;
  liked: number;
}

const STATE_SQL = `
  SELECT
    COALESCE(like_counts.count, 0) AS count,
    CASE WHEN ?2 IS NULL THEN 0 ELSE EXISTS (
      SELECT 1 FROM likes
      WHERE likes.subject_id = subjects.id
        AND likes.voter_hash = ?2
    ) END AS liked
  FROM subjects
  LEFT JOIN like_counts ON like_counts.subject_id = subjects.id
  WHERE subjects.id = ?1
`;

export function getSubject(db: D1Database, id: string): Promise<SubjectRow | null> {
  return db
    .prepare("SELECT id, kind, canonical_path FROM subjects WHERE id = ?1")
    .bind(id)
    .first<SubjectRow>();
}

export async function getLikeState(
  db: D1Database,
  id: string,
  hash: string | null,
): Promise<LikeState | null> {
  const row = await db.prepare(STATE_SQL).bind(id, hash).first<LikeStateRow>();
  return row === null ? null : { count: row.count, liked: row.liked === 1 };
}

export async function writeLikeState(
  db: D1Database,
  subject: SubjectRow | ManifestSubject,
  subjectIsNew: boolean,
  hash: string,
  liked: boolean,
  maxSubjects: number,
): Promise<LikeState> {
  const statements: D1PreparedStatement[] = [];

  if (subjectIsNew) {
    const canonicalPath =
      "path" in subject ? subject.path : subject.canonical_path;
    statements.push(
      db
        .prepare(
          `INSERT INTO subjects (id, kind, canonical_path)
           SELECT ?1, ?2, ?3
           WHERE (SELECT COUNT(*) FROM subjects) < ?4
           ON CONFLICT(id) DO NOTHING`,
        )
        .bind(subject.id, subject.kind, canonicalPath, maxSubjects),
    );
  }

  statements.push(
    db
      .prepare(
        `INSERT INTO like_counts (subject_id, count)
         SELECT id, 0 FROM subjects WHERE id = ?1
         ON CONFLICT(subject_id) DO NOTHING`,
      )
      .bind(subject.id),
  );

  if (liked) {
    statements.push(
      db
        .prepare(
          `INSERT INTO likes (subject_id, voter_hash)
           SELECT ?1, ?2
           WHERE EXISTS (SELECT 1 FROM subjects WHERE id = ?1)
           ON CONFLICT(subject_id, voter_hash) DO NOTHING`,
        )
        .bind(subject.id, hash),
    );
  } else {
    statements.push(
      db
        .prepare("DELETE FROM likes WHERE subject_id = ?1 AND voter_hash = ?2")
        .bind(subject.id, hash),
    );
  }

  statements.push(db.prepare(STATE_SQL).bind(subject.id, hash));
  const results = await db.batch<LikeStateRow>(statements);
  const row = results[results.length - 1]?.results[0];

  if (row === undefined) {
    throw new ApiError(
      507,
      "capacity",
      "The interaction registry has reached capacity.",
    );
  }
  return { count: row.count, liked: row.liked === 1 };
}
