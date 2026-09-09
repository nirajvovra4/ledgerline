import { useState } from 'react';
import { formatBp, parseBpInput, taxRateInputSchema, type TaxRateDto } from '@ledgerline/shared';
import {
  useArchiveTaxRate,
  useCreateTaxRate,
  useTaxRates,
  useUpdateTaxRate,
} from '../../api/taxRates';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Checkbox } from '../../components/Checkbox';
import { ErrorState } from '../../components/ErrorState';
import { Field } from '../../components/Field';
import { Form, FormError } from '../../components/Form';
import { IconPlus } from '../../components/Icons';
import { Input } from '../../components/Input';
import { SkeletonRows } from '../../components/Skeleton';
import { Table } from '../../components/Table';
import { useForm } from '../../hooks/useForm';
import { useToast } from '../../hooks/useToast';

function RateForm({ rate, onDone }: { rate?: TaxRateDto; onDone: () => void }) {
  const create = useCreateTaxRate();
  const update = useUpdateTaxRate();
  const toast = useToast();
  const form = useForm<
    { name: string; rate: string; isDefault: boolean },
    typeof taxRateInputSchema
  >({
    schema: taxRateInputSchema,
    initial: {
      name: rate?.name ?? '',
      rate: rate ? String(rate.rateBp / 100) : '',
      isDefault: rate?.isDefault ?? false,
    },
    transform: (v) => ({
      name: v.name,
      rateBp: parseBpInput(v.rate) ?? undefined,
      isDefault: v.isDefault,
    }),
    onSubmit: async (data) => {
      if (rate) await update.mutateAsync({ id: rate.id, ...data });
      else await create.mutateAsync(data);
      toast.success(rate ? 'Tax rate updated' : 'Tax rate added');
      onDone();
    },
  });
  return (
    <Form
      onSubmit={form.handleSubmit}
      style={{ gap: 8 }}
      aria-label={rate ? 'Edit tax rate' : 'New tax rate'}
    >
      <FormError message={form.submitError} />
      <div className="row row--start row--wrap" style={{ gap: 12 }}>
        <Field label="Name" error={form.errors.name} required>
          <Input
            value={form.values.name}
            onChange={(e) => form.setValue('name', e.target.value)}
            placeholder="VAT"
            autoFocus
          />
        </Field>
        <Field label="Rate" error={form.errors.rateBp} required>
          <Input
            value={form.values.rate}
            onChange={(e) => form.setValue('rate', e.target.value)}
            suffix="%"
            placeholder="20"
            inputMode="decimal"
            style={{ width: 110 }}
          />
        </Field>
        <Field label="Default" inline>
          <Checkbox
            checked={form.values.isDefault}
            onChange={(e) => form.setValue('isDefault', e.target.checked)}
          />
        </Field>
        <div className="row" style={{ paddingTop: 22 }}>
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={form.submitting}>
            {rate ? 'Save' : 'Add rate'}
          </Button>
        </div>
      </div>
    </Form>
  );
}

export function TaxRatesTab({ readOnly }: { readOnly: boolean }) {
  const query = useTaxRates();
  const archive = useArchiveTaxRate();
  const toast = useToast();
  const [editing, setEditing] = useState<string | 'new' | null>(null);

  if (query.isLoading) return <SkeletonRows rows={4} />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const rates = query.data ?? [];

  return (
    <div className="stack">
      <div className="row row--between">
        <p className="hint-text" style={{ margin: 0 }}>
          Tax rates apply per invoice line and per expense. Archived rates stay on existing
          documents.
        </p>
        {!readOnly && editing !== 'new' ? (
          <Button icon={<IconPlus />} onClick={() => setEditing('new')}>
            Add rate
          </Button>
        ) : null}
      </div>
      {editing === 'new' ? (
        <div className="paper">
          <div className="paper__body">
            <RateForm onDone={() => setEditing(null)} />
          </div>
        </div>
      ) : null}
      <Table compact>
        <thead>
          <tr>
            <th>Name</th>
            <th className="is-right">Rate</th>
            <th>Status</th>
            <th style={{ width: 160 }}>
              <span className="visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rates.length === 0 ? (
            <tr>
              <td colSpan={4} className="table__state">
                No tax rates yet.
              </td>
            </tr>
          ) : (
            rates.map((r) =>
              editing === r.id ? (
                <tr key={r.id}>
                  <td colSpan={4}>
                    <RateForm rate={r} onDone={() => setEditing(null)} />
                  </td>
                </tr>
              ) : (
                <tr key={r.id} style={r.archived ? { opacity: 0.55 } : undefined}>
                  <td className="table__primary">
                    {r.name} {r.isDefault ? <Badge tone="info">Default</Badge> : null}
                  </td>
                  <td className="is-right num">{formatBp(r.rateBp)}</td>
                  <td>{r.archived ? <span className="muted">Archived</span> : 'Active'}</td>
                  <td>
                    {!readOnly ? (
                      <span className="table__actions">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditing(r.id)}
                          disabled={r.archived}
                        >
                          Edit
                        </Button>
                        {!r.archived ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              archive.mutate(r.id, {
                                onSuccess: () => toast.success('Tax rate archived'),
                              })
                            }
                          >
                            Archive
                          </Button>
                        ) : null}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ),
            )
          )}
        </tbody>
      </Table>
    </div>
  );
}
