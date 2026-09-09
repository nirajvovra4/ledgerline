import { useNavigate } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { Dropdown } from '../components/Dropdown';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useOptionalWorkspace } from '../hooks/useWorkspace';

export function UserMenu() {
  const { user, logout } = useAuth();
  const ws = useOptionalWorkspace();
  const navigate = useNavigate();
  const toast = useToast();
  if (!user) return null;
  return (
    <Dropdown
      header={
        <div className="user-menu__who">
          <div className="user-menu__name">{user.name}</div>
          <div className="user-menu__email">{user.email}</div>
        </div>
      }
      items={[
        ...(ws
          ? [{ key: 'profile', label: 'Profile & password', to: `${ws.base}/settings?tab=profile` }]
          : []),
        { key: 'workspaces', label: 'Switch workspace', to: '/workspaces' },
        { key: 'sep', separator: true },
        {
          key: 'logout',
          label: 'Sign out',
          onSelect: () => {
            logout.mutate(undefined, {
              onSuccess: () => navigate('/login'),
              onError: () => toast.error('Could not sign out'),
            });
          },
        },
      ]}
      trigger={({ toggle, ...aria }) => (
        <button
          type="button"
          className="user-menu__btn"
          onClick={toggle}
          aria-controls={aria.id}
          aria-expanded={aria['aria-expanded']}
          aria-haspopup="menu"
          aria-label="Account menu"
        >
          <Avatar name={user.name} />
        </button>
      )}
    />
  );
}
