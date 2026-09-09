import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { computeInvoiceTotals } from '@ledgerline/shared';
import { accounts, makeClient, SLUG, taxRates, TODAY } from '../../../test/fixtures';
import { mockFetch } from '../../../test/mockFetch';
import { renderWithProviders } from '../../../test/render';
import { computeEditorTotals, initialValues } from './editorState';
import { InvoiceEditor } from './InvoiceEditor';

const defaults = { accountId: accounts[3]!.id, taxRateId: taxRates[0]!.id };

function setup() {
  mockFetch([
    {
      path: `/api/w/${SLUG}/clients`,
      body: { items: [makeClient()], total: 1, page: 1, pageSize: 200 },
    },
    { path: `/api/w/${SLUG}/projects`, body: { items: [], total: 0, page: 1, pageSize: 200 } },
    { path: '/api/meta', body: { today: TODAY, version: 't', fixedClock: true } },
  ]);
  const onSubmit = vi.fn();
  const initial = {
    ...initialValues({ today: TODAY, termsDays: 30, defaults, clientId: makeClient().id }),
    lines: [],
  };
  renderWithProviders(
    <InvoiceEditor
      initial={initial}
      taxRates={taxRates}
      accounts={accounts}
      defaults={defaults}
      onSubmit={onSubmit}
      submitLabel="Create draft"
    />,
    {
      route: `/w/${SLUG}/invoices/new`,
      path: '/w/:slug/invoices/new',
      workspace: true,
    },
  );
  return { onSubmit };
}

describe('computeEditorTotals', () => {
  it('delegates to computeInvoiceTotals and summarises tax by rate', () => {
    const lines = [
      {
        key: 'a',
        description: 'A',
        quantity: 2,
        unitPriceCents: 10000,
        taxRateId: taxRates[0]!.id,
        accountId: 'x',
      },
      {
        key: 'b',
        description: 'B',
        quantity: 1,
        unitPriceCents: 5000,
        taxRateId: null,
        accountId: 'x',
      },
    ];
    const t = computeEditorTotals(lines, 1000, taxRates);
    const expected = computeInvoiceTotals(
      [
        { quantity: 2, unitPriceCents: 10000, taxRateBp: 2000 },
        { quantity: 1, unitPriceCents: 5000, taxRateBp: 0 },
      ],
      1000,
    );
    expect(t.subtotalCents).toBe(expected.subtotalCents);
    expect(t.discountCents).toBe(expected.discountCents);
    expect(t.taxCents).toBe(expected.taxCents);
    expect(t.totalCents).toBe(expected.totalCents);
    expect(t.taxRows).toHaveLength(1);
    expect(t.taxRows[0]).toMatchObject({
      name: 'VAT',
      rateBp: 2000,
      taxCents: expected.lines[0]!.taxCents,
    });
  });
});

describe('InvoiceEditor totals panel', () => {
  it('updates live as lines and a discount are entered', async () => {
    setup();
    // Step 1 → 2
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    const panel = screen.getByTestId('totals-panel');
    expect(within(panel).getByText('Total').nextSibling).toHaveTextContent('$0.00');

    await userEvent.click(screen.getByRole('button', { name: 'Add line' }));
    await userEvent.type(screen.getByLabelText('Line 1 description'), 'Design');
    const qty = screen.getByLabelText('Line 1 quantity');
    await userEvent.clear(qty);
    await userEvent.type(qty, '10');
    await userEvent.type(screen.getByLabelText('Line 1 unit price'), '100');
    // 10 × $100 = $1,000 + 20% VAT
    expect(within(panel).getByText(/Subtotal/).nextSibling).toHaveTextContent('$1,000.00');
    expect(within(panel).getByText('Tax').nextSibling).toHaveTextContent('$200.00');
    expect(within(panel).getByText('Total').nextSibling).toHaveTextContent('$1,200.00');

    await userEvent.click(screen.getByRole('button', { name: 'Add line' }));
    await userEvent.type(screen.getByLabelText('Line 2 description'), 'Hosting');
    await userEvent.type(screen.getByLabelText('Line 2 unit price'), '50');
    await userEvent.selectOptions(screen.getByLabelText('Line 2 tax rate'), '');
    expect(within(panel).getByText(/Subtotal/).nextSibling).toHaveTextContent('$1,050.00');
    expect(within(panel).getByText('Total').nextSibling).toHaveTextContent('$1,250.00');

    const discount = screen.getByLabelText('Discount percent');
    await userEvent.clear(discount);
    await userEvent.type(discount, '10');
    const expected = computeInvoiceTotals(
      [
        { quantity: 10, unitPriceCents: 10000, taxRateBp: 2000 },
        { quantity: 1, unitPriceCents: 5000, taxRateBp: 0 },
      ],
      1000,
    );
    expect(within(panel).getByText(/Discount 10%/).nextSibling).toHaveTextContent('-$105.00');
    expect(expected.discountCents).toBe(10500);
    expect(within(panel).getByText('Total').nextSibling).toHaveTextContent('$1,125.00');
    expect(expected.totalCents).toBe(112500);
    expect(screen.getAllByTestId('invoice-line')).toHaveLength(2);
  });

  it('blocks step 1 without a client and shows validation errors on submit', async () => {
    mockFetch([
      {
        path: `/api/w/${SLUG}/clients`,
        body: { items: [makeClient()], total: 1, page: 1, pageSize: 200 },
      },
      { path: `/api/w/${SLUG}/projects`, body: { items: [], total: 0, page: 1, pageSize: 200 } },
    ]);
    const initial = initialValues({ today: TODAY, termsDays: 30, defaults });
    renderWithProviders(
      <InvoiceEditor
        initial={initial}
        taxRates={taxRates}
        accounts={accounts}
        defaults={defaults}
        onSubmit={vi.fn()}
        submitLabel="Create draft"
      />,
      {
        route: `/w/${SLUG}/invoices/new`,
        path: '/w/:slug/invoices/new',
        workspace: true,
      },
    );
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Select a client to continue')).toBeInTheDocument();
    expect(screen.queryByLabelText('Line 1 description')).toBeNull();
  });
});
