import { spawnSync } from "node:child_process";

import {
  assertDistinctDatabases,
  describeDatabase,
  resetPublicSchema,
  validateDedicatedDatabase,
} from "./database-safety";
import "./load-environment";

const acceptance = validateDedicatedDatabase({
  url: process.env.DATABASE_URL,
  expectedDatabase: "mindmap_acceptance",
  confirmation: process.env.ACCEPTANCE_DATABASE_RESET_CONFIRM,
});
if (process.env.TEST_DATABASE_URL) {
  assertDistinctDatabases(acceptance.url, process.env.TEST_DATABASE_URL);
}

console.log(`[acceptance] Resetting dedicated database ${describeDatabase(acceptance)}.`);
await resetPublicSchema(acceptance.url);
run("npx", ["prisma", "migrate", "deploy"]);
run("npx", ["prisma", "migrate", "status"]);
run("npm", ["run", "db:seed"]);
run("npm", ["run", "db:seed"]);

function run(command: string, args: string[]): void {
  const executable = process.platform === "win32" ? `${command}.cmd` : command;
  const result = spawnSync(executable, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with status ${result.status ?? "unknown"}.`);
  }
}
