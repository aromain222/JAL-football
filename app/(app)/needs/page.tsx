import Link from "next/link";
import { ArrowRight, Trash2 } from "lucide-react";
import { deleteNeedAction } from "@/app/actions";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getNeeds } from "@/lib/data/queries";

export default async function NeedsPage() {
  const needs = await getNeeds();

  return (
    <div className="grid gap-6">
      <SectionHeader
        eyebrow="Roster Needs"
        title="Manage open recruiting profiles"
        description="Define the measurable and production bars for each transfer target bucket, then launch review mode directly."
        cta={{ label: "New need", href: "/needs/new" }}
      />

      <div className="grid gap-4">
        {needs.map((need) => (
          <Card key={need.id}>
            <CardContent className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{need.position}</Badge>
                  <Badge variant={need.priority === "critical" ? "destructive" : "accent"}>{need.priority}</Badge>
                  <Badge variant="default">{need.target_count} spots</Badge>
                </div>
                <h2 className="mt-3 text-2xl font-semibold">{need.title}</h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-600">{need.notes}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button asChild variant="outline">
                  <Link href={`/needs/${need.id}`}>View need</Link>
                </Button>
                <Button asChild>
                  <Link href={`/review/${need.id}`}>
                    Launch review
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <form action={deleteNeedAction.bind(null, need.id)}>
                  <Button
                    size="sm"
                    type="submit"
                    variant="ghost"
                    aria-label="Delete need"
                    className="px-2 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
