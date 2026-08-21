# Server

Route Handler가 호출하는 인증, DB, repository, domain service를 둔다. UI module을 import하지 않는다.

- Next.js application code는 `db/index.ts`와 `domain/index.ts`의 `server-only` 경계를 통해 접근한다.
- Prisma seed와 integration test는 React Server runtime 밖에서 실행되므로 내부 `db/client.ts`와 repository/service module을 직접 사용한다.
- generated Prisma client는 `src/generated/prisma`에 생성되며 Git에 포함하지 않는다.
