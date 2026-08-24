import type { User } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import type { DatabaseClient } from "@/server/db/types";

import { DomainError, mapPrismaError } from "./errors";
import { normalizeEmail } from "./normalization";

export type CreateUserInput = {
  email: string;
  passwordHash: string | null;
};

export async function createUser(
  input: CreateUserInput,
  client: DatabaseClient = prisma,
): Promise<User> {
  const passwordHash = input.passwordHash?.trim() ?? null;

  if (passwordHash !== null && (passwordHash.length === 0 || passwordHash.length > 255)) {
    throw new DomainError(
      "INVALID_INPUT",
      "Password hash must be between 1 and 255 characters.",
    );
  }

  try {
    return await client.user.create({
      data: {
        email: normalizeEmail(input.email),
        passwordHash,
      },
    });
  } catch (error) {
    return mapPrismaError(error);
  }
}

export function findUserById(
  id: string,
  client: DatabaseClient = prisma,
): Promise<User | null> {
  return client.user.findUnique({ where: { id } });
}

export function findUserByEmail(
  email: string,
  client: DatabaseClient = prisma,
): Promise<User | null> {
  return client.user.findUnique({ where: { email: normalizeEmail(email) } });
}
