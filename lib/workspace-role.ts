export const WORKSPACE_ROLE_OPTIONS = [
  "Personnel Director",
  "Coach",
  "Coordinator",
  "Head Coach"
] as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLE_OPTIONS)[number];

export function normalizeWorkspaceRole(role?: string | null): WorkspaceRole | null {
  if (!role) return null;
  return WORKSPACE_ROLE_OPTIONS.includes(role as WorkspaceRole) ? (role as WorkspaceRole) : null;
}
