import { compare, hash } from "bcryptjs";

const PASSWORD_HASH_ROUNDS = 12;
const DUMMY_PASSWORD_HASH =
  "$2b$12$C6UzMDM.H6dfI/f/IKcEe.2cE1WJMg1mVRa9M6XnYx93w6KzXKdK2";

export function hashPassword(password: string): Promise<string> {
  return hash(password, PASSWORD_HASH_ROUNDS);
}

export async function verifyPassword(
  password: string,
  passwordHash: string | null,
): Promise<boolean> {
  const comparableHash = passwordHash?.startsWith("$2")
    ? passwordHash
    : DUMMY_PASSWORD_HASH;
  const matches = await compare(password, comparableHash);

  return passwordHash?.startsWith("$2") === true && matches;
}
