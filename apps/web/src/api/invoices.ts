import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  InvoiceDetailDto,
  InvoiceDto,
  InvoiceFromTimeInput,
  InvoiceInput,
  InvoiceListSummary,
  Paginated,
  PaymentDto,
  RecordPaymentInput,
} from '@ledgerline/shared';
import { api, wsPath, type QueryParams } from './client';
import { invalidateWorkspace } from './invalidate';
import { invoiceKeys } from './keys';
import { useSlug } from './slug';

export interface InvoiceListParams extends QueryParams {
  q?: string;
  status?: string;
  clientId?: string;
  projectId?: string;
  from?: string;
  to?: string;
  sort?: string;
  dir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface InvoiceListResponse extends Paginated<InvoiceDto> {
  summary: InvoiceListSummary;
  /** Per-status counts (unfiltered by status) when the API provides them. */
  counts?: Partial<Record<string, number>>;
}

export function useInvoices(params: InvoiceListParams = {}, options: { enabled?: boolean } = {}) {
  const slug = useSlug();
  return useQuery({
    queryKey: invoiceKeys.list(slug, params),
    queryFn: () => api.get<InvoiceListResponse>(wsPath(slug, '/invoices'), params),
    placeholderData: (prev) => prev,
    enabled: options.enabled ?? true,
  });
}

export function useInvoice(id: string | undefined) {
  const slug = useSlug();
  return useQuery({
    queryKey: invoiceKeys.detail(slug, id ?? ''),
    queryFn: () => api.get<{ invoice: InvoiceDetailDto }>(wsPath(slug, `/invoices/${id}`)),
    select: (d) => d.invoice,
    enabled: Boolean(id),
  });
}

function useAfterInvoiceChange() {
  const slug = useSlug();
  const qc = useQueryClient();
  return () => invalidateWorkspace(qc, slug);
}

export function useCreateInvoice() {
  const slug = useSlug();
  const after = useAfterInvoiceChange();
  return useMutation({
    mutationFn: (input: InvoiceInput) =>
      api.post<{ invoice: InvoiceDetailDto }>(wsPath(slug, '/invoices'), input),
    onSuccess: after,
  });
}

export function useCreateInvoiceFromTime() {
  const slug = useSlug();
  const after = useAfterInvoiceChange();
  return useMutation({
    mutationFn: (input: InvoiceFromTimeInput) =>
      api.post<{ invoice: InvoiceDetailDto }>(wsPath(slug, '/invoices/from-time'), input),
    onSuccess: after,
  });
}

export function useUpdateInvoice(id: string) {
  const slug = useSlug();
  const after = useAfterInvoiceChange();
  return useMutation({
    mutationFn: (input: InvoiceInput) =>
      api.patch<{ invoice: InvoiceDetailDto }>(wsPath(slug, `/invoices/${id}`), input),
    onSuccess: after,
  });
}

export function useDeleteInvoice() {
  const slug = useSlug();
  const after = useAfterInvoiceChange();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ ok: true }>(wsPath(slug, `/invoices/${id}`)),
    onSuccess: after,
  });
}

export type InvoiceTransition = 'submit' | 'approve' | 'reject' | 'send' | 'void';

export function useInvoiceTransition() {
  const slug = useSlug();
  const after = useAfterInvoiceChange();
  return useMutation({
    mutationFn: ({
      id,
      action,
      body,
    }: {
      id: string;
      action: InvoiceTransition;
      body?: { comment?: string; reason?: string };
    }) =>
      api.post<{ invoice: InvoiceDetailDto }>(
        wsPath(slug, `/invoices/${id}/${action}`),
        body ?? {},
      ),
    onSuccess: after,
  });
}

export function useRecordPayment() {
  const slug = useSlug();
  const after = useAfterInvoiceChange();
  return useMutation({
    mutationFn: ({ id, ...input }: RecordPaymentInput & { id: string }) =>
      api.post<{ invoice: InvoiceDetailDto; payment: PaymentDto }>(
        wsPath(slug, `/invoices/${id}/payments`),
        input,
      ),
    onSuccess: after,
  });
}
