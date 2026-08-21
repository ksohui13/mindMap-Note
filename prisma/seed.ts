import { prisma } from "../src/server/db/client";
import { createMindmapWithRoot } from "../src/server/domain/mindmap.service";
import { createUser, findUserByEmail } from "../src/server/domain/user.repository";

const DISABLED_PASSWORD_HASH = "DISABLED_UNTIL_AUTH_STAGE";
const DEVELOPMENT_USERS = ["alice@example.test", "bob@example.test"] as const;

async function ensureDevelopmentUser(email: string) {
  const existing = await findUserByEmail(email);
  const user =
    existing ??
    (await createUser({
      email,
      passwordHash: DISABLED_PASSWORD_HASH,
    }));
  const mindmapCount = await prisma.mindmap.count({ where: { userId: user.id } });

  if (mindmapCount === 0) {
    await createMindmapWithRoot(user.id);
  }
}

async function main() {
  for (const email of DEVELOPMENT_USERS) {
    await ensureDevelopmentUser(email);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
