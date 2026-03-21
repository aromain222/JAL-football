"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type SourceNoteFormProps = {
  playerId: string;
};

export function SourceNoteForm({ playerId }: SourceNoteFormProps) {
  const [sourceAccount, setSourceAccount] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [noteType, setNoteType] = useState("scouting");
  const [traits, setTraits] = useState("");
  const [confidence, setConfidence] = useState("");
  const [summary, setSummary] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [statusSignal, setStatusSignal] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isExtracting, startExtracting] = useTransition();
  const [isSaving, startSaving] = useTransition();

  function handleExtract() {
    setMessage(null);
    startExtracting(async () => {
      const response = await fetch("/api/ai/extract-source-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceText })
      });

      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.error || "Failed to extract note fields.");
        return;
      }

      setNoteType(payload.note_type || "scouting");
      setSummary(payload.summary || "");
      setTraits(Array.isArray(payload.traits) ? payload.traits.join(", ") : "");
      setStatusSignal(payload.status_signal || "");
      setConfidence(
        typeof payload.confidence === "number" && Number.isFinite(payload.confidence)
          ? String(payload.confidence)
          : ""
      );
      setMessage("AI fields extracted.");
    });
  }

  function handleSave() {
    setMessage(null);
    startSaving(async () => {
      const response = await fetch("/api/player-source-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          sourcePlatform: "x",
          sourceAccount,
          sourceUrl,
          noteType,
          sourceText,
          summary,
          traits: traits
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          statusSignal,
          confidence: confidence ? Number(confidence) : null
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.error || "Failed to save note.");
        return;
      }

      setSourceAccount("");
      setSourceUrl("");
      setNoteType("scouting");
      setTraits("");
      setConfidence("");
      setSummary("");
      setSourceText("");
      setStatusSignal("");
      setMessage("Source note saved.");
      window.location.reload();
    });
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-medium text-slate-700">Source account</label>
          <Input value={sourceAccount} onChange={(event) => setSourceAccount(event.target.value)} placeholder="CamMellor" />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium text-slate-700">Note type</label>
          <select
            className="h-10 rounded-xl border bg-white px-3 text-sm"
            value={noteType}
            onChange={(event) => setNoteType(event.target.value)}
          >
            <option value="scouting">Scouting</option>
            <option value="status_update">Status update</option>
            <option value="offer_interest">Offer / interest</option>
            <option value="measurable">Measurable</option>
          </select>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-medium text-slate-700">Source URL</label>
          <Input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://x.com/..." />
        </div>
        <div className="grid gap-2 md:grid-cols-[1fr_140px]">
          <div className="grid gap-2">
            <label className="text-sm font-medium text-slate-700">Traits</label>
            <Input value={traits} onChange={(event) => setTraits(event.target.value)} placeholder="burst, ball skills, long speed" />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium text-slate-700">Confidence</label>
            <Input
              value={confidence}
              onChange={(event) => setConfidence(event.target.value)}
              max="1"
              min="0"
              placeholder="0.8"
              step="0.1"
              type="number"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-slate-700">Summary</label>
        <Input value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Top-graded CUSA corner with size and ball skills." />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-slate-700">Source text</label>
        <Textarea value={sourceText} onChange={(event) => setSourceText(event.target.value)} placeholder="Paste the tweet or writeup text here." />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-slate-700">Status signal</label>
        <Input value={statusSignal} onChange={(event) => setStatusSignal(event.target.value)} placeholder="Portal, committed, visiting, interest" />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button disabled={!sourceText.trim() || isExtracting} onClick={handleExtract} type="button" variant="secondary">
          <Sparkles className="mr-2 h-4 w-4" />
          {isExtracting ? "Extracting..." : "Extract with AI"}
        </Button>
        <Button disabled={!sourceText.trim() || isSaving} onClick={handleSave} type="button">
          {isSaving ? "Saving..." : "Save note"}
        </Button>
      </div>

      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </div>
  );
}
