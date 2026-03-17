export default function ShortlistLoading() {
  return (
    <div className="grid gap-6">
      <div className="h-24 animate-pulse rounded-[28px] bg-white/80" />
      <div className="h-20 animate-pulse rounded-[28px] bg-white/80" />
      <div className="grid gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-[520px] animate-pulse rounded-[28px] bg-white/80" />
        ))}
      </div>
    </div>
  );
}
