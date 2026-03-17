import { NeedForm } from "@/components/needs/need-form";
import { SectionHeader } from "@/components/section-header";

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
