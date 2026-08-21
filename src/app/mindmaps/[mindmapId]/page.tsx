import Link from "next/link";
import { notFound } from "next/navigation";

import { MindmapEditor } from "@/features/mindmap/components/mindmap-editor";
import { mindmapIdSchema } from "@/features/mindmap/api/contracts";
import { requireCurrentUser } from "@/server/auth/session";
import { DomainError } from "@/server/domain/errors";
import { toMindmapDetailDTO } from "@/server/domain/mindmap.dto";
import { getMindmapDetailForUser } from "@/server/domain/mindmap.service";

type MindmapPageProps = {
  params: Promise<{ mindmapId: string }>;
  searchParams: Promise<{ rootNodeId?: string; initialEdit?: string }>;
};

export default async function MindmapPage({ params, searchParams }: MindmapPageProps) {
  const user = await requireCurrentUser();
  const { mindmapId } = await params;
  const parsedId = mindmapIdSchema.safeParse(mindmapId);
  if (!parsedId.success) notFound();

  const result = await loadMindmapDetail(parsedId.data, user.id);
  if (result.kind === "integrity-error") return <EditorIntegrityError />;

  const query = await searchParams;
  const initialRootSelection =
    query.initialEdit === "1" && query.rootNodeId === result.detail.rootNodeId;
  return (
    <MindmapEditor
      mindmapId={result.detail.mindmap.id}
      initialData={result.detail}
      initialRootSelection={initialRootSelection}
    />
  );
}

async function loadMindmapDetail(mindmapId: string, userId: string) {
  try {
    return {
      kind: "success" as const,
      detail: toMindmapDetailDTO(await getMindmapDetailForUser(mindmapId, userId)),
    };
  } catch (error) {
    if (error instanceof DomainError && error.code === "NOT_FOUND") notFound();
    if (error instanceof DomainError && error.code === "DATA_INTEGRITY") {
      return { kind: "integrity-error" as const };
    }
    throw error;
  }
}

function EditorIntegrityError() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div role="alert" className="max-w-md rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-[var(--shadow-card)]">
        <h1 className="text-xl font-extrabold">마인드맵 구조를 표시할 수 없습니다</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">노드 연결 정보가 올바르지 않습니다. 데이터를 변경하지 않고 안전하게 중단했습니다.</p>
        <Link href="/" className="mt-6 inline-block rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-bold text-white">Dashboard로 돌아가기</Link>
      </div>
    </main>
  );
}
