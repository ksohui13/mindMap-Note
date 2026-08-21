import { z } from "zod";

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_BYTES = 72;

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(320, "이메일은 320자 이하여야 합니다.")
  .pipe(z.email("올바른 이메일 주소를 입력해 주세요."));

const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, "비밀번호는 8자 이상이어야 합니다.")
  .refine(
    (password) => new TextEncoder().encode(password).byteLength <= PASSWORD_MAX_BYTES,
    "비밀번호는 UTF-8 기준 72바이트 이하여야 합니다.",
  );

export const loginInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "비밀번호를 입력해 주세요."),
});

export const signupInputSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export type LoginInput = z.infer<typeof loginInputSchema>;
export type SignupInput = z.infer<typeof signupInputSchema>;
