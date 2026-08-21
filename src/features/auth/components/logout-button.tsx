"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    if (pending) return;
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={pending}
      className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-60"
    >
      {pending ? "로그아웃 중..." : "로그아웃"}
    </button>
  );
}
