import { likeRoutes } from "./features/likes/routes";
import type { Route } from "./lib/route";

// A future feature owns a folder and a migration, then registers its routes
// here. Shared transport, identity, CORS, and abuse controls stay untouched.
export const routes: Route[] = [...likeRoutes];
