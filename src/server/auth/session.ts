import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/server/db/client";
import type { DatabaseClient } from "@/server/db/types";
import {
  deleteSession,
  findSessionWithUserByTokenHash,
} from "@/server/domain/session.repository";
import { SESSION_COOKIE_NAME } from "@/shared/auth/constants";

import { hashSessionToken } from "./token";

export type CurrentUser = Readonly<{ id: string; email: string }>;

export async function getCurrentUserFromToken(
  token: string | undefined,
  client: DatabaseClient = prisma,
): Promise<CurrentUser | null> {
  if (!token) return null;

  const session = await findSessionWithUserByTokenHash(
    hashSessionToken(token),
    client,
  );

  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await deleteSession(session.id, client);
    return null;
  }

  return { id: session.user.id, email: session.user.email };
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  return getCurrentUserFromToken(token);
}

export async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
