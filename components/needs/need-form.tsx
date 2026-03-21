"use client";

import { useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Radar, Rocket, Sparkles, Target } from "lucide-react";
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
  min_years_remaining: null,
  scheme: "",
  priority_traits: [],
  production_filters: {
    min_games_played: null,
    min_starts: null,
    stat_key: null,
    min_stat_value: null
  },
  min_starts: null,
  min_production_score: null,
  active: true,
  notes: ""
};

export function NeedForm() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitMode, setSubmitMode] = useState<"detail" | "review">("detail");
  const [isPending, startTransition] = useTransition();
  const form = useForm<NeedFormValues>({
    resolver: zodResolver(needSchema),
    defaultValues
  });

  const values = form.watch();
  const hasFeaturedStat = Boolean(values.production_filters.stat_key);

  useEffect(() => {
    if (!values.production_filters.stat_key && values.production_filters.min_stat_value !== null) {
      form.setValue("production_filters.min_stat_value", null, { shouldValidate: true });
    }
  }, [form, values.production_filters.min_stat_value, values.production_filters.stat_key]);

  async function onSubmit(values: NeedFormValues) {
    setSubmitError(null);
    startTransition(async () => {
      try {
        const result = await createNeedAction({
          ...values,
          min_height_in: null,
          max_height_in: null,
          min_weight_lbs: null,
          max_weight_lbs: null,
          priority_traits: [],
          min_arm_length_in: null,
          max_forty_time: null
        });
        router.push(submitMode === "review" ? `/review/${result.id}` : `/needs/${result.id}`);
        router.refresh();
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : "Failed to create need.");
      }
    });
  }

  return (
    <form className="grid gap-6" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="overflow-hidden border-slate-200/80 bg-white/95 shadow-panel">
          <CardHeader className="border-b bg-[radial-gradient(circle_at_top_left,_rgba(8,145,178,0.14),_transparent_30%),linear-gradient(180deg,_rgba(248,250,252,1)_0%,_rgba(255,255,255,0.98)_100%)]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-cyan-300">
                <Target className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.26em] text-cyan-700">Recruiting Need</p>
                <CardTitle className="mt-1">Build a need profile</CardTitle>
              </div>
            </div>
            <p className="max-w-2xl text-sm text-slate-600">
              Start broad, then add only the thresholds that actually matter for this board turn.
            </p>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" placeholder="Boundary corner with size and experience" {...form.register("title")} />
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

            <div className="grid gap-4 md:grid-cols-1">
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

            <Card className="overflow-hidden border-slate-200 shadow-none">
              <CardHeader className="border-b bg-slate-50/80 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-cyan-700" />
                  <CardTitle className="text-lg">Production Filters</CardTitle>
                </div>
                <p className="text-sm text-slate-500">
                  Featured stat is optional. Use it only when you want one hard production signal.
                </p>
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
                  disabled={!hasFeaturedStat}
                  form={form}
                  label="Featured Stat Minimum"
                  name="production_filters.min_stat_value"
                  placeholder={hasFeaturedStat ? "Optional minimum" : "Select a stat first"}
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
          <Card className="sticky top-6 overflow-hidden border-slate-200/80 bg-white/95 shadow-panel">
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

              <SummaryLine label="Years remaining" value={singleLabel(values.min_years_remaining, "+")} />

              <div className="rounded-2xl border bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Production Gates</p>
                <div className="mt-3 grid gap-2 text-sm text-slate-700">
                  <span>Min games: {values.production_filters.min_games_played ?? "--"}</span>
                  <span>Min starts: {values.production_filters.min_starts ?? "--"}</span>
                  <span>
                    Featured stat: {values.production_filters.stat_key ?? "None"}
                    {values.production_filters.stat_key && values.production_filters.min_stat_value !== null
                      ? ` >= ${values.production_filters.min_stat_value}`
                      : ""}
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
  step,
  disabled = false
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
  disabled?: boolean;
}) {
  const error = getNestedError(form.formState.errors, name);
  const touched = getNestedTouched(form.formState.touchedFields as Record<string, unknown>, name);
  const showError = Boolean(error && (form.formState.isSubmitted || touched));
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        className={disabled ? "bg-slate-50 text-slate-400" : undefined}
        disabled={disabled}
        id={name}
        placeholder={placeholder}
        step={step}
        type="number"
        {...form.register(name, {
          setValueAs: normalizeOptionalNumber
        })}
      />
      <FieldError message={showError ? error : undefined} />
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

function normalizeOptionalNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isNaN(value) ? null : value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return value;
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

function getNestedTouched(
  touchedFields: Record<string, unknown>,
  path: string
): boolean {
  const result = path.split(".").reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, touchedFields);

  return Boolean(result);
}
