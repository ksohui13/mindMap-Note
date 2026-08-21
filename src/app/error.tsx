"use client";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ reset }: ErrorPageProps) {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <section className="max-w-md rounded-2xl bg-white p-8 text-center shadow-[var(--shadow-card)]">
        <h1 className="text-2xl font-bold">화면을 불러오지 못했습니다.</h1>
        <p className="mt-3 text-[var(--muted)]">잠시 후 다시 시도해 주세요.</p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-lg bg-[var(--primary)] px-5 py-3 font-semibold text-white hover:bg-[var(--primary-strong)]"
        >
          다시 시도
        </button>
      </section>
    </main>
  );
}
