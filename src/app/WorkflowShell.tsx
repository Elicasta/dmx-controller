import { memo, type ReactNode } from 'react';

export type LumaWorkspace = 'build' | 'create' | 'show' | 'live';

export const WORKSPACE_LABELS: Record<LumaWorkspace, { label: string; description: string }> = {
  build: { label: 'BUILD', description: 'Fixtures, groups, stage, and connections' },
  create: { label: 'CREATE', description: 'Program fixtures, groups, looks, and effects' },
  show: { label: 'SHOW', description: 'Cues, tracks, and show structure' },
  live: { label: 'LIVE', description: 'Performance controls only' }
};

export function legacyWorkspaceFor(workspace: LumaWorkspace): 'setup' | 'program' | 'show' | 'live' {
  if (workspace === 'build') return 'setup';
  if (workspace === 'create') return 'program';
  return workspace;
}

export function lumaWorkspaceFor(workspace: 'setup' | 'program' | 'show' | 'live'): LumaWorkspace {
  if (workspace === 'setup') return 'build';
  if (workspace === 'program') return 'create';
  return workspace;
}

export const WorkflowTabs = memo(function WorkflowTabs({
  workspace,
  onChange
}: {
  workspace: LumaWorkspace;
  onChange: (workspace: LumaWorkspace) => void;
}) {
  return <nav className="console-workspace-tabs workflow-tabs" aria-label="LumaRig workflow">
    {(Object.keys(WORKSPACE_LABELS) as LumaWorkspace[]).map((item) => (
      <button
        key={item}
        className={workspace === item ? 'active' : ''}
        onClick={() => onChange(item)}
        title={WORKSPACE_LABELS[item].description}
      >
        {WORKSPACE_LABELS[item].label}
      </button>
    ))}
  </nav>;
});

export function WorkspaceFrame({ workspace, children }: { workspace: LumaWorkspace; children: ReactNode }) {
  return <div className={`workflow-frame workflow-${workspace}`} data-workspace={workspace}>{children}</div>;
}
