"use client";

import { useState, useTransition } from "react";
import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { setWorkspaceRoleAction } from "@/app/actions";
import { WORKSPACE_ROLE_OPTIONS, WorkspaceRole } from "@/lib/workspace-role";

export function WorkspaceRoleSwitcher({
  currentRole
}: {
  currentRole: WorkspaceRole;
}) {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<WorkspaceRole>(currentRole);
  const [isPending, startTransition] = useTransition();

  function handleRoleChange(nextRole: string) {
    if (nextRole === selectedRole) return;
    setSelectedRole(nextRole as WorkspaceRole);

    startTransition(async () => {
      await setWorkspaceRoleAction(nextRole);
      router.refresh();
    });
  }

  return (
    <div className="scouting-surface flex flex-col gap-3 rounded-[24px] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="field-label scouting-pill-label flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5" />
          Workspace Role
        </p>
        <p className="mt-1 text-sm text-slate-600">Switch the board context without leaving the app shell.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {WORKSPACE_ROLE_OPTIONS.map((role) => {
          const active = role === selectedRole;
          return (
            <button
              key={role}
              className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                active
                  ? "bg-[var(--scout-forest)] text-[#eef4ef]"
                  : "border border-[var(--scout-card-border)] bg-white text-[#355546] hover:border-[#c7d0cb] hover:bg-[#f7f9f7]"
              }`}
              disabled={isPending}
              onClick={() => handleRoleChange(role)}
              type="button"
            >
              {role}
            </button>
          );
        })}
      </div>
    </div>
  );
}
