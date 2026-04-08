"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PlayersPagination({
  page,
  totalPages,
  baseSearchParams
}: {
  page: number;
  totalPages: number;
  baseSearchParams: string;
}) {
  if (totalPages <= 1) return null;

  function href(p: number) {
    const params = new URLSearchParams(baseSearchParams);
    params.set("page", String(p));
    return `/players?${params.toString()}`;
  }

  return (
    <div className="flex flex-col items-center justify-between gap-3 rounded-3xl border bg-white/90 px-4 py-4 sm:flex-row">
      <p className="text-sm text-slate-600">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        {page <= 1 ? (
          <Button disabled variant="outline">
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
        ) : (
          <Button asChild variant="outline">
            <Link href={href(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Link>
          </Button>
        )}
        {page >= totalPages ? (
          <Button disabled variant="outline">
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button asChild variant="outline">
            <Link href={href(page + 1)}>
              Next
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
