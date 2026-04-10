import { Card, CardContent } from "@/components/ui/card";
import { scoutingDisplay } from "@/lib/football-ui";

interface StatCardProps {
  label: string;
  value: string;
  hint: string;
}

export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <Card className="overflow-hidden border-[#d8ddd7] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,247,244,0.94))] shadow-[0_20px_44px_rgba(15,23,42,0.08)]">
      <CardContent className="p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[#52695d]">{label}</p>
        <div className={`${scoutingDisplay.className} mt-3 text-[3.4rem] uppercase leading-none tracking-[0.04em] text-[#16261f]`}>
          {value}
        </div>
        <div className="mt-4 flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-[#d3b26c]" />
          <p className="text-sm text-slate-500">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}
