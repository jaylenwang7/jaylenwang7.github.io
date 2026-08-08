import {
  cloudflareTest,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          LIKES_HMAC_SECRET:
            "test-secret-is-deliberately-longer-than-thirty-two-bytes",
          MAX_SUBJECTS: "500",
          SUBJECT_MANIFEST_URL: "https://site.test/api/subjects.json",
          TEST_MIGRATIONS: await readD1Migrations("./migrations"),
        },
      },
    })),
  ],
  test: {
    setupFiles: ["./test/apply-migrations.ts"],
  },
});
