import { NextResponse } from "next/server";
import type { ZodError } from "zod";

import { AuthError } from "@/server/auth/errors";
import { DomainError } from "@/server/domain/errors";

const MAX_JSON_BODY_BYTES = 16 * 1_024;

export type ApiErrorCode =
  | "EMAIL_ALREADY_EXISTS"
  | "INTERNAL_ERROR"
  | "INVALID_CREDENTIALS"
  | "INVALID_ORIGIN"
  | "INVALID_REQUEST"
  | "PAYLOAD_TOO_LARGE"
  | "UNAUTHORIZED"
  | "VALIDATION_ERROR";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host");

  if (!origin || !host) {
    throw new ApiError(403, "INVALID_ORIGIN", "요청 출처를 확인할 수 없습니다.");
  }

  try {
    const originUrl = new URL(origin);
    if (!['http:', 'https:'].includes(originUrl.protocol) || originUrl.host !== host) {
      throw new ApiError(403, "INVALID_ORIGIN", "허용되지 않은 요청 출처입니다.");
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(403, "INVALID_ORIGIN", "요청 출처가 올바르지 않습니다.");
  }
}

export async function readJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    throw new ApiError(400, "INVALID_REQUEST", "JSON 요청만 지원합니다.");
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BODY_BYTES) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", "요청 본문이 너무 큽니다.");
  }

  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > MAX_JSON_BODY_BYTES) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", "요청 본문이 너무 큽니다.");
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new ApiError(400, "INVALID_REQUEST", "올바른 JSON을 입력해 주세요.");
  }
}

export function validationErrorResponse(error: ZodError): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: "VALIDATION_ERROR",
        message: "입력값을 확인해 주세요.",
        fieldErrors: error.flatten().fieldErrors,
      },
    },
    { status: 400 },
  );
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }

  if (error instanceof AuthError) {
    const status = error.code === "EMAIL_ALREADY_EXISTS" ? 409 : 401;
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status },
    );
  }

  if (error instanceof DomainError) {
    const status =
      error.code === "INVALID_INPUT"
        ? 400
        : error.code === "NOT_FOUND"
          ? 404
          : 409;
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status },
    );
  }

  console.error("[api] Unexpected server error");
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      },
    },
    { status: 500 },
  );
}
