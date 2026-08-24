import { spawnSync } from "node:child_process";

import pg from "pg";

import {
  assertDistinctDatabases,
  describeDatabase,
  resetPublicSchema,
  validateDedicatedDatabase,
} from "../../scripts/acceptance/database-safety";
import "../../scripts/acceptance/load-environment";

if (!process.env.TEST_DATABASE_URL) {
  const { config: loadEnvironment } = await import("dotenv");
  loadEnvironment({ path: ".env.test", quiet: true });
}

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL is required.");
}

const database = validateDedicatedDatabase({
  url: testDatabaseUrl,
  expectedDatabase: "mindmap_test",
  confirmation: process.env.TEST_DATABASE_RESET_CONFIRM,
  allowLocalWithoutConfirmation: true,
});
if (process.env.DATABASE_URL) {
  assertDistinctDatabases(process.env.DATABASE_URL, database.url);
}

if (database.isLocal) {
  const adminUrl = new URL(database.url);
  adminUrl.pathname = "/postgres";
  adminUrl.search = "";

  const adminClient = new pg.Client({ connectionString: adminUrl.toString() });
  await adminClient.connect();
  const existing = await adminClient.query<{ exists: boolean }>(
    "SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
    [database.databaseName],
  );

  if (!existing.rows[0]?.exists) {
    await adminClient.query('CREATE DATABASE "mindmap_test"');
  }
  await adminClient.end();
}

console.log(`[integration] Resetting dedicated database ${describeDatabase(database)}.`);
await resetPublicSchema(testDatabaseUrl);

const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const migration = spawnSync(npxCommand, ["prisma", "migrate", "deploy"], {
  cwd: process.cwd(),
  env: { ...process.env, DATABASE_URL: testDatabaseUrl },
  stdio: "inherit",
});

if (migration.status !== 0) {
  throw new Error(`Prisma migration failed with status ${migration.status ?? "unknown"}.`);
}
