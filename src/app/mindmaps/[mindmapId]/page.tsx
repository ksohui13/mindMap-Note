import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { MindmapEditor } from "@/features/mindmap/components/mindmap-editor";
import { MindmapCreationPage } from "@/features/mindmap/components/mindmap-creation-page";
import { mindmapIdSchema } from "@/features/mindmap/api/contracts";
import { getCurrentUserWithMindmap, requireCurrentUser } from "@/server/auth/session";
import { DomainError } from "@/server/domain/errors";
import { toMindmapDetailDTO } from "@/server/domain/mindmap.dto";
import type { MindmapDetailRecord } from "@/server/domain/mindmap.repository";
import { validateMindmapTree } from "@/server/domain/mindmap-tree";

type MindmapPageProps = {
  params: Promise<{ mindmapId: string }>;
  searchParams: Promise<{ rootNodeId?: string; initialEdit?: string; create?: string }>;
};

export default async function MindmapPage({ params, searchParams }: MindmapPageProps) {
  const { mindmapId } = await params;
  const parsedId = mindmapIdSchema.safeParse(mindmapId);
  if (!parsedId.success) notFound();

  const query = await searchParams;
  const parsedRootId = mindmapIdSchema.safeParse(query.rootNodeId);
  if (query.create === "1" && parsedRootId.success) {
    await requireCurrentUser();
    return <MindmapCreationPage mindmapId={parsedId.data} rootNodeId={parsedRootId.data} />;
  }

  const sessionResult = await getCurrentUserWithMindmap(parsedId.data);
  if (!sessionResult) redirect("/login");
  if (!sessionResult.mindmap) notFound();
  const result = loadSessionMindmapDetail(sessionResult.mindmap);
  if (result.kind === "integrity-error") return <EditorIntegrityError />;

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

function loadSessionMindmapDetail(detail: MindmapDetailRecord) {
  try {
    return {
      kind: "success" as const,
      detail: toMindmapDetailDTO({ ...detail, rootNodeId: validateMindmapTree(detail.nodes) }),
    };
  } catch (error) {
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
