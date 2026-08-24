import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../src/generated/prisma/client";
import {
  assertDistinctDatabases,
  validateDedicatedDatabase,
} from "../../scripts/acceptance/database-safety";
import { PERFORMANCE_MAPS } from "../../scripts/performance/fixture";

export default async function globalSetup(): Promise<void> {
  const acceptance = validateDedicatedDatabase({
    url: process.env.DATABASE_URL,
    expectedDatabase: "mindmap_acceptance",
    confirmation: process.env.ACCEPTANCE_DATABASE_RESET_CONFIRM,
  });
  if (!process.env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL is required.");
  assertDistinctDatabases(acceptance.url, process.env.TEST_DATABASE_URL);

  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString: acceptance.url, connectionTimeoutMillis: 5_000 }),
  });
  try {
    const fixtures = await client.mindmap.count({
      where: { id: { in: Object.values(PERFORMANCE_MAPS).map((map) => map.id) } },
    });
    if (fixtures !== Object.keys(PERFORMANCE_MAPS).length) {
      throw new Error("Performance fixtures are missing. Run npm run perf:seed first.");
    }
  } finally {
    await client.$disconnect();
  }
  process.env.E2E_DATABASE_READY = "true";
}
