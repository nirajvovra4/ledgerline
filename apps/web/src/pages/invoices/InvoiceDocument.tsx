import {
  formatAddress,
  formatBp,
  formatDate,
  formatMoney,
  formatNumber,
  type DerivedInvoiceStatus,
  type TaxSummaryRow,
} from '@ledgerline/shared';
import { InvoiceStamp } from '../../components/StatusStamp';
import { taxRateLabel } from '../../lib/labels';
import { useWorkspace } from '../../hooks/useWorkspace';

export interface DocumentLine {
  key: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  taxRateBp: number;
  lineTotalCents: number;
}

export interface DocumentParty {
  name: string;
  company?: string;
  email?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  taxId?: string;
}

export interface DocumentModel {
  number: string;
  status?: DerivedInvoiceStatus;
  issueDate: string;
  dueDate: string;
  poNumber: string;
  currency: string;
  client: DocumentParty | null;
  projectName?: string | null;
  lines: DocumentLine[];
  subtotalCents: number;
  discountBp: number;
  discountCents: number;
  taxRows: TaxSummaryRow[];
  taxCents: number;
  totalCents: number;
  amountPaidCents: number;
  balanceCents: number;
  notes: string;
  terms: string;
}

/** The invoice rendered as a paper document. Used by the detail page, the print route and the editor preview. */
export function InvoiceDocument({ model, preview }: { model: DocumentModel; preview?: boolean }) {
  const { workspace, settings } = useWorkspace();
  const fmt = (c: number) => formatMoney(c, model.currency);
  const address = model.client ? formatAddress(model.client) : [];
  const showStamp = model.status && model.status !== 'draft';
  const paid = model.status === 'paid';

  return (
    <article
      className={`doc${preview ? ' doc--preview' : ''}`}
      aria-label={`Invoice ${model.number}`}
    >
      <header className="doc__head">
        <div>
          <div className="doc__ws-name">{workspace.name}</div>
          <div className="doc__ws-meta">
            {[settings.address, settings.email, settings.phone].filter(Boolean).join('\n')}
          </div>
        </div>
        <div>
          <div className="doc__kind">Invoice</div>
          <div className="doc__number">{model.number || 'Draft'}</div>
          {showStamp && model.status ? (
            <div className="doc__stamp">
              <InvoiceStamp status={model.status} size="lg" />
            </div>
          ) : null}
        </div>
      </header>
      <section className="doc__parties">
        <div>
          <div className="doc__label">Bill to</div>
          {model.client ? (
            <>
              <div className="doc__client-name">{model.client.name}</div>
              {model.client.company && model.client.company !== model.client.name ? (
                <div>{model.client.company}</div>
              ) : null}
              {address.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
              {model.client.email ? <div>{model.client.email}</div> : null}
              {model.client.taxId ? <div className="muted">Tax ID {model.client.taxId}</div> : null}
            </>
          ) : (
            <div className="muted">No client selected</div>
          )}
        </div>
        <dl className="doc__meta">
          <dt>Issue date</dt>
          <dd>{formatDate(model.issueDate)}</dd>
          <dt>Due date</dt>
          <dd>{formatDate(model.dueDate)}</dd>
          {model.poNumber ? (
            <>
              <dt>PO number</dt>
              <dd>{model.poNumber}</dd>
            </>
          ) : null}
          {model.projectName ? (
            <>
              <dt>Project</dt>
              <dd>{model.projectName}</dd>
            </>
          ) : null}
          <dt>Currency</dt>
          <dd>{model.currency}</dd>
        </dl>
      </section>
      <table className="doc__table">
        <thead>
          <tr>
            <th>Description</th>
            <th className="is-right">Qty</th>
            <th className="is-right">Unit price</th>
            <th className="is-right">Tax</th>
            <th className="is-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {model.lines.length === 0 ? (
            <tr>
              <td colSpan={5} className="muted">
                No lines yet.
              </td>
            </tr>
          ) : (
            model.lines.map((l) => (
              <tr key={l.key}>
                <td style={{ whiteSpace: 'pre-line' }}>
                  {l.description || <span className="muted">(no description)</span>}
                </td>
                <td className="is-right">
                  {formatNumber(l.quantity, Number.isInteger(l.quantity) ? 0 : 2)}
                </td>
                <td className="is-right">{fmt(l.unitPriceCents)}</td>
                <td className="is-right">{l.taxRateBp ? formatBp(l.taxRateBp) : '—'}</td>
                <td className="is-right">{fmt(l.lineTotalCents)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div className="doc__totals">
        <div className="doc__totals-row">
          <span>Subtotal</span>
          <span>{fmt(model.subtotalCents)}</span>
        </div>
        {model.discountCents > 0 ? (
          <div className="doc__totals-row">
            <span>Discount ({formatBp(model.discountBp)})</span>
            <span>−{fmt(model.discountCents)}</span>
          </div>
        ) : null}
        {model.taxRows.map((r) => (
          <div key={`${r.taxRateId ?? r.rateBp}`} className="doc__totals-row">
            <span>{taxRateLabel(r)}</span>
            <span>{fmt(r.taxCents)}</span>
          </div>
        ))}
        <div className="doc__totals-row doc__totals-row--total">
          <span>Total</span>
          <span>{fmt(model.totalCents)}</span>
        </div>
        {model.amountPaidCents > 0 ? (
          <>
            <div className="doc__totals-row">
              <span>Paid</span>
              <span>−{fmt(model.amountPaidCents)}</span>
            </div>
            <div className="doc__totals-row doc__totals-row--balance">
              <span>{paid ? 'Paid in full' : 'Balance due'}</span>
              <span>{fmt(model.balanceCents)}</span>
            </div>
          </>
        ) : null}
      </div>
      {model.notes || model.terms ? (
        <section className="doc__notes">
          {model.notes ? (
            <div>
              <div className="doc__label">Notes</div>
              <p>{model.notes}</p>
            </div>
          ) : null}
          {model.terms ? (
            <div>
              <div className="doc__label">Terms</div>
              <p>{model.terms}</p>
            </div>
          ) : null}
        </section>
      ) : null}
      {settings.invoiceFooter ? (
        <footer className="doc__footer">{settings.invoiceFooter}</footer>
      ) : null}
    </article>
  );
}
