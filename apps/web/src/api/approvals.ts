import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApprovalDto } from '@ledgerline/shared';
import { api, wsPath } from './client';
import { invalidateWorkspace } from './invalidate';
import { approvalKeys } from './keys';
import { useSlug } from './slug';

export type ApprovalFilter = 'pending' | 'approved' | 'rejected' | 'all';

export function useApprovals(status: ApprovalFilter = 'pending') {
  const slug = useSlug();
  return useQuery({
    queryKey: approvalKeys.list(slug, status),
    queryFn: () => api.get<{ items: ApprovalDto[] }>(wsPath(slug, '/approvals'), { status }),
    select: (d) => d.items,
    placeholderData: (prev) => prev,
  });
}

/** Decide an approval by acting on its subject (invoice or expense). */
export function useDecideApproval() {
  const slug = useSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      approval,
      decision,
      comment,
    }: {
      approval: ApprovalDto;
      decision: 'approve' | 'reject';
      comment?: string;
    }) => {
      const base = approval.subjectType === 'invoice' ? '/invoices' : '/expenses';
      return api.post<unknown>(wsPath(slug, `${base}/${approval.subjectId}/${decision}`), {
        comment: comment ?? '',
      });
    },
    onSuccess: () => invalidateWorkspace(qc, slug),
  });
}
