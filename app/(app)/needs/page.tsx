import Link from "next/link";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import { deleteNeedAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { getNeeds } from "@/lib/data/queries";
import { cn } from "@/lib/utils";

export default async function NeedsPage() {
  const needs = await getNeeds();

  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between border-b border-[#e4e8e5] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Needs</h1>
          <p className="mt-1 text-sm text-[#9ca3af]">{needs.length} active recruiting priorities</p>
        </div>
        <Link
          href="/needs/new"
          className="flex items-center gap-2 rounded-xl bg-[#15542a] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a6934]"
        >
          <Plus className="h-4 w-4" />
          New need
        </Link>
      </div>

      <div className="grid gap-3">
        {needs.length ? needs.map((need) => (
          <div
            key={need.id}
            className={cn(
              "rounded-2xl border border-[#e4e8e5] bg-white p-5",
              need.priority === "critical" && "border-l-4 border-l-red-400"
            )}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{need.position}</Badge>
                  <Badge variant={need.priority === "critical" ? "destructive" : "accent"}>
                    {need.priority}
                  </Badge>
                  <Badge variant="default">{need.target_count} spots</Badge>
                </div>
                <h2 className="mt-2 text-[18px] font-bold text-[#111827]">{need.title}</h2>
                {need.notes && (
                  <p className="mt-1 max-w-2xl text-sm text-[#4b5563]">{need.notes}</p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/needs/${need.id}`}
                  className="rounded-xl border border-[#e4e8e5] px-3 py-1.5 text-[13px] font-medium text-[#4b5563] hover:bg-[#f1f5f2]"
                >
                  View
                </Link>
                <Link
                  href={`/review/${need.id}`}
                  className="flex items-center gap-1.5 rounded-xl bg-[#15542a] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#1a6934]"
                >
                  Launch review
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <form action={deleteNeedAction.bind(null, need.id)}>
                  <button
                    type="submit"
                    aria-label="Delete need"
                    className="rounded-xl p-1.5 text-[#9ca3af] hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        )) : (
          <div className="rounded-2xl border border-dashed border-[#e4e8e5] p-12 text-center">
            <p className="text-[14px] font-medium text-[#111827]">No needs yet</p>
            <p className="mt-1 text-[12px] text-[#9ca3af]">
              Define what you&apos;re looking for before reviewing players.
            </p>
            <Link
              href="/needs/new"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#15542a] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a6934]"
            >
              <Plus className="h-4 w-4" />
              Create first need
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
