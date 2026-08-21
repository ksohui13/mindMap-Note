import { spawnSync } from "node:child_process";

import { config as loadEnvironment } from "dotenv";
import pg from "pg";

loadEnvironment({ path: ".env.test", quiet: true });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL is required.");
}

const parsedUrl = new URL(testDatabaseUrl);
const databaseName = decodeURIComponent(parsedUrl.pathname.slice(1));
const allowedHosts = new Set(["127.0.0.1", "localhost"]);

if (!allowedHosts.has(parsedUrl.hostname) || databaseName !== "mindmap_test") {
  throw new Error(
    "Refusing to reset an unsafe integration database. Use localhost/mindmap_test.",
  );
}

const adminUrl = new URL(parsedUrl);
adminUrl.pathname = "/postgres";
adminUrl.search = "";

const adminClient = new pg.Client({ connectionString: adminUrl.toString() });
await adminClient.connect();
const existing = await adminClient.query<{ exists: boolean }>(
  "SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
  [databaseName],
);

if (!existing.rows[0]?.exists) {
  await adminClient.query('CREATE DATABASE "mindmap_test"');
}

await adminClient.end();

const testClient = new pg.Client({ connectionString: testDatabaseUrl });
await testClient.connect();
await testClient.query('DROP SCHEMA IF EXISTS "public" CASCADE');
await testClient.query('CREATE SCHEMA "public"');
await testClient.query('GRANT ALL ON SCHEMA "public" TO "mindmap"');
await testClient.query('GRANT ALL ON SCHEMA "public" TO public');
await testClient.end();

const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const migration = spawnSync(npxCommand, ["prisma", "migrate", "deploy"], {
  cwd: process.cwd(),
  env: { ...process.env, DATABASE_URL: testDatabaseUrl },
  stdio: "inherit",
});

if (migration.status !== 0) {
  throw new Error(`Prisma migration failed with status ${migration.status ?? "unknown"}.`);
}
