import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ACCOUNT_TYPES,
  buildAccountTree,
  flattenTree,
  type AccountDto,
  type AccountType,
} from '@ledgerline/shared';
import { useAccounts, useUpdateAccount } from '../../api/accounts';
import { Button } from '../../components/Button';
import { Checkbox } from '../../components/Checkbox';
import { ErrorState } from '../../components/ErrorState';
import { IconPencil, IconPlus } from '../../components/Icons';
import { Money } from '../../components/Money';
import { PageHeader } from '../../components/PageHeader';
import { SkeletonRows } from '../../components/Skeleton';
import { Table } from '../../components/Table';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../hooks/useToast';
import { useWorkspace } from '../../hooks/useWorkspace';
import { cx } from '../../lib/cx';
import { ACCOUNT_TYPE_PLURALS } from '../../lib/labels';
import { AccountDrawer } from './AccountDrawer';

export function AccountsPage() {
  const { base, currency, money } = useWorkspace();
  const canPost = usePermission('ledger.post');
  const [includeArchived, setIncludeArchived] = useState(false);
  const query = useAccounts(includeArchived);
  const update = useUpdateAccount();
  const toast = useToast();
  const [drawer, setDrawer] = useState<{ account?: AccountDto; type?: AccountType } | null>(null);

  const byType = useMemo(() => {
    const items = query.data?.items ?? [];
    return ACCOUNT_TYPES.map((t) => {
      const tree = buildAccountTree(items.filter((a) => a.type === t.value));
      const rows = flattenTree(tree);
      const total = tree.reduce((s, n) => s + n.rollupCents, 0);
      return { type: t, rows, total };
    });
  }, [query.data]);

  return (
    <>
      <PageHeader
        title="Chart of accounts"
        subtitle="Balances are shown in each account’s natural direction; parents roll up their children."
        crumbs={[{ label: 'Books' }, { label: 'Chart of accounts' }]}
        actions={
          <Checkbox
            label="Show archived"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
          />
        }
        primary={
          canPost ? (
            <Button variant="primary" icon={<IconPlus />} onClick={() => setDrawer({})}>
              New account
            </Button>
          ) : undefined
        }
      />
      {query.isLoading ? (
        <SkeletonRows rows={10} />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <div className="stack stack--lg">
          {byType.map(({ type, rows, total }) => (
            <section key={type.value} className="paper">
              <div className="paper__head">
                <h2 className="paper__title">{ACCOUNT_TYPE_PLURALS[type.value] ?? type.label}</h2>
                <div className="row">
                  <span className="small">
                    Total <strong>{money.fmt(total)}</strong>
                  </span>
                  {canPost ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDrawer({ type: type.value })}
                      aria-label={`New ${type.label.toLowerCase()} account`}
                    >
                      + Add
                    </Button>
                  ) : null}
                </div>
              </div>
              {rows.length === 0 ? (
                <div className="paper__body muted small">No accounts of this type.</div>
              ) : (
                <Table compact flush>
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th className="is-money">Balance</th>
                      <th className="is-money">Incl. children</th>
                      <th style={{ width: 90 }}>
                        <span className="visually-hidden">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((a) => (
                      <tr key={a.id} className={cx('acct-tree__row', a.archived && 'is-archived')}>
                        <td className={a.depth > 0 ? `indent-${Math.min(4, a.depth)}` : undefined}>
                          <span className="acct-tree__name">
                            <span className="acct-tree__code">{a.code}</span>
                            <Link to={`${base}/ledger/accounts/${a.id}`}>{a.name}</Link>
                            {a.isSystem ? <span className="acct-tree__sys">system</span> : null}
                          </span>
                          {a.description ? (
                            <div className="table__secondary">{a.description}</div>
                          ) : null}
                        </td>
                        <td className="is-money">
                          <Money cents={a.balanceCents} currency={currency} muteZero />
                        </td>
                        <td className="is-money">
                          {a.children.length > 0 ? (
                            <Money cents={a.rollupCents} currency={currency} />
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td>
                          {canPost ? (
                            <span className="table__actions">
                              <button
                                type="button"
                                className="icon-btn"
                                aria-label={`Edit ${a.name}`}
                                onClick={() => setDrawer({ account: a })}
                              >
                                <IconPencil />
                              </button>
                              {!a.isSystem ? (
                                <button
                                  type="button"
                                  className="btn btn--ghost btn--sm"
                                  onClick={() =>
                                    update.mutate(
                                      { id: a.id, archived: !a.archived },
                                      {
                                        onSuccess: () =>
                                          toast.success(
                                            a.archived ? 'Account restored' : 'Account archived',
                                          ),
                                      },
                                    )
                                  }
                                >
                                  {a.archived ? 'Restore' : 'Archive'}
                                </button>
                              ) : null}
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </section>
          ))}
        </div>
      )}
      {drawer ? (
        <AccountDrawer
          open
          onClose={() => setDrawer(null)}
          account={drawer.account}
          accounts={query.data?.items ?? []}
          defaultType={drawer.type}
        />
      ) : null}
    </>
  );
}
