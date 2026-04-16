import dynamic from "next/dynamic";
import { SectionHeader } from "@/components/section-header";

const NeedForm = dynamic(
  () => import("@/components/needs/need-form").then((m) => ({ default: m.NeedForm })),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-10 text-center text-sm text-slate-400">
        Loading form…
      </div>
    ),
  }
);

export default function NewNeedPage() {
  return (
    <div className="grid gap-6">
      <SectionHeader
        eyebrow="New Need"
        title="Define the player profile before you review"
        description="Set the threshold for measurables, experience, and production so the board sorts for what the staff actually needs."
      />
      <NeedForm />
    </div>
  );
}
