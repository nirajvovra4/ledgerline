import type { AccountDto, TaxRateDto } from '@ledgerline/shared';
import { taxRateLabel } from '../../../lib/labels';
import { Button } from '../../../components/Button';
import { Field } from '../../../components/Field';
import { FormSection } from '../../../components/Form';
import { IconArrowDown, IconArrowUp, IconPlus, IconTrash } from '../../../components/Icons';
import { Money } from '../../../components/Money';
import { MoneyInput } from '../../../components/MoneyInput';
import { NumberInput } from '../../../components/NumberInput';
import { Select } from '../../../components/Select';
import { Textarea } from '../../../components/Textarea';
import type { FieldErrors } from '../../../hooks/useForm';
import { blankLine, type EditorLine, type EditorTotals, type EditorValues } from './editorState';

export interface StepLinesProps {
  values: EditorValues;
  errors: FieldErrors;
  totals: EditorTotals;
  currency: string;
  taxRates: TaxRateDto[];
  accounts: AccountDto[];
  defaults: { accountId: string; taxRateId: string | null };
  onChange: (patch: Partial<EditorValues>) => void;
}

export function StepLines({
  values,
  errors,
  totals,
  currency,
  taxRates,
  accounts,
  defaults,
  onChange,
}: StepLinesProps) {
  const setLines = (lines: EditorLine[]) => onChange({ lines });
  const updateLine = (key: string, patch: Partial<EditorLine>) =>
    setLines(values.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= values.lines.length) return;
    const next = values.lines.slice();
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    setLines(next);
  };
  const revenueAccounts = accounts.filter((a) => a.type === 'revenue' && !a.archived);
  const activeRates = taxRates.filter((t) => !t.archived);
  const lineError = (i: number, field: string) => errors[`lines.${i}.${field}`];

  return (
    <FormSection title="Lines">
      {errors.lines ? (
        <div className="form__error" role="alert">
          {errors.lines}
        </div>
      ) : null}
      <div className="table-wrap">
        <table className="table lines-table">
          <thead>
            <tr>
              <th className="lines-table__desc">Description</th>
              <th className="lines-table__qty is-right">Qty</th>
              <th className="lines-table__price is-right">Unit price</th>
              <th className="lines-table__tax">Tax</th>
              <th className="lines-table__acct">Account</th>
              <th className="lines-table__total is-right">Total</th>
              <th className="lines-table__ctl">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {values.lines.map((line, i) => {
              const lt = totals.lines[i];
              return (
                <tr key={line.key} data-testid="invoice-line">
                  <td>
                    <Textarea
                      aria-label={`Line ${i + 1} description`}
                      value={line.description}
                      onChange={(e) => updateLine(line.key, { description: e.target.value })}
                      invalid={Boolean(lineError(i, 'description'))}
                      rows={1}
                      placeholder="Design work — June"
                    />
                    {lineError(i, 'description') ? (
                      <div className="field__error">{lineError(i, 'description')}</div>
                    ) : null}
                  </td>
                  <td>
                    <NumberInput
                      aria-label={`Line ${i + 1} quantity`}
                      value={line.quantity}
                      onChange={(v) => updateLine(line.key, { quantity: v })}
                      invalid={Boolean(lineError(i, 'quantity'))}
                      decimals={4}
                      min={0}
                    />
                    {lineError(i, 'quantity') ? (
                      <div className="field__error">{lineError(i, 'quantity')}</div>
                    ) : null}
                  </td>
                  <td>
                    <MoneyInput
                      aria-label={`Line ${i + 1} unit price`}
                      currency={currency}
                      value={line.unitPriceCents}
                      onChange={(v) => updateLine(line.key, { unitPriceCents: v })}
                      invalid={Boolean(lineError(i, 'unitPriceCents'))}
                      showSymbol={false}
                    />
                    {lineError(i, 'unitPriceCents') ? (
                      <div className="field__error">{lineError(i, 'unitPriceCents')}</div>
                    ) : null}
                  </td>
                  <td>
                    <Select
                      aria-label={`Line ${i + 1} tax rate`}
                      value={line.taxRateId ?? ''}
                      onChange={(e) => updateLine(line.key, { taxRateId: e.target.value || null })}
                      placeholder="No tax"
                      options={activeRates.map((t) => ({ value: t.id, label: taxRateLabel(t) }))}
                    />
                  </td>
                  <td>
                    <Select
                      aria-label={`Line ${i + 1} account`}
                      value={line.accountId}
                      onChange={(e) => updateLine(line.key, { accountId: e.target.value })}
                      invalid={Boolean(lineError(i, 'accountId'))}
                      placeholder="Account"
                      options={revenueAccounts.map((a) => ({
                        value: a.id,
                        label: `${a.code} ${a.name}`,
                      }))}
                    />
                  </td>
                  <td className="lines-table__total is-money">
                    <Money cents={lt?.lineTotalCents ?? 0} currency={currency} />
                    {lt && lt.taxCents > 0 ? (
                      <div className="tiny muted">
                        + <Money cents={lt.taxCents} currency={currency} /> tax
                      </div>
                    ) : null}
                  </td>
                  <td className="lines-table__ctl">
                    <span className="table__actions">
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="Move line up"
                        disabled={i === 0}
                        onClick={() => move(i, -1)}
                      >
                        <IconArrowUp />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="Move line down"
                        disabled={i === values.lines.length - 1}
                        onClick={() => move(i, 1)}
                      >
                        <IconArrowDown />
                      </button>
                      <button
                        type="button"
                        className="icon-btn icon-btn--danger"
                        aria-label="Remove line"
                        disabled={values.lines.length === 1}
                        onClick={() => setLines(values.lines.filter((l) => l.key !== line.key))}
                      >
                        <IconTrash />
                      </button>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="row row--between row--wrap">
        <Button
          icon={<IconPlus />}
          onClick={() => setLines([...values.lines, blankLine(defaults)])}
        >
          Add line
        </Button>
        <Field label="Discount" inline error={errors.discountBp}>
          <NumberInput
            aria-label="Discount percent"
            value={values.discountBp / 100}
            onChange={(v) =>
              onChange({ discountBp: Math.max(0, Math.min(10_000, Math.round((v ?? 0) * 100))) })
            }
            suffix="%"
            decimals={2}
            min={0}
            max={100}
            size="sm"
            style={{ width: 90 }}
          />
        </Field>
      </div>
    </FormSection>
  );
}
