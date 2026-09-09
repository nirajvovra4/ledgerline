import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  DEFAULT_WORKSPACE_SETTINGS,
  type Role,
  type WorkspaceDto,
  type WorkspaceSettings,
} from '@ledgerline/shared';
import { moneyFormatters, type MoneyFormatters } from '../lib/money';

export interface WorkspaceContextValue {
  workspace: WorkspaceDto;
  role: Role;
  slug: string;
  currency: string;
  settings: WorkspaceSettings;
  money: MoneyFormatters;
  /** Path prefix for links inside this workspace: `/w/<slug>`. */
  base: string;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  workspace,
  role,
  children,
}: {
  workspace: WorkspaceDto;
  role: Role;
  children: ReactNode;
}) {
  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspace,
      role,
      slug: workspace.slug,
      currency: workspace.currency,
      settings: { ...DEFAULT_WORKSPACE_SETTINGS, ...workspace.settings },
      money: moneyFormatters(workspace.currency),
      base: `/w/${workspace.slug}`,
    }),
    [workspace, role],
  );
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside a workspace route');
  return ctx;
}

export function useOptionalWorkspace(): WorkspaceContextValue | null {
  return useContext(WorkspaceContext);
}

/** Currency-bound money formatters for the current workspace. */
export function useMoney(): MoneyFormatters {
  return useWorkspace().money;
}
