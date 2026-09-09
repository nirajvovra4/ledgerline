import {
  addDays,
  computeInvoiceTotals,
  summariseTaxByRate,
  type BasisPoints,
  type Cents,
  type InvoiceDetailDto,
  type InvoiceInput,
  type InvoiceTotals,
  type TaxRateDto,
  type TaxSummaryRow,
} from '@ledgerline/shared';

export interface EditorLine {
  key: string;
  id?: string;
  description: string;
  quantity: number | null;
  unitPriceCents: Cents | null;
  taxRateId: string | null;
  accountId: string;
}

export interface EditorValues {
  clientId: string;
  projectId: string;
  issueDate: string;
  dueDate: string;
  poNumber: string;
  discountBp: BasisPoints;
  notes: string;
  terms: string;
  lines: EditorLine[];
}

let lineCounter = 0;
export function newLineKey(): string {
  lineCounter += 1;
  return `line-${Date.now().toString(36)}-${lineCounter}`;
}

export function blankLine(defaults: { accountId: string; taxRateId: string | null }): EditorLine {
  return {
    key: newLineKey(),
    description: '',
    quantity: 1,
    unitPriceCents: null,
    taxRateId: defaults.taxRateId,
    accountId: defaults.accountId,
  };
}

export function initialValues(opts: {
  today: string;
  termsDays: number;
  defaults: { accountId: string; taxRateId: string | null };
  clientId?: string;
  projectId?: string;
}): EditorValues {
  return {
    clientId: opts.clientId ?? '',
    projectId: opts.projectId ?? '',
    issueDate: opts.today,
    dueDate: addDays(opts.today, opts.termsDays),
    poNumber: '',
    discountBp: 0,
    notes: '',
    terms: '',
    lines: [blankLine(opts.defaults)],
  };
}

/** Values for editing an existing draft, or duplicating one with fresh dates. */
export function valuesFromInvoice(
  inv: InvoiceDetailDto,
  mode: 'edit' | 'duplicate',
  today: string,
): EditorValues {
  const duplicate = mode === 'duplicate';
  const termsDays = inv.client?.paymentTermsDays ?? 30;
  return {
    clientId: inv.clientId,
    projectId: inv.projectId ?? '',
    issueDate: duplicate ? today : inv.issueDate,
    dueDate: duplicate ? addDays(today, termsDays) : inv.dueDate,
    poNumber: inv.poNumber,
    discountBp: inv.discountBp,
    notes: inv.notes,
    terms: inv.terms,
    lines: inv.lines
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((l) => ({
        key: newLineKey(),
        id: duplicate ? undefined : l.id,
        description: l.description,
        quantity: l.quantity,
        unitPriceCents: l.unitPriceCents,
        taxRateId: l.taxRateId,
        accountId: l.accountId,
      })),
  };
}

export function toInvoiceInput(values: EditorValues): unknown {
  return {
    clientId: values.clientId,
    projectId: values.projectId || null,
    issueDate: values.issueDate,
    dueDate: values.dueDate,
    discountBp: values.discountBp,
    notes: values.notes,
    terms: values.terms,
    poNumber: values.poNumber,
    lines: values.lines.map((l) => ({
      id: l.id,
      description: l.description,
      quantity: l.quantity ?? undefined,
      unitPriceCents: l.unitPriceCents ?? undefined,
      taxRateId: l.taxRateId,
      accountId: l.accountId,
    })),
  } satisfies Partial<Record<keyof InvoiceInput, unknown>>;
}

export interface EditorTotals extends InvoiceTotals {
  taxRows: TaxSummaryRow[];
}

export function rateBpFor(taxRateId: string | null, taxRates: TaxRateDto[]): BasisPoints {
  if (!taxRateId) return 0;
  return taxRates.find((t) => t.id === taxRateId)?.rateBp ?? 0;
}

/** Live totals for the editor — the one place that turns editor lines into money. */
export function computeEditorTotals(
  lines: EditorLine[],
  discountBp: BasisPoints,
  taxRates: TaxRateDto[],
): EditorTotals {
  const inputs = lines.map((l) => ({
    quantity: l.quantity ?? 0,
    unitPriceCents: l.unitPriceCents ?? 0,
    taxRateBp: rateBpFor(l.taxRateId, taxRates),
  }));
  const totals = computeInvoiceTotals(inputs, discountBp);
  const taxRows = summariseTaxByRate(
    lines.map((l, i) => ({
      netCents: totals.lines[i]?.lineTotalCents ?? 0,
      taxRateId: l.taxRateId,
      taxRateBp: rateBpFor(l.taxRateId, taxRates),
      taxRateName: l.taxRateId ? taxRates.find((t) => t.id === l.taxRateId)?.name : undefined,
    })),
  ).filter((r) => r.rateBp > 0);
  return { ...totals, taxRows };
}

/** Which step a field error belongs to. */
export function stepForField(field: string): number {
  if (field.startsWith('lines') || field === 'discountBp') return 1;
  if (['notes', 'terms'].includes(field)) return 2;
  return 0;
}
