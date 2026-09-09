import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  billableAmount,
  formatDate,
  groupTimeByDay,
  minutesToDuration,
  pluralize,
  type TimeEntryDto,
} from '@ledgerline/shared';
import { useClientOptions } from '../../api/clients';
import { errorMessage } from '../../api/client';
import { useCreateInvoiceFromTime } from '../../api/invoices';
import { useProjectOptions } from '../../api/projects';
import { useTimeEntries } from '../../api/time';
import { Button } from '../../components/Button';
import { Checkbox } from '../../components/Checkbox';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { Field } from '../../components/Field';
import { FormError } from '../../components/Form';
import { Money } from '../../components/Money';
import { PageHeader } from '../../components/PageHeader';
import { Segmented } from '../../components/Segmented';
import { Select } from '../../components/Select';
import { SkeletonRows } from '../../components/Skeleton';
import { Stat } from '../../components/Stat';
import { useToast } from '../../hooks/useToast';
import { useWorkspace } from '../../hooks/useWorkspace';
import { cx } from '../../lib/cx';

type GroupBy = 'entry' | 'day' | 'project';

export function InvoiceFromTimePage() {
  const [params, setParams] = useSearchParams();
  const { base, currency, money } = useWorkspace();
  const navigate = useNavigate();
  const toast = useToast();
  const clientId = params.get('clientId') ?? '';
  const projectId = params.get('projectId') ?? '';
  const clients = useClientOptions();
  const projects = useProjectOptions(clientId || undefined);
  const entries = useTimeEntries(
    {
      clientId: clientId || undefined,
      projectId: projectId || undefined,
      uninvoiced: true,
      billable: true,
      pageSize: 200,
    },
    { enabled: Boolean(clientId) },
  );
  const create = useCreateInvoiceFromTime();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groupBy, setGroupBy] = useState<GroupBy>('day');

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === 'clientId') next.delete('projectId');
    setParams(next, { replace: true });
    setSelected(new Set());
  };

  const list = useMemo(() => entries.data?.items ?? [], [entries.data]);
  const grouped = useMemo(
    () => [...groupTimeByDay(list).entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)),
    [list],
  );
  const selectedEntries = list.filter((e) => selected.has(e.id));
  const selectedMinutes = selectedEntries.reduce((s, e) => s + e.minutes, 0);
  const selectedValue = selectedEntries.reduce(
    (s, e) => s + billableAmount(e.minutes, e.hourlyRateCents),
    0,
  );
  const allSelected = list.length > 0 && selected.size === list.length;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleDay = (dayEntries: TimeEntryDto[]) =>
    setSelected((prev) => {
      const next = new Set(prev);
      const all = dayEntries.every((e) => next.has(e.id));
      for (const e of dayEntries) {
        if (all) next.delete(e.id);
        else next.add(e.id);
      }
      return next;
    });

  const submit = () => {
    if (!clientId || selected.size === 0) return;
    create.mutate(
      { clientId, projectId: projectId || null, entryIds: [...selected], groupBy },
      {
        onSuccess: (res) => {
          toast.success(
            `Draft ${res.invoice.number} created`,
            `${pluralize(selected.size, 'entry', 'entries')} · ${minutesToDuration(selectedMinutes)}`,
          );
          navigate(`${base}/invoices/${res.invoice.id}`);
        },
      },
    );
  };

  return (
    <>
      <PageHeader
        title="Invoice unbilled time"
        subtitle="Pick a client, tick the entries to bill, and Ledgerline drafts the invoice."
        crumbs={[{ label: 'Invoices', to: `${base}/invoices` }, { label: 'From time' }]}
        primary={
          <Button
            variant="primary"
            onClick={submit}
            disabled={selected.size === 0}
            loading={create.isPending}
          >
            Create draft ({selected.size})
          </Button>
        }
      />
      <div className="grid-main-aside">
        <div className="stack">
          <div className="paper">
            <div className="paper__body form__grid">
              <Field label="Client" required>
                <Select
                  value={clientId}
                  onChange={(e) => setParam('clientId', e.target.value)}
                  placeholder={clients.isLoading ? 'Loading…' : 'Choose a client'}
                  options={(clients.data?.items ?? []).map((c) => ({ value: c.id, label: c.name }))}
                />
              </Field>
              <Field label="Project" hint="Leave empty to include every project for the client.">
                <Select
                  value={projectId}
                  onChange={(e) => setParam('projectId', e.target.value)}
                  placeholder="All projects"
                  disabled={!clientId}
                  options={(projects.data?.items ?? []).map((p) => ({
                    value: p.id,
                    label: p.name,
                  }))}
                />
              </Field>
            </div>
          </div>
          {create.error ? <FormError message={errorMessage(create.error)} /> : null}
          {!clientId ? (
            <EmptyState
              title="Choose a client to begin"
              description="Only billable entries that haven’t been invoiced are listed."
            />
          ) : entries.isLoading ? (
            <SkeletonRows rows={6} />
          ) : entries.error ? (
            <ErrorState error={entries.error} onRetry={() => entries.refetch()} />
          ) : list.length === 0 ? (
            <EmptyState
              title="Nothing to bill"
              description="Every billable entry for this selection is already on an invoice."
            />
          ) : (
            <div className="checklist">
              <div className="checklist__group" style={{ justifyContent: 'space-between' }}>
                <Checkbox
                  label={allSelected ? 'Deselect all' : 'Select all'}
                  checked={allSelected}
                  onChange={() =>
                    setSelected(allSelected ? new Set() : new Set(list.map((e) => e.id)))
                  }
                />
                <span className="muted">
                  {pluralize(list.length, 'uninvoiced entry', 'uninvoiced entries')}
                </span>
              </div>
              {grouped.map(([date, bucket]) => {
                const dayChecked = bucket.entries.every((e) => selected.has(e.id));
                const dayValue = bucket.entries.reduce(
                  (s, e) => s + billableAmount(e.minutes, e.hourlyRateCents),
                  0,
                );
                return (
                  <div key={date}>
                    <div className="checklist__group">
                      <Checkbox
                        checked={dayChecked}
                        onChange={() => toggleDay(bucket.entries)}
                        aria-label={`Select all on ${date}`}
                      />
                      <span className="grow">{formatDate(date, 'long')}</span>
                      <span className="muted">{minutesToDuration(bucket.minutes)}</span>
                      <Money cents={dayValue} currency={currency} />
                    </div>
                    {bucket.entries.map((e) => (
                      <label
                        key={e.id}
                        className={cx('checklist__item', selected.has(e.id) && 'is-checked')}
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(e.id)}
                          onChange={() => toggle(e.id)}
                          aria-label={`${e.projectName}: ${e.description || 'time entry'}`}
                        />
                        <span style={{ minWidth: 0 }}>
                          <div className="truncate">
                            <strong>{e.projectName}</strong>
                            {e.description ? (
                              <span className="soft"> — {e.description}</span>
                            ) : null}
                          </div>
                          <div className="tiny muted">
                            {e.userName} · {money.fmt(e.hourlyRateCents)}/h
                          </div>
                        </span>
                        <span className="num">{minutesToDuration(e.minutes)}</span>
                        <Money
                          cents={billableAmount(e.minutes, e.hourlyRateCents)}
                          currency={currency}
                        />
                      </label>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <aside className="stack">
          <div className="stat-strip" style={{ gridTemplateColumns: '1fr' }}>
            <Stat
              label="Selected"
              value={minutesToDuration(selectedMinutes)}
              sub={pluralize(selected.size, 'entry', 'entries')}
              size="sm"
            />
            <Stat
              label="Estimated subtotal"
              value={money.fmt(selectedValue)}
              sub="before tax"
              size="sm"
            />
          </div>
          <div className="paper">
            <div className="paper__body stack stack--sm">
              <div className="caps">Group lines by</div>
              <Segmented
                ariaLabel="Group lines by"
                value={groupBy}
                onChange={setGroupBy}
                options={[
                  { value: 'entry', label: 'Entry' },
                  { value: 'day', label: 'Day' },
                  { value: 'project', label: 'Project' },
                ]}
              />
              <p className="hint-text" style={{ margin: 0 }}>
                {groupBy === 'entry'
                  ? 'One invoice line per time entry.'
                  : groupBy === 'day'
                    ? 'One line per day, per project.'
                    : 'A single line per project with the total hours.'}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
