"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import {
  loginInputSchema,
  signupInputSchema,
} from "@/features/auth/model/validation";
import type { OAuthProvider } from "@/shared/auth/oauth";

type AuthMode = "login" | "signup";
type FieldErrors = Partial<Record<"email" | "password", string>>;
type ApiFailure = {
  error?: {
    message?: string;
    fieldErrors?: Record<string, string[] | undefined>;
  };
};

type AuthScreenProps = Readonly<{
  enabledOAuthProviders?: readonly OAuthProvider[];
  oauthError?: string;
}>;

function BrandMark() {
  return (
    <span className="relative block size-10" aria-hidden="true">
      <span className="absolute left-4 top-0 size-3 rounded-full bg-[var(--primary)]" />
      <span className="absolute bottom-0 left-1 size-3 rounded-full bg-[var(--primary)]" />
      <span className="absolute bottom-1 right-0 size-3 rounded-full bg-[var(--primary)]" />
      <span className="absolute left-[18px] top-2 h-7 w-1 -rotate-[35deg] rounded bg-[var(--primary)]" />
      <span className="absolute bottom-3 left-3 h-1 w-6 rotate-[15deg] rounded bg-[var(--primary)]" />
    </span>
  );
}

function MindmapPreview() {
  const primaryNodes = [
    ["개요", "left-[61%] top-[12%] border-[#a98cff]"],
    ["시장 조사", "left-[61%] top-[42%] border-[#75a8ff]"],
    ["기능 정의", "left-[61%] top-[72%] border-[#73d9a0]"],
  ];
  const leafNodes = [
    ["목표 설정", "top-[6%]"],
    ["배경 분석", "top-[22%]"],
    ["경쟁사 분석", "top-[36%]"],
    ["고객 니즈", "top-[52%]"],
  ];

  return (
    <div className="relative mt-9 h-56 overflow-hidden rounded-3xl border border-white/80 bg-white/75 shadow-[var(--shadow-card)] backdrop-blur">
      <svg aria-hidden="true" className="absolute inset-0 size-full" viewBox="0 0 560 224" preserveAspectRatio="none">
        <path d="M205 112 C270 112 265 45 340 45" fill="none" stroke="#7c52ff" strokeWidth="2" />
        <path d="M205 112 C270 112 265 112 340 112" fill="none" stroke="#4c8dff" strokeWidth="2" />
        <path d="M205 112 C270 112 265 178 340 178" fill="none" stroke="#40bd7a" strokeWidth="2" />
        <path d="M420 45 C455 45 452 28 485 28 M420 45 C455 45 452 62 485 62" fill="none" stroke="#7c52ff" strokeWidth="1.5" />
        <path d="M420 112 C455 112 452 95 485 95 M420 112 C455 112 452 129 485 129" fill="none" stroke="#4c8dff" strokeWidth="1.5" />
      </svg>
      <span className="absolute left-[8%] top-[43%] rounded-2xl bg-gradient-to-r from-[#5125e8] to-[#7547ff] px-6 py-3 text-sm font-bold text-white shadow-lg">프로젝트 기획</span>
      {primaryNodes.map(([label, className]) => (
        <span key={label} className={`absolute rounded-xl border bg-white px-5 py-2 text-xs font-semibold ${className}`}>{label}</span>
      ))}
      {leafNodes.map(([label, className]) => (
        <span key={label} className={`absolute left-[85%] rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-[10px] text-[var(--muted)] ${className}`}>{label}</span>
      ))}
    </div>
  );
}

export function AuthScreen({
  enabledOAuthProviders = [],
  oauthError = "",
}: AuthScreenProps = {}) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState(oauthError);
  const [pending, setPending] = useState(false);
  const [oauthPending, setOAuthPending] = useState<OAuthProvider | null>(null);

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setPassword("");
    setFieldErrors({});
    setFormError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const schema = mode === "login" ? loginInputSchema : signupInputSchema;
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors;
      setFieldErrors({ email: errors.email?.[0], password: errors.password?.[0] });
      return;
    }

    setPending(true);
    setFieldErrors({});
    setFormError("");
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = (await response.json().catch(() => ({}))) as ApiFailure;
      if (!response.ok) {
        setFieldErrors({
          email: body.error?.fieldErrors?.email?.[0],
          password: body.error?.fieldErrors?.password?.[0],
        });
        setFormError(body.error?.message ?? "요청을 처리하지 못했습니다.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setFormError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-[1480px] items-center gap-10 px-5 py-8 lg:grid-cols-[1.08fr_0.92fr] lg:px-14">
      <section className="px-1 py-5 lg:px-8" aria-labelledby="brand-heading">
        <div className="flex items-center gap-3 text-2xl font-extrabold text-[var(--primary)]"><BrandMark /><span>Mindmap</span></div>
        <h1 id="brand-heading" className="mt-14 max-w-2xl text-4xl font-extrabold leading-[1.2] tracking-[-0.04em] sm:text-5xl">
          생각을 연결하고,<br /><span className="text-[var(--primary)]">지식을 정리하는</span> 가장 쉬운 방법
        </h1>
        <p className="mt-6 text-lg leading-8 text-[var(--muted)]">마인드맵으로 아이디어를 시각화하고,<br />체계적으로 정리해 보세요.</p>
        <MindmapPreview />
        <div className="mt-8 grid gap-3 text-sm text-[var(--muted)] sm:grid-cols-3">
          {[
            ["✦", "아이디어 시각화", "복잡한 생각을 한눈에"],
            ["⌘", "자유로운 구성", "원하는 위치에 직접 배치"],
            ["☁", "안전한 저장", "작성한 지식을 다시 복원"],
          ].map(([icon, title, text]) => (
            <div key={title} className="flex gap-3 rounded-2xl bg-white/55 p-3"><span className="text-xl text-[var(--primary)]" aria-hidden="true">{icon}</span><span><strong className="block text-[var(--foreground)]">{title}</strong>{text}</span></div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-xl rounded-[28px] border border-white bg-white/90 p-6 shadow-[0_24px_80px_rgb(46_40_90/14%)] backdrop-blur sm:p-10">
        <div className="grid grid-cols-2 border-b border-[var(--border)]" role="tablist" aria-label="인증 방식">
          {(["login", "signup"] as const).map((tab) => {
            const selected = mode === tab;
            return (
              <button key={tab} type="button" role="tab" aria-selected={selected} onClick={() => changeMode(tab)} className={`border-b-2 px-4 py-4 text-lg font-bold transition ${selected ? "border-[var(--primary)] text-[var(--primary)]" : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"}`}>
                {tab === "login" ? "로그인" : "회원가입"}
              </button>
            );
          })}
        </div>

        {enabledOAuthProviders.length > 0 && (
          <div className="mt-8 space-y-3" aria-label="소셜 로그인">
            {enabledOAuthProviders.map((provider) => {
              const label = provider === "google" ? "Google로 계속" : "카카오로 계속";
              const isPending = oauthPending === provider;
              return (
                <a
                  key={provider}
                  href={`/api/auth/oauth/${provider}/start`}
                  aria-disabled={oauthPending !== null}
                  onClick={(event) => {
                    if (oauthPending !== null) {
                      event.preventDefault();
                      return;
                    }
                    setOAuthPending(provider);
                  }}
                  className={`flex h-13 w-full items-center justify-center gap-3 rounded-xl border font-semibold transition ${
                    provider === "kakao"
                      ? "border-[#fee500] bg-[#fee500] text-[#191919] hover:bg-[#f6df00]"
                      : "border-[var(--border)] bg-white text-[var(--foreground)] hover:border-[#b7bac6]"
                  } ${oauthPending !== null ? "pointer-events-none opacity-60" : ""}`}
                >
                  <span aria-hidden="true" className="grid size-6 place-items-center rounded-full bg-white/80 text-xs font-extrabold">
                    {provider === "google" ? "G" : "K"}
                  </span>
                  {isPending ? "이동 중..." : label}
                </a>
              );
            })}
            <div className="flex items-center gap-3 py-2 text-xs text-[var(--muted)]" aria-hidden="true">
              <span className="h-px flex-1 bg-[var(--border)]" />
              <span>또는 이메일로 계속</span>
              <span className="h-px flex-1 bg-[var(--border)]" />
            </div>
          </div>
        )}

        <form className={enabledOAuthProviders.length > 0 ? "mt-3 space-y-6" : "mt-9 space-y-6"} onSubmit={handleSubmit} noValidate>
          <div>
            <label htmlFor="email" className="mb-2 block font-semibold">이메일</label>
            <input id="email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? "email-error" : undefined} placeholder="이메일을 입력하세요" className="h-14 w-full rounded-xl border border-[var(--border)] bg-white px-4 transition placeholder:text-[#a0a4b5] focus:border-[var(--primary)] focus:outline-none" />
            {fieldErrors.email && <p id="email-error" className="mt-2 text-sm text-[var(--danger)]">{fieldErrors.email}</p>}
          </div>
          <div>
            <label htmlFor="password" className="mb-2 block font-semibold">비밀번호</label>
            <div className="relative">
              <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? "password-error" : undefined} placeholder={mode === "login" ? "비밀번호를 입력하세요" : "8자 이상 입력하세요"} className="h-14 w-full rounded-xl border border-[var(--border)] bg-white px-4 pr-16 transition placeholder:text-[#a0a4b5] focus:border-[var(--primary)] focus:outline-none" />
              <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute inset-y-0 right-3 px-2 text-sm font-semibold text-[var(--muted)]" aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 표시"}>{showPassword ? "숨김" : "표시"}</button>
            </div>
            {fieldErrors.password && <p id="password-error" className="mt-2 text-sm text-[var(--danger)]">{fieldErrors.password}</p>}
          </div>
          {formError && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-[var(--danger)]">{formError}</p>}
          <button type="submit" disabled={pending} className="h-14 w-full rounded-xl bg-gradient-to-r from-[#5425eb] to-[#713cff] text-lg font-bold text-white shadow-lg shadow-violet-200 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0">
            {pending ? "처리 중..." : mode === "login" ? "로그인" : "계정 만들기"}
          </button>
        </form>
        <p className="mt-7 text-center text-sm text-[var(--muted)]">
          {mode === "login" ? "처음이신가요?" : "이미 계정이 있나요?"}{" "}
          <button type="button" onClick={() => changeMode(mode === "login" ? "signup" : "login")} className="font-bold text-[var(--primary)] underline-offset-4 hover:underline">{mode === "login" ? "회원가입" : "로그인"}</button>
        </p>
      </section>
    </main>
  );
}
