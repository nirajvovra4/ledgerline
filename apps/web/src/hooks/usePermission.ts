import { can, canAny, type Permission } from '@ledgerline/shared';
import { useOptionalWorkspace } from './useWorkspace';

export function usePermission(permission: Permission): boolean {
  const ws = useOptionalWorkspace();
  return can(ws?.role, permission);
}

export function useAnyPermission(permissions: Permission[]): boolean {
  const ws = useOptionalWorkspace();
  return canAny(ws?.role, permissions);
}
