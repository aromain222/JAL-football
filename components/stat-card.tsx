import { Card, CardContent } from "@/components/ui/card";
import { scoutingDisplay } from "@/lib/football-ui";

interface StatCardProps {
  label: string;
  value: string;
  hint: string;
}

export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <Card className="scouting-surface overflow-hidden">
      <CardContent className="p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.32em] scouting-pill-label">{label}</p>
        <div className={`${scoutingDisplay.className} scouting-title mt-3 text-[3.4rem] uppercase leading-none tracking-[0.04em]`}>
          {value}
        </div>
        <div className="mt-4 flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--scout-gold)]" />
          <p className="text-sm text-slate-500">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}
