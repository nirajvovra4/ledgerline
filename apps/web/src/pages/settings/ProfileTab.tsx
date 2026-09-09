import { changePasswordSchema, updateProfileSchema } from '@ledgerline/shared';
import { useChangePassword, useUpdateProfile } from '../../api/auth';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { Form, FormActions, FormError, FormGrid, FormSection } from '../../components/Form';
import { Input } from '../../components/Input';
import { useAuth } from '../../hooks/useAuth';
import { useForm } from '../../hooks/useForm';
import { useToast } from '../../hooks/useToast';

export function ProfileTab() {
  const { user } = useAuth();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const toast = useToast();

  const profile = useForm({
    schema: updateProfileSchema,
    initial: { name: user?.name ?? '', email: user?.email ?? '' },
    onSubmit: async (data) => {
      await updateProfile.mutateAsync(data);
      toast.success('Profile updated');
    },
  });
  const password = useForm({
    schema: changePasswordSchema,
    initial: { currentPassword: '', newPassword: '', confirmPassword: '' },
    onSubmit: async (data) => {
      await changePassword.mutateAsync(data);
      toast.success('Password changed');
      password.reset();
    },
  });

  return (
    <div className="stack stack--lg">
      <Form onSubmit={profile.handleSubmit} aria-label="Profile">
        <FormError message={profile.submitError} />
        <FormSection title="Profile">
          <FormGrid>
            <Field label="Name" error={profile.errors.name} required>
              <Input
                value={profile.values.name}
                onChange={(e) => profile.setValue('name', e.target.value)}
                autoComplete="name"
              />
            </Field>
            <Field label="Email" error={profile.errors.email} required>
              <Input
                type="email"
                value={profile.values.email}
                onChange={(e) => profile.setValue('email', e.target.value)}
                autoComplete="email"
              />
            </Field>
          </FormGrid>
        </FormSection>
        <FormActions>
          <Button
            type="submit"
            variant="primary"
            loading={profile.submitting}
            disabled={!profile.dirty}
          >
            Save profile
          </Button>
        </FormActions>
      </Form>
      <Form onSubmit={password.handleSubmit} aria-label="Change password">
        <FormError message={password.submitError} />
        <FormSection title="Change password">
          <FormGrid>
            <Field
              label="Current password"
              error={password.errors.currentPassword}
              required
              className="span-2"
            >
              <Input
                type="password"
                value={password.values.currentPassword}
                onChange={(e) => password.setValue('currentPassword', e.target.value)}
                autoComplete="current-password"
              />
            </Field>
            <Field
              label="New password"
              error={password.errors.newPassword}
              required
              hint="At least 8 characters."
            >
              <Input
                type="password"
                value={password.values.newPassword}
                onChange={(e) => password.setValue('newPassword', e.target.value)}
                autoComplete="new-password"
              />
            </Field>
            <Field label="Confirm new password" error={password.errors.confirmPassword} required>
              <Input
                type="password"
                value={password.values.confirmPassword}
                onChange={(e) => password.setValue('confirmPassword', e.target.value)}
                autoComplete="new-password"
              />
            </Field>
          </FormGrid>
        </FormSection>
        <FormActions>
          <Button type="submit" variant="primary" loading={password.submitting}>
            Change password
          </Button>
        </FormActions>
      </Form>
    </div>
  );
}
