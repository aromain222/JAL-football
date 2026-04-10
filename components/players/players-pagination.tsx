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
    <div className="flex flex-col items-center justify-between gap-3 rounded-[28px] border border-[#d7ddd9] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(245,247,245,0.92))] px-4 py-4 sm:flex-row">
      <p className="text-sm font-medium text-[#345243]">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        {page <= 1 ? (
          <Button disabled variant="outline" className="border-[#d1d9d4] bg-white/75">
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
        ) : (
          <Button asChild variant="outline" className="border-[#d1d9d4] bg-white/80 hover:bg-white">
            <Link href={href(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Link>
          </Button>
        )}
        {page >= totalPages ? (
          <Button disabled variant="outline" className="border-[#d1d9d4] bg-white/75">
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button asChild variant="outline" className="border-[#d1d9d4] bg-white/80 hover:bg-white">
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
