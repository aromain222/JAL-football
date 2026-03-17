export default function PlayersLoading() {
  return (
    <div className="grid gap-6">
      <div className="h-24 animate-pulse rounded-[28px] bg-white/80" />
      <div className="h-72 animate-pulse rounded-[28px] bg-white/80" />
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-72 animate-pulse rounded-[28px] bg-white/80" />
        ))}
      </div>
    </div>
  );
}
