import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatDate, formatDateTime, humanize } from '@ledgerline/shared';
import { useJournalEntry, useReverseJournalEntry } from '../../api/journal';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ErrorState } from '../../components/ErrorState';
import { KeyValue } from '../../components/KeyValue';
import { Money } from '../../components/Money';
import { PageHeader } from '../../components/PageHeader';
import { SkeletonRows } from '../../components/Skeleton';
import { Table } from '../../components/Table';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../hooks/useToast';
import { useWorkspace } from '../../hooks/useWorkspace';

function sourceLink(base: string, sourceType: string, sourceId: string | null): string | null {
  if (!sourceId) return null;
  switch (sourceType) {
    case 'invoice':
      return `${base}/invoices/${sourceId}`;
    case 'payment':
      return `${base}/payments`;
    case 'expense':
    case 'expense_payment':
      return `${base}/expenses/${sourceId}`;
    case 'reversal':
      return `${base}/ledger/journal/${sourceId}`;
    default:
      return null;
  }
}

export function JournalEntryPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { base, currency } = useWorkspace();
  const canPost = usePermission('ledger.post');
  const navigate = useNavigate();
  const toast = useToast();
  const query = useJournalEntry(id);
  const reverse = useReverseJournalEntry();
  const [confirm, setConfirm] = useState(false);

  if (query.isLoading) return <SkeletonRows rows={6} />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const entry = query.data;
  if (!entry) return null;
  const link = sourceLink(base, entry.sourceType, entry.sourceId);

  return (
    <>
      <PageHeader
        title={`Entry #${entry.entryNumber}`}
        subtitle={entry.memo}
        crumbs={[
          { label: 'Books' },
          { label: 'Journal', to: `${base}/ledger/journal` },
          { label: `#${entry.entryNumber}` },
        ]}
        primary={
          canPost && entry.sourceType !== 'reversal' ? (
            <Button variant="danger" onClick={() => setConfirm(true)}>
              Reverse entry
            </Button>
          ) : undefined
        }
      />
      <div className="grid-main-aside">
        <section className="paper">
          <Table flush>
            <thead>
              <tr>
                <th>Account</th>
                <th>Description</th>
                <th className="is-money">Debit</th>
                <th className="is-money">Credit</th>
              </tr>
            </thead>
            <tbody>
              {entry.lines.map((l) => (
                <tr key={l.id}>
                  <td className={l.creditCents ? 'indent-1' : undefined}>
                    <span className="mono muted">{l.accountCode}</span>{' '}
                    <Link to={`${base}/ledger/accounts/${l.accountId}`}>{l.accountName}</Link>
                  </td>
                  <td className="is-wrap muted">{l.description}</td>
                  <td className="is-money">
                    {l.debitCents ? <Money cents={l.debitCents} currency={currency} /> : null}
                  </td>
                  <td className="is-money">
                    {l.creditCents ? <Money cents={l.creditCents} currency={currency} /> : null}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>Totals</td>
                <td className="is-money">
                  <Money cents={entry.totalDebitCents} currency={currency} />
                </td>
                <td className="is-money">
                  <Money cents={entry.totalCreditCents} currency={currency} />
                </td>
              </tr>
            </tfoot>
          </Table>
        </section>
        <section className="paper">
          <div className="paper__head">
            <h2 className="paper__title">Details</h2>
          </div>
          <div className="paper__body">
            <KeyValue
              stacked
              items={[
                { key: 'date', label: 'Date', value: formatDate(entry.date) },
                {
                  key: 'source',
                  label: 'Source',
                  value: link ? (
                    <Link to={link}>{humanize(entry.sourceType)}</Link>
                  ) : (
                    humanize(entry.sourceType)
                  ),
                },
                {
                  key: 'reversed',
                  label: 'Reverses',
                  value: entry.reversedEntryId ? (
                    <Link to={`${base}/ledger/journal/${entry.reversedEntryId}`}>
                      Entry {entry.reversedEntryId.slice(0, 8)}…
                    </Link>
                  ) : null,
                },
                {
                  key: 'by',
                  label: 'Posted by',
                  value: `${entry.postedByName} · ${formatDateTime(entry.createdAt)}`,
                },
              ]}
            />
          </div>
        </section>
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Reverse entry #${entry.entryNumber}?`}
        message="A new entry with debits and credits swapped will be posted today. The original stays on record."
        comment={{ label: 'Memo', placeholder: `Reversal of #${entry.entryNumber}` }}
        confirmLabel="Post reversal"
        variant="danger"
        onConfirm={async (memo) => {
          const res = await reverse.mutateAsync({ id: entry.id, memo: memo || undefined });
          toast.success(`Reversal #${res.entry.entryNumber} posted`);
          navigate(`${base}/ledger/journal/${res.entry.id}`);
        }}
      />
    </>
  );
}
