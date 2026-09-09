import {
  summariseTaxByRate,
  type ClientDto,
  type InvoiceDetailDto,
  type TaxRateDto,
} from '@ledgerline/shared';
import type { DocumentModel } from './InvoiceDocument';
import { computeEditorTotals, rateBpFor, type EditorValues } from './editor/editorState';

export function modelFromInvoice(
  inv: InvoiceDetailDto,
  taxRates: TaxRateDto[] = [],
): DocumentModel {
  const lines = inv.lines.slice().sort((a, b) => a.position - b.position);
  return {
    number: inv.number,
    status: inv.derivedStatus,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    poNumber: inv.poNumber,
    currency: inv.currency,
    client: inv.client ?? { name: inv.clientName },
    projectName: inv.projectName ?? inv.project?.name ?? null,
    lines: lines.map((l) => ({
      key: l.id,
      description: l.description,
      quantity: l.quantity,
      unitPriceCents: l.unitPriceCents,
      taxRateBp: l.taxRateBp,
      lineTotalCents: l.lineTotalCents,
    })),
    subtotalCents: inv.subtotalCents,
    discountBp: inv.discountBp,
    discountCents: inv.discountCents,
    taxRows: summariseTaxByRate(
      lines.map((l) => ({
        netCents: l.lineTotalCents,
        taxRateId: l.taxRateId,
        taxRateBp: l.taxRateBp,
        taxRateName: l.taxRateId ? taxRates.find((t) => t.id === l.taxRateId)?.name : undefined,
      })),
    ).filter((r) => r.rateBp > 0),
    taxCents: inv.taxCents,
    totalCents: inv.totalCents,
    amountPaidCents: inv.amountPaidCents,
    balanceCents: inv.balanceCents,
    notes: inv.notes,
    terms: inv.terms,
  };
}

export function modelFromEditor(
  values: EditorValues,
  opts: {
    number: string;
    currency: string;
    client: ClientDto | undefined;
    projectName: string | null;
    taxRates: TaxRateDto[];
  },
): DocumentModel {
  const totals = computeEditorTotals(values.lines, values.discountBp, opts.taxRates);
  return {
    number: opts.number,
    status: 'draft',
    issueDate: values.issueDate,
    dueDate: values.dueDate,
    poNumber: values.poNumber,
    currency: opts.currency,
    client: opts.client ?? null,
    projectName: opts.projectName,
    lines: values.lines.map((l, i) => ({
      key: l.key,
      description: l.description,
      quantity: l.quantity ?? 0,
      unitPriceCents: l.unitPriceCents ?? 0,
      taxRateBp: rateBpFor(l.taxRateId, opts.taxRates),
      lineTotalCents: totals.lines[i]?.lineTotalCents ?? 0,
    })),
    subtotalCents: totals.subtotalCents,
    discountBp: values.discountBp,
    discountCents: totals.discountCents,
    taxRows: totals.taxRows,
    taxCents: totals.taxCents,
    totalCents: totals.totalCents,
    amountPaidCents: 0,
    balanceCents: totals.totalCents,
    notes: values.notes,
    terms: values.terms,
  };
}
