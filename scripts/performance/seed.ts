import "../acceptance/load-environment";

import { createPrismaClient } from "../../src/server/db/client";
import { parseDatabaseEnv } from "../../src/shared/config/env";
import { seedPerformanceFixtures } from "./fixture";

const client = createPrismaClient(parseDatabaseEnv().DATABASE_URL);
try {
  await seedPerformanceFixtures(client);
  console.log("[performance] Seeded deterministic 100/1,000-node fixtures.");
} finally {
  await client.$disconnect();
}
