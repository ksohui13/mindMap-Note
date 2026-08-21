export default function MindmapLoading() {
  return (
    <main aria-label="마인드맵 불러오는 중" className="h-screen overflow-hidden bg-[var(--background)]">
      <div className="h-[4.5rem] animate-pulse border-b border-[var(--border)] bg-white" />
      <div className="relative h-[calc(100vh-4.5rem)] animate-pulse bg-gradient-to-br from-violet-50 to-[var(--background)]">
        <div className="absolute left-1/2 top-1/2 h-16 w-48 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-violet-200" />
      </div>
    </main>
  );
}
