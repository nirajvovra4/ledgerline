import { useMemo } from 'react';
import { manualJournalEntrySchema, type AccountDto, type Cents } from '@ledgerline/shared';
import { useCreateJournalEntry } from '../../api/journal';
import { Button } from '../../components/Button';
import { DateInput } from '../../components/DateInput';
import { Drawer } from '../../components/Drawer';
import { Field } from '../../components/Field';
import { Form, FormError } from '../../components/Form';
import { IconPlus, IconTrash } from '../../components/Icons';
import { Input } from '../../components/Input';
import { Money } from '../../components/Money';
import { MoneyInput } from '../../components/MoneyInput';
import { Select } from '../../components/Select';
import { useForm } from '../../hooks/useForm';
import { useToast } from '../../hooks/useToast';
import { useWorkspace } from '../../hooks/useWorkspace';
import { accountGroups } from '../expenses/ExpenseForm';

interface LineValues {
  key: string;
  accountId: string;
  debitCents: Cents | null;
  creditCents: Cents | null;
  description: string;
}

interface Values {
  date: string;
  memo: string;
  lines: LineValues[];
}

let counter = 0;
const newLine = (): LineValues => ({
  key: `jl-${++counter}`,
  accountId: '',
  debitCents: null,
  creditCents: null,
  description: '',
});

export function ManualEntryDrawer({
  open,
  onClose,
  accounts,
  today,
}: {
  open: boolean;
  onClose: () => void;
  accounts: AccountDto[];
  today: string;
}) {
  const { currency } = useWorkspace();
  const create = useCreateJournalEntry();
  const toast = useToast();
  const groups = useMemo(() => accountGroups(accounts), [accounts]);
  const form = useForm<Values, typeof manualJournalEntrySchema>({
    schema: manualJournalEntrySchema,
    initial: { date: today, memo: '', lines: [newLine(), newLine()] },
    transform: (v) => ({
      date: v.date,
      memo: v.memo,
      lines: v.lines.map((l) => ({
        accountId: l.accountId,
        debitCents: l.debitCents ?? 0,
        creditCents: l.creditCents ?? 0,
        description: l.description,
      })),
    }),
    onSubmit: async (data) => {
      const res = await create.mutateAsync(data);
      toast.success(`Entry #${res.entry.entryNumber} posted`);
      onClose();
    },
  });
  const { values, errors } = form;
  const debit = values.lines.reduce((s, l) => s + (l.debitCents ?? 0), 0);
  const credit = values.lines.reduce((s, l) => s + (l.creditCents ?? 0), 0);
  const difference = debit - credit;
  const balanced = difference === 0 && debit > 0;
  const setLines = (lines: LineValues[]) => form.setValue('lines', lines);
  const updateLine = (key: string, patch: Partial<LineValues>) =>
    setLines(values.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const lineError = (i: number, field: string) => errors[`lines.${i}.${field}`];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="New manual journal entry"
      size="lg"
      locked={form.submitting}
      footer={
        <>
          <span
            className={`journal-diff ${balanced ? 'journal-diff--ok' : 'journal-diff--bad'}`}
            role="status"
            data-testid="journal-difference"
          >
            {balanced ? 'Balanced' : 'Difference'}{' '}
            {balanced ? null : <Money cents={difference} currency={currency} explicitSign />}
          </span>
          <span className="grow" />
          <Button variant="ghost" onClick={onClose} disabled={form.submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => form.handleSubmit()}
            loading={form.submitting}
            disabled={!balanced}
          >
            Post entry
          </Button>
        </>
      }
    >
      <Form onSubmit={form.handleSubmit}>
        <FormError message={form.submitError} />
        <div className="form__grid">
          <Field label="Date" error={errors.date} required>
            <DateInput
              value={values.date}
              onChange={(v) => form.setValue('date', v)}
              data-autofocus
            />
          </Field>
          <Field label="Memo" error={errors.memo} required>
            <Input
              value={values.memo}
              onChange={(e) => form.setValue('memo', e.target.value)}
              placeholder="Owner capital contribution"
            />
          </Field>
        </div>
        {errors.lines ? (
          <div className="form__error" role="alert">
            {errors.lines}
          </div>
        ) : null}
        <div className="stack stack--sm">
          <div className="journal-lines journal-lines__head">
            <span>Account</span>
            <span>Description</span>
            <span className="right">Debit</span>
            <span className="right">Credit</span>
            <span />
          </div>
          {values.lines.map((l, i) => (
            <div key={l.key} className="journal-lines" data-testid="journal-line">
              <div>
                <Select
                  aria-label={`Line ${i + 1} account`}
                  value={l.accountId}
                  onChange={(e) => updateLine(l.key, { accountId: e.target.value })}
                  placeholder="Account"
                  groups={groups}
                  invalid={Boolean(lineError(i, 'accountId'))}
                  size="sm"
                />
                {lineError(i, 'accountId') ? (
                  <div className="field__error">{lineError(i, 'accountId')}</div>
                ) : null}
              </div>
              <Input
                aria-label={`Line ${i + 1} description`}
                value={l.description}
                onChange={(e) => updateLine(l.key, { description: e.target.value })}
                size="sm"
              />
              <div>
                <MoneyInput
                  aria-label={`Line ${i + 1} debit`}
                  currency={currency}
                  value={l.debitCents}
                  onChange={(v) =>
                    updateLine(l.key, { debitCents: v, ...(v ? { creditCents: null } : {}) })
                  }
                  allowNegative={false}
                  showSymbol={false}
                  size="sm"
                  invalid={Boolean(lineError(i, 'debitCents'))}
                />
                {lineError(i, 'debitCents') ? (
                  <div className="field__error">{lineError(i, 'debitCents')}</div>
                ) : null}
              </div>
              <div>
                <MoneyInput
                  aria-label={`Line ${i + 1} credit`}
                  currency={currency}
                  value={l.creditCents}
                  onChange={(v) =>
                    updateLine(l.key, { creditCents: v, ...(v ? { debitCents: null } : {}) })
                  }
                  allowNegative={false}
                  showSymbol={false}
                  size="sm"
                  invalid={Boolean(lineError(i, 'creditCents'))}
                />
                {lineError(i, 'creditCents') ? (
                  <div className="field__error">{lineError(i, 'creditCents')}</div>
                ) : null}
              </div>
              <button
                type="button"
                className="icon-btn icon-btn--danger"
                aria-label="Remove line"
                disabled={values.lines.length <= 2}
                onClick={() => setLines(values.lines.filter((x) => x.key !== l.key))}
              >
                <IconTrash />
              </button>
            </div>
          ))}
          <div className="journal-totals">
            <span>Totals</span>
            <span className="right">
              <Money cents={debit} currency={currency} />
            </span>
            <span className="right">
              <Money cents={credit} currency={currency} />
            </span>
            <span />
          </div>
          <div>
            <Button
              size="sm"
              icon={<IconPlus />}
              onClick={() => setLines([...values.lines, newLine()])}
            >
              Add line
            </Button>
          </div>
        </div>
      </Form>
    </Drawer>
  );
}
