interface StatCardProps {
  label: string;
  value: string;
  hint: string;
}

export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="rounded-2xl bord border-[#e4e8e5] bg-white p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">{label}</p>
      <p className="mt-2 font-mono text-[28px] font-semibold text-[#111827]">{value}</p>
      <p className="mt-1 text-[12px] text-[#9ca3af]">{hint}</p>
    </div>
  );
}
