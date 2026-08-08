import type { Env as WorkerEnv } from "../src/lib/route";

declare global {
  namespace Cloudflare {
    interface Env extends WorkerEnv {
      TEST_MIGRATIONS: Array<{ name: string; queries: string[] }>;
    }
  }
}

export {};
