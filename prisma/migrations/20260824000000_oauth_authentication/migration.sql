-- Existing password accounts keep their hashes; OAuth-only accounts have no password.
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

CREATE TABLE "OAuthAccount" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(20) NOT NULL,
    "providerAccountId" VARCHAR(255) NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OAuthAccount_provider_check" CHECK ("provider" IN ('google', 'kakao')),
    CONSTRAINT "OAuthAccount_provider_account_id_check" CHECK (length(btrim("providerAccountId")) > 0)
);

CREATE TABLE "OAuthAttempt" (
    "id" UUID NOT NULL,
    "stateHash" CHAR(64) NOT NULL,
    "provider" VARCHAR(20) NOT NULL,
    "codeVerifier" VARCHAR(128) NOT NULL,
    "nonce" VARCHAR(128) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OAuthAttempt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OAuthAttempt_state_hash_check" CHECK ("stateHash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "OAuthAttempt_provider_check" CHECK ("provider" IN ('google', 'kakao')),
    CONSTRAINT "OAuthAttempt_material_check" CHECK (
        length(btrim("codeVerifier")) > 0 AND length(btrim("nonce")) > 0
    )
);

CREATE UNIQUE INDEX "OAuthAccount_provider_providerAccountId_key"
ON "OAuthAccount"("provider", "providerAccountId");
CREATE INDEX "OAuthAccount_userId_idx" ON "OAuthAccount"("userId");
CREATE UNIQUE INDEX "OAuthAttempt_stateHash_key" ON "OAuthAttempt"("stateHash");
CREATE INDEX "OAuthAttempt_expiresAt_idx" ON "OAuthAttempt"("expiresAt");

ALTER TABLE "OAuthAccount"
ADD CONSTRAINT "OAuthAccount_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
