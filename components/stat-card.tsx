import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: string;
  hint: string;
}

export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <Card className="overflow-hidden border-t-[3px] border-t-cyan-400 bg-gradient-to-br from-white to-slate-50/60">
      <CardContent className="p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">{label}</p>
        <div className="gradient-heading mt-3 text-5xl font-bold tracking-tight">{value}</div>
        <div className="mt-4 flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
          <p className="text-sm text-slate-500">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}
