import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { accounts, SLUG, TODAY } from '../../test/fixtures';
import { mockFetch } from '../../test/mockFetch';
import { renderWithProviders } from '../../test/render';
import { ManualEntryDrawer } from './ManualEntryDrawer';

describe('ManualEntryDrawer', () => {
  it('shows the difference and only enables posting once balanced', async () => {
    const { calls } = mockFetch([
      {
        method: 'POST',
        path: `/api/w/${SLUG}/journal`,
        body: { entry: { id: 'e1', entryNumber: 42 } },
      },
    ]);
    let closed = false;
    renderWithProviders(
      <ManualEntryDrawer open onClose={() => (closed = true)} accounts={accounts} today={TODAY} />,
      { route: `/w/${SLUG}/ledger/journal`, path: '/w/:slug/ledger/journal', workspace: true },
    );

    const post = screen.getByRole('button', { name: 'Post entry' });
    const diff = screen.getByTestId('journal-difference');
    expect(post).toBeDisabled();
    expect(diff).toHaveTextContent('Difference');

    await userEvent.type(screen.getByLabelText('Memo'), 'Owner contribution');
    await userEvent.selectOptions(screen.getByLabelText('Line 1 account'), accounts[0]!.id);
    await userEvent.type(screen.getByLabelText('Line 1 debit'), '1000');
    expect(diff).toHaveTextContent('Difference');
    expect(diff).toHaveTextContent('+$1,000.00');
    expect(post).toBeDisabled();

    await userEvent.selectOptions(screen.getByLabelText('Line 2 account'), accounts[2]!.id);
    await userEvent.type(screen.getByLabelText('Line 2 credit'), '400');
    expect(diff).toHaveTextContent('+$600.00');
    expect(post).toBeDisabled();

    await userEvent.clear(screen.getByLabelText('Line 2 credit'));
    await userEvent.type(screen.getByLabelText('Line 2 credit'), '1000');
    expect(diff).toHaveTextContent('Balanced');
    expect(diff).toHaveClass('journal-diff--ok');
    expect(post).toBeEnabled();

    await userEvent.click(post);
    await screen.findByText('Entry #42 posted');
    const postCall = calls.find((c) => c.method === 'POST');
    expect(postCall?.body).toEqual({
      date: TODAY,
      memo: 'Owner contribution',
      lines: [
        { accountId: accounts[0]!.id, debitCents: 100000, creditCents: 0, description: '' },
        { accountId: accounts[2]!.id, debitCents: 0, creditCents: 100000, description: '' },
      ],
    });
    expect(closed).toBe(true);
  });

  it('clears the opposite side when a debit is typed on a credit line', async () => {
    mockFetch([]);
    renderWithProviders(
      <ManualEntryDrawer open onClose={() => undefined} accounts={accounts} today={TODAY} />,
      { route: `/w/${SLUG}/ledger/journal`, path: '/w/:slug/ledger/journal', workspace: true },
    );
    await userEvent.type(screen.getByLabelText('Line 1 credit'), '50');
    await userEvent.type(screen.getByLabelText('Line 1 debit'), '50');
    expect(screen.getByLabelText('Line 1 credit')).toHaveValue('');
    expect(screen.getByLabelText('Line 1 debit')).toHaveValue('50');
  });
});
