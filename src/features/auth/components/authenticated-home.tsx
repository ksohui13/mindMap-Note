import type { CurrentUser } from "@/server/auth/session";

import { LogoutButton } from "./logout-button";

export function AuthenticatedHome({ user }: { user: CurrentUser }) {
  return (
    <main className="min-h-screen">
      <header className="border-b border-[var(--border)] bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-xl font-extrabold text-[var(--primary)]">Mindmap</span>
          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-[var(--background)]">
              <span className="grid size-9 place-items-center rounded-full bg-violet-100 font-bold text-[var(--primary)]">{user.email.slice(0, 1).toUpperCase()}</span>
              <span className="hidden text-sm text-[var(--muted)] sm:inline">{user.email}</span>
              <span aria-hidden="true" className="text-xs text-[var(--muted)] transition group-open:rotate-180">▼</span>
            </summary>
            <div className="absolute right-0 z-10 mt-2 w-48 rounded-xl border border-[var(--border)] bg-white p-2 shadow-[var(--shadow-card)]">
              <LogoutButton />
            </div>
          </details>
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-6 py-16">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--primary)]">Dashboard</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight">내 마인드맵</h1>
        <p className="mt-4 max-w-xl text-[var(--muted)]">로그인이 완료되었습니다. 다음 단계에서 마인드맵 목록과 생성 기능을 연결합니다.</p>
      </section>
    </main>
  );
}
