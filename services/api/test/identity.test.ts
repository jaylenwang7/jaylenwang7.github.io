import { describe, expect, it } from "vitest";
import { rateKey, voterHash } from "../src/lib/identity";

const VISITOR = "7bcb7300-7590-4bb2-8d4c-7ab72195584f";
const SECRET_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SECRET_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

describe("identity derivation", () => {
  it("is stable for the same inputs", async () => {
    const first = await voterHash(SECRET_A, "entry-one", VISITOR);
    const second = await voterHash(SECRET_A, "entry-one", VISITOR);

    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes when the secret changes and re-imports on rotation", async () => {
    const original = await voterHash(SECRET_A, "entry-one", VISITOR);
    const rotated = await voterHash(SECRET_B, "entry-one", VISITOR);
    const restored = await voterHash(SECRET_A, "entry-one", VISITOR);

    expect(rotated).not.toBe(original);
    expect(restored).toBe(original);
  });

  it("scopes stored hashes to a subject and rate keys only to a visitor", async () => {
    const firstSubject = await voterHash(SECRET_A, "entry-one", VISITOR);
    const secondSubject = await voterHash(SECRET_A, "entry-two", VISITOR);
    const limiter = await rateKey(SECRET_A, VISITOR);

    expect(firstSubject).not.toBe(secondSubject);
    expect(limiter).not.toBe(firstSubject);
  });
});
