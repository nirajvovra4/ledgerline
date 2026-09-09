import {
  ACCOUNT_TYPES,
  accountInputSchema,
  type AccountDto,
  type AccountType,
} from '@ledgerline/shared';
import { useCreateAccount, useUpdateAccount } from '../../api/accounts';
import { Button } from '../../components/Button';
import { Drawer } from '../../components/Drawer';
import { Field } from '../../components/Field';
import { Form, FormError } from '../../components/Form';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { Switch } from '../../components/Switch';
import { Textarea } from '../../components/Textarea';
import { useForm } from '../../hooks/useForm';
import { useToast } from '../../hooks/useToast';

interface Values {
  code: string;
  name: string;
  type: AccountType;
  parentId: string;
  description: string;
  archived: boolean;
}

export function AccountDrawer({
  open,
  onClose,
  account,
  accounts,
  defaultType,
}: {
  open: boolean;
  onClose: () => void;
  account?: AccountDto;
  accounts: AccountDto[];
  defaultType?: AccountType;
}) {
  const create = useCreateAccount();
  const update = useUpdateAccount();
  const toast = useToast();
  const form = useForm<Values, typeof accountInputSchema>({
    schema: accountInputSchema,
    initial: {
      code: account?.code ?? '',
      name: account?.name ?? '',
      type: account?.type ?? defaultType ?? 'expense',
      parentId: account?.parentId ?? '',
      description: account?.description ?? '',
      archived: account?.archived ?? false,
    },
    transform: (v) => ({ ...v, parentId: v.parentId || null }),
    onSubmit: async (data) => {
      if (account) {
        await update.mutateAsync({ id: account.id, ...data });
        toast.success('Account updated');
      } else {
        await create.mutateAsync(data);
        toast.success('Account created');
      }
      onClose();
    },
  });
  const parents = accounts.filter(
    (a) => a.type === form.values.type && a.id !== account?.id && !a.archived,
  );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={account ? `Edit ${account.code} ${account.name}` : 'New account'}
      locked={form.submitting}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={form.submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => form.handleSubmit()} loading={form.submitting}>
            {account ? 'Save' : 'Create account'}
          </Button>
        </>
      }
    >
      <Form onSubmit={form.handleSubmit}>
        <FormError message={form.submitError} />
        <Field label="Type" error={form.errors.type} required>
          <Select
            value={form.values.type}
            onChange={(e) => form.setValues({ type: e.target.value as AccountType, parentId: '' })}
            disabled={account?.isSystem}
            options={ACCOUNT_TYPES.map((t) => ({ value: t.value, label: t.label }))}
          />
        </Field>
        <div className="form__grid">
          <Field label="Code" error={form.errors.code} required hint="3–6 digits, e.g. 5150.">
            <Input
              value={form.values.code}
              onChange={(e) => form.setValue('code', e.target.value)}
              inputMode="numeric"
              data-autofocus
            />
          </Field>
          <Field label="Name" error={form.errors.name} required>
            <Input
              value={form.values.name}
              onChange={(e) => form.setValue('name', e.target.value)}
              disabled={account?.isSystem}
            />
          </Field>
        </div>
        <Field
          label="Parent account"
          error={form.errors.parentId}
          hint="Balances roll up into the parent on the chart."
        >
          <Select
            value={form.values.parentId}
            onChange={(e) => form.setValue('parentId', e.target.value)}
            placeholder="None (top level)"
            options={parents.map((a) => ({ value: a.id, label: `${a.code} ${a.name}` }))}
          />
        </Field>
        <Field label="Description" error={form.errors.description}>
          <Textarea
            value={form.values.description}
            onChange={(e) => form.setValue('description', e.target.value)}
            rows={2}
          />
        </Field>
        {account && !account.isSystem ? (
          <Field label="Archived" inline hint="Archived accounts are hidden from pickers.">
            <Switch checked={form.values.archived} onChange={(v) => form.setValue('archived', v)} />
          </Field>
        ) : null}
        {account?.isSystem ? (
          <p className="hint-text">
            System accounts keep their name and type; you can still recode, describe or re-parent
            them.
          </p>
        ) : null}
      </Form>
    </Drawer>
  );
}
