import { describe, expect, it } from "vitest";

import { requireOwnedMindmap } from "@/server/auth/authorization";
import { login, logout, signup } from "@/server/auth/service";
import { completeOAuthIdentity } from "@/server/auth/oauth-service";
import { getCurrentUserFromToken } from "@/server/auth/session";
import { hashSessionToken } from "@/server/auth/token";
import { createMindmapWithRoot } from "@/server/domain/mindmap.service";

import { integrationClient } from "./client";

describe("authentication services", () => {
  it("signs up with normalized email and creates a usable opaque session", async () => {
    const result = await signup(
      { email: "  Auth@Example.TEST ", password: "password123" },
      integrationClient,
    );

    expect(result.user.email).toBe("auth@example.test");
    expect(result.session.token).not.toMatch(/auth@example/i);
    await expect(
      getCurrentUserFromToken(result.session.token, integrationClient),
    ).resolves.toEqual(result.user);
    expect(
      await integrationClient.session.findUnique({
        where: { tokenHash: hashSessionToken(result.session.token) },
      }),
    ).not.toBeNull();
  });

  it("rejects duplicate signup and genericizes login failures", async () => {
    await signup(
      { email: "duplicate@example.test", password: "password123" },
      integrationClient,
    );
    await expect(
      signup(
        { email: " DUPLICATE@example.test ", password: "password456" },
        integrationClient,
      ),
    ).rejects.toMatchObject({ code: "EMAIL_ALREADY_EXISTS" });

    await expect(
      login(
        { email: "missing@example.test", password: "password123" },
        integrationClient,
      ),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await expect(
      login(
        { email: "duplicate@example.test", password: "wrong" },
        integrationClient,
      ),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });

  it("logs in and revokes the database session on logout", async () => {
    await signup(
      { email: "login@example.test", password: "password123" },
      integrationClient,
    );
    const loggedIn = await login(
      { email: "login@example.test", password: "password123" },
      integrationClient,
    );
    await logout(loggedIn.session.token, integrationClient);
    await expect(
      getCurrentUserFromToken(loggedIn.session.token, integrationClient),
    ).resolves.toBeNull();
  });

  it("deletes expired sessions during verification", async () => {
    const signedUp = await signup(
      { email: "expired@example.test", password: "password123" },
      integrationClient,
    );
    await integrationClient.session.updateMany({
      where: { userId: signedUp.user.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    await expect(
      getCurrentUserFromToken(signedUp.session.token, integrationClient),
    ).resolves.toBeNull();
    expect(
      await integrationClient.session.count({ where: { userId: signedUp.user.id } }),
    ).toBe(0);
  });

  it("returns the same not-found result for missing and another user's mindmap", async () => {
    const owner = await signup(
      { email: "owner@example.test", password: "password123" },
      integrationClient,
    );
    const viewer = await signup(
      { email: "viewer@example.test", password: "password123" },
      integrationClient,
    );
    const { mindmap } = await createMindmapWithRoot(owner.user.id, integrationClient);

    await expect(
      requireOwnedMindmap(mindmap.id, viewer.user.id, integrationClient),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      requireOwnedMindmap("00000000-0000-0000-0000-000000000000", viewer.user.id, integrationClient),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("creates and reuses an OAuth-only account with the existing session model", async () => {
    const first = await completeOAuthIdentity(
      {
        provider: "google",
        providerAccountId: "google-subject-1",
        email: "oauth@example.test",
      },
      integrationClient,
    );
    expect(first.user.email).toBe("oauth@example.test");
    expect(await integrationClient.user.findUnique({
      where: { id: first.user.id },
      select: { passwordHash: true },
    })).toEqual({ passwordHash: null });

    const second = await completeOAuthIdentity(
      {
        provider: "google",
        providerAccountId: "google-subject-1",
        email: "changed@example.test",
      },
      integrationClient,
    );
    expect(second.user).toEqual(first.user);
    expect(second.session.token).not.toBe(first.session.token);
  });

  it("does not automatically link OAuth to an existing email account", async () => {
    await signup(
      { email: "collision@example.test", password: "password123" },
      integrationClient,
    );
    await expect(completeOAuthIdentity(
      {
        provider: "google",
        providerAccountId: "google-subject-collision",
        email: "collision@example.test",
      },
      integrationClient,
    )).rejects.toMatchObject({ code: "OAUTH_ACCOUNT_CONFLICT" });
    expect(await integrationClient.oAuthAccount.count()).toBe(0);
  });
});
