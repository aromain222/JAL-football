export default function AppLoading() {
  return (
    <div className="grid gap-4">
      <div className="h-36 animate-pulse rounded-[28px] bg-white/80" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-48 animate-pulse rounded-[28px] bg-white/80" />
        <div className="h-48 animate-pulse rounded-[28px] bg-white/80" />
        <div className="h-48 animate-pulse rounded-[28px] bg-white/80" />
      </div>
    </div>
  );
}
