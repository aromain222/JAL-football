"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Radar, Rocket } from "lucide-react";
import { useForm } from "react-hook-form";
import { createNeedAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { needSchema } from "@/lib/validation";
import { z } from "zod";

const positions = ["QB", "RB", "WR", "TE", "OL", "EDGE", "DL", "LB", "CB", "S", "ST"] as const;
const priorities = ["critical", "high", "medium"] as const;
const statKeys = [
  { value: "", label: "No featured stat" },
  { value: "starts", label: "Starts" },
  { value: "games_played", label: "Games played" },
  { value: "receiving_yards", label: "Receiving yards" },
  { value: "rushing_yards", label: "Rushing yards" },
  { value: "tackles", label: "Tackles" },
  { value: "sacks", label: "Sacks" },
  { value: "interceptions", label: "Interceptions" },
  { value: "passes_defended", label: "Passes defended" },
  { value: "offensive_snaps", label: "Offensive snaps" },
  { value: "defensive_snaps", label: "Defensive snaps" }
] as const;

type NeedFormValues = z.infer<typeof needSchema>;

const defaultValues: NeedFormValues = {
  title: "",
  position: "EDGE",
  priority: "critical",
  target_count: 1,
  class_focus: "",
  min_height_in: null,
  max_height_in: null,
  min_weight_lbs: null,
  max_weight_lbs: null,
  min_arm_length_in: null,
  max_forty_time: null,
  min_years_remaining: 1,
  scheme: "",
  priority_traits: ["burst", "length"],
  production_filters: {
    min_games_played: 8,
    min_starts: 4,
    stat_key: "sacks",
    min_stat_value: 4
  },
  min_starts: 4,
  min_production_score: 70,
  active: true,
  notes: ""
};

export function NeedForm() {
  const router = useRouter();
  const [traitInput, setTraitInput] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitMode, setSubmitMode] = useState<"detail" | "review">("detail");
  const [isPending, startTransition] = useTransition();
  const form = useForm<NeedFormValues>({
    resolver: zodResolver(needSchema),
    defaultValues
  });

  const values = form.watch();
  const traits = values.priority_traits ?? [];

  async function onSubmit(values: NeedFormValues) {
    setSubmitError(null);
    startTransition(async () => {
      try {
        const result = await createNeedAction(values);
        router.push(submitMode === "review" ? `/review/${result.id}` : `/needs/${result.id}`);
        router.refresh();
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : "Failed to create need.");
      }
    });
  }

  function addTrait() {
    const normalized = traitInput.trim().toLowerCase();
    if (!normalized || traits.includes(normalized) || traits.length >= 8) return;
    form.setValue("priority_traits", [...traits, normalized], { shouldValidate: true });
    setTraitInput("");
  }

  function removeTrait(trait: string) {
    form.setValue(
      "priority_traits",
      traits.filter((entry) => entry !== trait),
      { shouldValidate: true }
    );
  }

  return (
    <form className="grid gap-6" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Create Need Profile</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" placeholder="Boundary corner with verified speed" {...form.register("title")} />
              <FieldError message={form.formState.errors.title?.message} />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <SelectField form={form} label="Position" name="position" options={positions} />
              <SelectField form={form} label="Priority" name="priority" options={priorities} />
              <div className="grid gap-2">
                <Label htmlFor="target_count">Target Count</Label>
                <Input id="target_count" type="number" {...form.register("target_count", { valueAsNumber: true })} />
                <FieldError message={form.formState.errors.target_count?.message} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <RangeField
                form={form}
                label="Height (in)"
                maxName="max_height_in"
                minName="min_height_in"
                placeholders={["Min", "Max"]}
              />
              <RangeField
                form={form}
                label="Weight (lbs)"
                maxName="max_weight_lbs"
                minName="min_weight_lbs"
                placeholders={["Min", "Max"]}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <NumberField form={form} label="Arm Length Min" name="min_arm_length_in" placeholder="32.5" step="0.1" />
              <NumberField form={form} label="Forty Max" name="max_forty_time" placeholder="4.72" step="0.01" />
              <NumberField form={form} label="Years Remaining Min" name="min_years_remaining" placeholder="1" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="scheme">Scheme</Label>
                <Input id="scheme" placeholder="Multiple front pressure package" {...form.register("scheme")} />
                <FieldError message={form.formState.errors.scheme?.message} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="class_focus">Class Focus</Label>
                <Input id="class_focus" placeholder="JR/SR" {...form.register("class_focus")} />
                <FieldError message={form.formState.errors.class_focus?.message} />
              </div>
            </div>

            <div className="grid gap-3">
              <Label>Priority Traits</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add trait and press +"
                  value={traitInput}
                  onChange={(event) => setTraitInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addTrait();
                    }
                  }}
                />
                <Button onClick={addTrait} type="button" variant="outline">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {traits.map((trait) => (
                  <button
                    key={trait}
                    className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
                    type="button"
                    onClick={() => removeTrait(trait)}
                  >
                    {trait} x
                  </button>
                ))}
              </div>
              <FieldError message={form.formState.errors.priority_traits?.message} />
            </div>

            <Card className="border-slate-200 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Production Filters</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <NumberField
                  form={form}
                  label="Min Games"
                  name="production_filters.min_games_played"
                  placeholder="8"
                />
                <NumberField
                  form={form}
                  label="Min Starts"
                  name="production_filters.min_starts"
                  placeholder="4"
                />
                <div className="grid gap-2">
                  <Label htmlFor="stat_key">Featured Stat</Label>
                  <select
                    className="h-10 rounded-xl border bg-white px-3 text-sm"
                    id="stat_key"
                    {...form.register("production_filters.stat_key", {
                      setValueAs: (value) => (value === "" ? null : value)
                    })}
                  >
                    {statKeys.map((option) => (
                      <option key={option.label} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <NumberField
                  form={form}
                  label="Featured Stat Minimum"
                  name="production_filters.min_stat_value"
                  placeholder="4"
                />
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <NumberField form={form} label="Min Starts Override" name="min_starts" placeholder="4" />
              <NumberField
                form={form}
                label="Min Production Score"
                name="min_production_score"
                placeholder="70"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Need a fast-path profile with real third-down impact and enough frame to stay on schedule in run fits."
                {...form.register("notes")}
              />
              <FieldError message={form.formState.errors.notes?.message} />
            </div>

            <div className="flex items-center justify-between rounded-2xl border bg-slate-50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-900">Active Need</p>
                <p className="text-sm text-slate-500">Turn off to save as draft without pushing it live.</p>
              </div>
              <Switch
                checked={values.active}
                onCheckedChange={(checked) => form.setValue("active", checked, { shouldValidate: true })}
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-slate-950 text-white">
              <div className="flex items-center gap-3">
                <Radar className="h-5 w-5 text-cyan-300" />
                <CardTitle>Need Preview</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 p-5">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">{values.position}</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-950">
                  {values.title || "Untitled need"}
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  {values.scheme || "No scheme added"} • {values.active ? "Active board" : "Draft only"}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant={values.priority === "critical" ? "destructive" : values.priority === "high" ? "accent" : "default"}>
                  {values.priority}
                </Badge>
                <Badge>{values.target_count} target slot{values.target_count === 1 ? "" : "s"}</Badge>
                {values.class_focus ? <Badge variant="default">{values.class_focus}</Badge> : null}
              </div>

              <SummaryLine label="Height band" value={rangeLabel(values.min_height_in, values.max_height_in, "in")} />
              <SummaryLine label="Weight band" value={rangeLabel(values.min_weight_lbs, values.max_weight_lbs, "lbs")} />
              <SummaryLine label="Arm length min" value={singleLabel(values.min_arm_length_in, '"')} />
              <SummaryLine label="Forty max" value={singleLabel(values.max_forty_time, "s")} />
              <SummaryLine label="Years remaining" value={singleLabel(values.min_years_remaining, "+")} />

              <div className="rounded-2xl border bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Priority Traits</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {traits.length ? traits.map((trait) => <Badge key={trait}>{trait}</Badge>) : <span className="text-sm text-slate-500">No traits added yet.</span>}
                </div>
              </div>

              <div className="rounded-2xl border bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Production Gates</p>
                <div className="mt-3 grid gap-2 text-sm text-slate-700">
                  <span>Min games: {values.production_filters.min_games_played ?? "--"}</span>
                  <span>Min starts: {values.production_filters.min_starts ?? "--"}</span>
                  <span>
                    Featured stat: {values.production_filters.stat_key ?? "--"}{" "}
                    {values.production_filters.min_stat_value ?? ""}
                  </span>
                </div>
              </div>

              <p className="text-sm text-slate-600">
                {values.notes || "Need summary preview updates live as staff changes thresholds."}
              </p>

              <div className="grid gap-3">
                {submitError ? <FieldError message={submitError} /> : null}
                <Button
                  disabled={isPending}
                  size="lg"
                  type="submit"
                  onClick={() => setSubmitMode("detail")}
                >
                  Create need
                </Button>
                <Button
                  disabled={isPending}
                  type="submit"
                  variant="secondary"
                  onClick={() => setSubmitMode("review")}
                >
                  Create and launch review
                </Button>
                <Button asChild type="button" variant="outline">
                  <Link href="/needs">Back to needs</Link>
                </Button>
                <p className="flex items-center gap-2 text-sm text-slate-500">
                  <Rocket className="h-4 w-4" />
                  Standard create goes to the need detail page. The secondary CTA opens review mode immediately.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}

function SelectField({
  form,
  label,
  name,
  options
}: {
  form: ReturnType<typeof useForm<NeedFormValues>>;
  label: string;
  name: "position" | "priority";
  options: readonly string[];
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <select className="h-10 rounded-xl border bg-white px-3 text-sm" id={name} {...form.register(name)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <FieldError message={form.formState.errors[name]?.message} />
    </div>
  );
}

function NumberField({
  form,
  label,
  name,
  placeholder,
  step
}: {
  form: ReturnType<typeof useForm<NeedFormValues>>;
  label: string;
  name:
    | "min_arm_length_in"
    | "max_forty_time"
    | "min_years_remaining"
    | "min_starts"
    | "min_production_score"
    | "production_filters.min_games_played"
    | "production_filters.min_starts"
    | "production_filters.min_stat_value";
  placeholder: string;
  step?: string;
}) {
  const error = getNestedError(form.formState.errors, name);
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        placeholder={placeholder}
        step={step}
        type="number"
        {...form.register(name, {
          setValueAs: (value) => (value === "" ? null : Number(value))
        })}
      />
      <FieldError message={error} />
    </div>
  );
}

function RangeField({
  form,
  label,
  minName,
  maxName,
  placeholders
}: {
  form: ReturnType<typeof useForm<NeedFormValues>>;
  label: string;
  minName: "min_height_in" | "min_weight_lbs";
  maxName: "max_height_in" | "max_weight_lbs";
  placeholders: [string, string];
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        <Input
          placeholder={placeholders[0]}
          type="number"
          {...form.register(minName, {
            setValueAs: (value) => (value === "" ? null : Number(value))
          })}
        />
        <Input
          placeholder={placeholders[1]}
          type="number"
          {...form.register(maxName, {
            setValueAs: (value) => (value === "" ? null : Number(value))
          })}
        />
      </div>
      <FieldError message={form.formState.errors[minName]?.message || form.formState.errors[maxName]?.message} />
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border bg-slate-50 px-4 py-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-rose-600">{message}</p>;
}

function rangeLabel(min: number | null, max: number | null, unit: string) {
  if (min === null && max === null) return "Open";
  if (min !== null && max !== null) return `${min}-${max} ${unit}`;
  if (min !== null) return `${min}+ ${unit}`;
  return `Up to ${max} ${unit}`;
}

function singleLabel(value: number | null, suffix: string) {
  if (value === null) return "Open";
  return suffix === "+" ? `${value}+` : `${value}${suffix}`;
}

function getNestedError(
  errors: Record<string, unknown>,
  path: string
): string | undefined {
  const result = path.split(".").reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, errors);

  if (!result || typeof result !== "object") return undefined;
  return typeof (result as { message?: unknown }).message === "string"
    ? ((result as { message?: string }).message)
    : undefined;
}
