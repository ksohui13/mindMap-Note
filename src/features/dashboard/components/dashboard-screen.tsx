"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { KeyboardEvent, useEffect, useRef, useState } from "react";

import { LogoutButton } from "@/features/auth/components/logout-button";
import {
  useDeleteMindmap,
  useCreateMindmap,
  useMindmaps,
  useRenameMindmap,
} from "@/features/dashboard/hooks/use-mindmaps";
import type { CreateMindmapInput, MindmapSummaryDTO } from "@/features/mindmap/api/contracts";
import { ExportModal, type ExportPreparationResult } from "@/features/mindmap/components/export-modal";
import {
  findUnresolvedExportDrafts,
  formatUnresolvedDraftMessage,
  getBrowserStorage,
} from "@/features/mindmap/lib/export-preflight";
import { DeleteConfirmModal } from "@/shared/ui/delete-confirm-modal";

export function formatMindmapUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function DashboardScreen({ user }: { user: { email: string } }) {
  const router = useRouter();
  const mindmaps = useMindmaps();
  const createMindmap = useCreateMindmap();
  const createInFlight = useRef(false);
  const creationTarget = useRef<{
    input: CreateMindmapInput;
    href: string;
  } | null>(null);

  function getCreationTarget() {
    if (creationTarget.current) return creationTarget.current;
    const mindmapId = crypto.randomUUID();
    const rootNodeId = crypto.randomUUID();
    creationTarget.current = {
      input: { mindmapId, rootNodeId },
      href: `/mindmaps/${mindmapId}?rootNodeId=${rootNodeId}&initialEdit=1&create=1`,
    };
    return creationTarget.current;
  }

  useEffect(() => {
    router.prefetch(getCreationTarget().href);
    // The target is created once and remains stable for this Dashboard mount.
  }, [router]);

  function handleCreate() {
    if (createInFlight.current || createMindmap.isPending) return;
    createInFlight.current = true;
    createMindmap.reset();
    const target = getCreationTarget();
    createMindmap.mutate(target.input, {
      onSuccess: () => {
        router.push(target.href);
      },
      onError: () => {
        createInFlight.current = false;
      },
    });
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-[var(--border)] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-6">
          <span className="text-xl font-extrabold text-[var(--primary)]">Mindmap</span>
          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-[var(--background)]">
              <span className="grid size-9 place-items-center rounded-full bg-violet-100 font-bold text-[var(--primary)]">
                {user.email.slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden text-sm text-[var(--muted)] sm:inline">{user.email}</span>
              <span aria-hidden="true" className="text-xs text-[var(--muted)] transition group-open:rotate-180">▼</span>
            </summary>
            <div className="absolute right-0 z-20 mt-2 w-48 rounded-xl border border-[var(--border)] bg-white p-2 shadow-[var(--shadow-card)]">
              <LogoutButton />
            </div>
          </details>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-6 sm:py-14">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--primary)]">Dashboard</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">내 마인드맵</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">전체 {mindmaps.data?.mindmaps.length ?? 0}개</p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <button
              type="button"
              onClick={handleCreate}
              disabled={createMindmap.isPending}
              className="rounded-xl bg-[var(--primary)] px-5 py-3 font-bold text-white shadow-lg shadow-violet-200 transition hover:bg-[var(--primary-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {createMindmap.isPending ? "마인드맵 만드는 중…" : "+ 새 마인드맵"}
            </button>
            {createMindmap.isError ? (
              <p role="alert" className="text-sm font-semibold text-[var(--danger)]">
                마인드맵을 만들지 못했습니다. 다시 시도해 주세요.
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-9">
          {mindmaps.isPending ? <DashboardSkeleton /> : null}
          {mindmaps.isError ? (
            <DashboardError onRetry={() => void mindmaps.refetch()} />
          ) : null}
          {mindmaps.isSuccess && mindmaps.data.mindmaps.length === 0 ? <EmptyDashboard /> : null}
          {mindmaps.isSuccess && mindmaps.data.mindmaps.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {mindmaps.data.mindmaps.map((mindmap) => (
                <MindmapCard key={mindmap.id} mindmap={mindmap} />
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-label="마인드맵 목록 불러오는 중" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-64 animate-pulse rounded-[var(--radius-lg)] border border-[var(--border)] bg-white/70" />
      ))}
    </div>
  );
}

function DashboardError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-[var(--radius-lg)] border border-red-200 bg-white p-8 text-center">
      <h2 className="font-bold">목록을 불러오지 못했습니다</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">잠시 후 다시 시도해 주세요.</p>
      <button type="button" onClick={onRetry} className="mt-5 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-bold hover:border-[var(--primary)]">
        다시 시도
      </button>
    </div>
  );
}

function EmptyDashboard() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-dashed border-violet-300 bg-white/80 px-6 py-16 text-center">
      <div aria-hidden="true" className="mx-auto grid size-16 place-items-center rounded-2xl bg-violet-100 text-3xl">✦</div>
      <h2 className="mt-5 text-xl font-extrabold">첫 마인드맵을 만들어 보세요</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">생각의 중심을 만들고 내용을 가지처럼 펼칠 수 있습니다.</p>
    </div>
  );
}

function MindmapCard({ mindmap }: { mindmap: MindmapSummaryDTO }) {
  const renameMindmap = useRenameMindmap();
  const deleteMindmap = useDeleteMindmap();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(mindmap.title);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  const deleteInFlight = useRef(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  async function prepareExport(): Promise<ExportPreparationResult> {
    const unresolved = await findUnresolvedExportDrafts({
      storage: getBrowserStorage(),
      mindmapId: mindmap.id,
    });
    return unresolved.length === 0
      ? { ok: true }
      : {
          ok: false,
          message: formatUnresolvedDraftMessage(unresolved.map((draft) => draft.title)),
        };
  }

  function beginRename() {
    setDraft(mindmap.title);
    setError(null);
    cancelledRef.current = false;
    setEditing(true);
  }

  async function commitRename() {
    if (cancelledRef.current || renameMindmap.isPending) return;
    const title = draft.trim();
    setEditing(false);
    if (!title) {
      setDraft(mindmap.title);
      setError("제목을 입력해 주세요.");
      return;
    }
    if (title === mindmap.title) return;
    try {
      await renameMindmap.mutateAsync({ id: mindmap.id, title });
      setError(null);
    } catch {
      setDraft(mindmap.title);
      setError("이름을 변경하지 못했습니다. 다시 시도해 주세요.");
    }
  }

  function handleRenameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") event.currentTarget.blur();
    if (event.key === "Escape") {
      cancelledRef.current = true;
      setDraft(mindmap.title);
      setEditing(false);
      setError(null);
    }
  }

  async function confirmDelete() {
    if (deleteInFlight.current) return;
    deleteInFlight.current = true;
    try {
      await deleteMindmap.mutateAsync({
        id: mindmap.id,
        expectedNodeCount: mindmap.nodeCount,
      });
      setDeleteOpen(false);
    } catch {
      // The modal keeps the server error visible and allows an explicit retry.
    } finally {
      deleteInFlight.current = false;
    }
  }

  return (
    <article className="group overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]">
      <Link aria-label={`${mindmap.title} 열기`} href={`/mindmaps/${mindmap.id}`} className="relative block h-36 w-full overflow-hidden bg-gradient-to-br from-violet-50 to-indigo-100 text-left">
        <span className="absolute left-1/2 top-1/2 h-px w-24 -translate-x-1/2 bg-violet-300" />
        <span className="absolute left-[22%] top-[30%] h-px w-20 rotate-[28deg] bg-indigo-300" />
        <span className="absolute left-[58%] top-[68%] h-px w-20 -rotate-[22deg] bg-indigo-300" />
        <span className="absolute left-1/2 top-1/2 grid h-11 min-w-24 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-xl bg-[var(--primary)] px-3 text-xs font-bold text-white">시작</span>
        <span className="absolute left-[10%] top-[18%] rounded-lg border border-violet-200 bg-white px-3 py-2 text-[10px] text-[var(--muted)]">아이디어</span>
        <span className="absolute bottom-[12%] right-[8%] rounded-lg border border-indigo-200 bg-white px-3 py-2 text-[10px] text-[var(--muted)]">메모</span>
      </Link>
      <div className="p-5">
        <div className="flex min-h-9 items-start justify-between gap-3">
          {editing ? (
            <input
              autoFocus
              aria-label="마인드맵 이름"
              value={draft}
              maxLength={200}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleRenameKeyDown}
              onBlur={() => void commitRename()}
              className="min-w-0 flex-1 rounded-lg border border-[var(--primary)] px-2 py-1 font-bold"
            />
          ) : (
            <Link href={`/mindmaps/${mindmap.id}`} className="min-w-0 flex-1 truncate text-left text-lg font-extrabold hover:text-[var(--primary)]">{mindmap.title}</Link>
          )}
          {!editing ? (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  aria-label={`${mindmap.title} 메뉴`}
                  className="grid size-8 place-items-center rounded-lg text-lg text-[var(--muted)] hover:bg-[var(--background)]"
                >
                  ⋯
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={4}
                  collisionPadding={8}
                  className="z-[80] w-40 rounded-lg border border-[var(--border)] bg-white p-1 text-left shadow-xl"
                >
                  <DropdownMenu.Item
                    onSelect={beginRename}
                    className="w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm outline-none hover:bg-[var(--background)] focus:bg-[var(--background)]"
                  >
                    이름 변경
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => setExportOpen(true)}
                    className="w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm outline-none hover:bg-[var(--background)] focus:bg-[var(--background)]"
                  >
                    Markdown 내보내기
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => {
                      deleteMindmap.reset();
                      setDeleteOpen(true);
                    }}
                    className="w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm font-bold text-[var(--danger)] outline-none hover:bg-red-50 focus:bg-red-50"
                  >
                    삭제
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          ) : null}
        </div>
        {error ? <p role="alert" className="mt-1 text-xs text-[var(--danger)]">{error}</p> : null}
        <div className="mt-4 flex items-center justify-between text-xs text-[var(--muted)]">
          <span>{formatMindmapUpdatedAt(mindmap.updatedAt)} 수정</span>
          <span>노드 {mindmap.nodeCount}개</span>
        </div>
      </div>
      <DeleteConfirmModal
        open={deleteOpen}
        title={`'${mindmap.title}' 마인드맵을 삭제하시겠습니까?`}
        description={`마인드맵과 포함된 노드 ${mindmap.nodeCount}개가 모두 삭제됩니다.`}
        pending={deleteMindmap.isPending}
        error={deleteMindmap.isError
          ? deleteMindmap.error.message || "마인드맵을 삭제하지 못했습니다."
          : null}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) deleteMindmap.reset();
        }}
        onConfirm={() => void confirmDelete()}
      />
      <ExportModal
        open={exportOpen}
        mindmapId={mindmap.id}
        mindmapTitle={mindmap.title}
        defaultScope="ALL"
        prepareExport={prepareExport}
        onOpenChange={setExportOpen}
      />
    </article>
  );
}
