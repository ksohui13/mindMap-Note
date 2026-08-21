import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-6 text-center">
      <section>
        <p className="text-sm font-semibold text-[var(--primary)]">404</p>
        <h1 className="mt-2 text-3xl font-bold">페이지를 찾을 수 없습니다.</h1>
        <Link className="mt-6 inline-block font-semibold text-[var(--primary)] underline" href="/">
          홈으로 돌아가기
        </Link>
      </section>
    </main>
  );
}
