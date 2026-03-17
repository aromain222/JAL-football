import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: string;
  hint: string;
}

export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <Card className="bg-white/85">
      <CardContent className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">{label}</p>
        <div className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">{value}</div>
        <p className="mt-2 text-sm text-slate-600">{hint}</p>
      </CardContent>
    </Card>
  );
}
