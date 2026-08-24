import pg from "pg";

const SYSTEM_DATABASES = new Set(["postgres", "template0", "template1"]);
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

export type DedicatedDatabase = Readonly<{
  url: string;
  databaseName: string;
  hostname: string;
  isLocal: boolean;
}>;

export function validateDedicatedDatabase({
  url,
  expectedDatabase,
  confirmation,
  allowLocalWithoutConfirmation = false,
}: {
  url: string | undefined;
  expectedDatabase: string;
  confirmation: string | undefined;
  allowLocalWithoutConfirmation?: boolean;
}): DedicatedDatabase {
  if (!url) throw new Error(`Database URL for ${expectedDatabase} is required.`);
  const parsed = new URL(url);
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error("Only PostgreSQL database URLs are accepted.");
  }
  const databaseName = decodeURIComponent(parsed.pathname.slice(1));
  const isLocal = LOCAL_HOSTS.has(parsed.hostname);
  if (!databaseName || SYSTEM_DATABASES.has(databaseName)) {
    throw new Error(`Refusing to reset unsafe database '${databaseName || "<empty>"}'.`);
  }
  if (databaseName !== expectedDatabase) {
    throw new Error(`Expected dedicated database '${expectedDatabase}', received '${databaseName}'.`);
  }
  if (!(allowLocalWithoutConfirmation && isLocal) && confirmation !== expectedDatabase) {
    throw new Error(
      `Set the reset confirmation to '${expectedDatabase}' before resetting this database.`,
    );
  }
  return { url, databaseName, hostname: parsed.hostname, isLocal };
}

export function assertDistinctDatabases(firstUrl: string, secondUrl: string): void {
  const normalize = (value: string) => {
    const parsed = new URL(value);
    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}:${parsed.port || "5432"}${parsed.pathname}`;
  };
  if (normalize(firstUrl) === normalize(secondUrl)) {
    throw new Error("Acceptance and integration databases must be different databases.");
  }
}

export async function resetPublicSchema(databaseUrl: string): Promise<void> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS "public" CASCADE');
    await client.query('CREATE SCHEMA "public"');
    await client.query('GRANT ALL ON SCHEMA "public" TO CURRENT_USER');
    await client.query('GRANT ALL ON SCHEMA "public" TO public');
  } finally {
    await client.end();
  }
}

export function describeDatabase(database: DedicatedDatabase): string {
  return `${database.hostname}/${database.databaseName}`;
}
