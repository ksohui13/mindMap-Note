import { Prisma } from "@/generated/prisma/client";

export type DomainErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "CONFLICT"
  | "ROOT_DELETE_FORBIDDEN"
  | "DATA_INTEGRITY";

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
    public readonly cause?: unknown,
    public readonly details?: Readonly<Record<string, string | number | boolean>>,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export function isPrismaError(error: unknown, code: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
  );
}

export function mapPrismaError(error: unknown): never {
  if (isPrismaError(error, "P2002")) {
    throw new DomainError("CONFLICT", "A unique value already exists.", error);
  }

  if (isPrismaError(error, "P2003")) {
    throw new DomainError(
      "DATA_INTEGRITY",
      "A related record is missing or invalid.",
      error,
    );
  }

  if (isPrismaError(error, "P2025")) {
    throw new DomainError("NOT_FOUND", "The requested record was not found.", error);
  }

  throw error;
}
