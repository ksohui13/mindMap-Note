import { createPrismaClient } from "@/server/db/client";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL is required for integration tests.");
}

export const integrationClient = createPrismaClient(testDatabaseUrl);
