import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: string;
  hint: string;
}

export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <Card className="overflow-hidden bg-white/90">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">{label}</p>
            <div className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">{value}</div>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_rgba(255,255,255,0.55))]" />
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">{hint}</p>
      </CardContent>
    </Card>
  );
}
