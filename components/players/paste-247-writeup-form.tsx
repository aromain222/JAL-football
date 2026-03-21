"use client";

import type { FormEvent } from "react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { saveMeasurablesFrom247WriteUpAction } from "@/app/actions";
import { FileText } from "lucide-react";

export function Paste247WriteUpForm({ playerId }: { playerId: string }) {
  const [text, setText] = useState("");
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const writeUpText = text.trim();
    if (!writeUpText) return;

    startTransition(async () => {
      const result = await saveMeasurablesFrom247WriteUpAction({ playerId, writeUpText });
      setState(result);
      if (result.ok) setText("");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" />
          Add from 247 write-up
        </CardTitle>
        <p className="text-sm text-slate-500">
          Paste a 247 write-up to fill combine measurables only: 40, shuttle, vertical, arm, wingspan. Height and weight come from the API.
        </p>
      </CardHeader>
      <CardContent>
        <form className="grid gap-3" onSubmit={onSubmit}>
          <Textarea
            placeholder="e.g. 4.43 short shuttle, 33-inch arms, 36 vertical..."
            className="min-h-[120px] resize-y text-sm"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={isPending}
          />
          <Button type="submit" disabled={isPending || !text.trim()}>
            {isPending ? "Saving…" : "Parse & save measurables"}
          </Button>
          {state?.message && (
            <p className={state.ok ? "text-sm text-green-600" : "text-sm text-red-600"}>
              {state.message}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
