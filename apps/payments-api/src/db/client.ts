import type { Database as DbKitDatabase } from "@monorepo/db-kit";
import type * as schema from "./schema";

export { DATABASE } from "@monorepo/db-kit";

export type Database = DbKitDatabase<typeof schema>;
