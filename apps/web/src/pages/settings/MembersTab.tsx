import { useState } from 'react';
import {
  assignableRoles,
  formatDateTime,
  inviteMemberSchema,
  labelFor,
  ROLES,
  type MemberDto,
  type Role,
} from '@ledgerline/shared';
import {
  useInviteMember,
  useMembers,
  useRemoveMember,
  useRevokeInvite,
  useUpdateMemberRole,
} from '../../api/workspaces';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { CopyField } from '../../components/CopyField';
import { ErrorState } from '../../components/ErrorState';
import { Field } from '../../components/Field';
import { Form, FormError } from '../../components/Form';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { SkeletonRows } from '../../components/Skeleton';
import { useAuth } from '../../hooks/useAuth';
import { useForm } from '../../hooks/useForm';
import { useToast } from '../../hooks/useToast';
import { useWorkspace } from '../../hooks/useWorkspace';

function inviteUrl(token: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/invite/${token}`;
}

export function MembersTab({ readOnly }: { readOnly: boolean }) {
  const { role } = useWorkspace();
  const { user } = useAuth();
  const query = useMembers();
  const invite = useInviteMember();
  const updateRole = useUpdateMemberRole();
  const remove = useRemoveMember();
  const revoke = useRevokeInvite();
  const toast = useToast();
  const [removing, setRemoving] = useState<MemberDto | null>(null);
  const roles = assignableRoles(role);

  const form = useForm<
    { email: string; role: 'admin' | 'accountant' | 'member' },
    typeof inviteMemberSchema
  >({
    schema: inviteMemberSchema,
    initial: { email: '', role: 'member' },
    onSubmit: async (data) => {
      await invite.mutateAsync(data);
      toast.success('Invitation created', 'Copy the link below and send it to your colleague.');
      form.reset();
    },
  });

  if (query.isLoading) return <SkeletonRows rows={4} />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const { items, invites } = query.data ?? { items: [], invites: [] };

  return (
    <div className="stack stack--lg">
      <section>
        <h3 className="form__section-title">Members</h3>
        <div>
          {items.map((m) => {
            const self = m.userId === user?.id;
            const canChange = !readOnly && !self && roles.includes(m.role);
            return (
              <div key={m.userId} className="member-row">
                <Avatar name={m.name} />
                <div style={{ minWidth: 0 }}>
                  <div className="truncate">
                    <strong>{m.name}</strong> {self ? <span className="muted">(you)</span> : null}
                  </div>
                  <div className="tiny muted truncate">
                    {m.email} · joined {formatDateTime(m.joinedAt)}
                  </div>
                </div>
                {canChange ? (
                  <Select
                    size="sm"
                    aria-label={`Role for ${m.name}`}
                    value={m.role}
                    onChange={(e) =>
                      updateRole.mutate(
                        { userId: m.userId, role: e.target.value as Role },
                        {
                          onSuccess: () => toast.success('Role updated'),
                          onError: (err) => toast.error('Could not change role', err.message),
                        },
                      )
                    }
                    options={roles.map((r) => ({ value: r, label: labelFor(ROLES, r) }))}
                  />
                ) : (
                  <span className="small">{labelFor(ROLES, m.role)}</span>
                )}
                {canChange ? (
                  <Button size="sm" variant="ghost" onClick={() => setRemoving(m)}>
                    Remove
                  </Button>
                ) : (
                  <span />
                )}
              </div>
            );
          })}
        </div>
      </section>
      {!readOnly ? (
        <section className="stack">
          <h3 className="form__section-title">Invite someone</h3>
          <Form onSubmit={form.handleSubmit} aria-label="Invite member" style={{ gap: 8 }}>
            <FormError message={form.submitError} />
            <div className="row row--start row--wrap" style={{ gap: 12 }}>
              <Field label="Email" error={form.errors.email} required className="grow">
                <Input
                  type="email"
                  value={form.values.email}
                  onChange={(e) => form.setValue('email', e.target.value)}
                  placeholder="colleague@studio.com"
                />
              </Field>
              <Field label="Role" error={form.errors.role}>
                <Select
                  value={form.values.role}
                  onChange={(e) =>
                    form.setValue('role', e.target.value as 'admin' | 'accountant' | 'member')
                  }
                  options={roles
                    .filter((r) => r !== 'owner')
                    .map((r) => ({ value: r, label: labelFor(ROLES, r) }))}
                />
              </Field>
              <div style={{ paddingTop: 22 }}>
                <Button type="submit" variant="primary" loading={form.submitting}>
                  Create invite
                </Button>
              </div>
            </div>
          </Form>
          {invites.length > 0 ? (
            <div className="paper">
              <div className="paper__head">
                <h2 className="paper__title">Pending invitations</h2>
              </div>
              <div className="paper__body stack">
                {invites.map((inv) => (
                  <div
                    key={inv.id}
                    className="stack stack--sm"
                    style={{ paddingBottom: 12, borderBottom: '1px solid var(--rule)' }}
                  >
                    <div className="row row--between">
                      <span>
                        <strong>{inv.email}</strong>{' '}
                        <span className="muted">
                          · {labelFor(ROLES, inv.role)} · invited by {inv.invitedByName}
                        </span>
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          revoke.mutate(inv.id, {
                            onSuccess: () => toast.success('Invitation revoked'),
                          })
                        }
                      >
                        Revoke
                      </Button>
                    </div>
                    <CopyField
                      value={inviteUrl(inv.token)}
                      label={`Invite link for ${inv.email}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title={removing ? `Remove ${removing.name}?` : 'Remove member'}
        message="They lose access immediately. Their time entries and history stay on record."
        confirmLabel="Remove"
        variant="danger"
        onConfirm={async () => {
          if (!removing) return;
          await remove.mutateAsync(removing.userId);
          toast.success('Member removed');
        }}
      />
    </div>
  );
}
