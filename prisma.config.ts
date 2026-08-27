import "dotenv/config";

import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Neon recommends a direct connection for migrations. Local development
    // keeps working with DATABASE_URL when DIRECT_URL is not configured.
    url: process.env.DIRECT_URL || env("DATABASE_URL"),
  },
});
