"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setWorkspaceRoleAction } from "@/app/actions";
import { WORKSPACE_ROLE_OPTIONS, WorkspaceRole } from "@/lib/workspace-role";
import { cn } from "@/lib/utils";

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
    <div className="flex flex-wrap gap-1">
      {WORKSPACE_ROLE_OPTIONS.map((role) => {
        const active = role === selectedRole;
        return (
          <button
            key={role}
            className={cn(
              "rounded-lg px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors",
              active
                ? "bg-[#dcf0e3] text-[#15542a]"
                : "text-[#9ca3af] hover:bg-[#f1f5f2] hover:text-[#4b5563]"
            )}
            disabled={isPending}
            onClick={() => handleRoleChange(role)}
            type="button"
          >
            {role}
          </button>
        );
      })}
    </div>
  );
}
