import { afterAll, beforeEach } from "vitest";

import { integrationClient } from "./client";

beforeEach(async () => {
  await integrationClient.user.deleteMany();
});

afterAll(async () => {
  await integrationClient.$disconnect();
});
