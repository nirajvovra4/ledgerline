import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { Avatar } from '../components/Avatar';
import { Dropdown, type MenuEntry } from '../components/Dropdown';
import { IconPlus } from '../components/Icons';
import { labelFor, ROLES } from '@ledgerline/shared';

export function WorkspaceSwitcher() {
  const { workspace, role } = useWorkspace();
  const { workspaces } = useAuth();
  const navigate = useNavigate();
  const items: MenuEntry[] = [
    { key: 'h', heading: 'Your workspaces' },
    ...workspaces.map((w) => ({
      key: w.id,
      label: (
        <span className="row" style={{ gap: 8 }}>
          <Avatar name={w.name} size="sm" square />
          <span className="grow truncate">{w.name}</span>
          <span className="tiny muted">{labelFor(ROLES, w.role)}</span>
        </span>
      ),
      active: w.slug === workspace.slug,
      onSelect: () => navigate(`/w/${w.slug}/dashboard`),
    })),
    { key: 'sep', separator: true },
    { key: 'new', label: 'Create workspace', icon: <IconPlus />, to: '/workspaces?new=1' },
  ];
  return (
    <Dropdown
      align="left"
      items={items}
      trigger={({ toggle, ...aria }) => (
        <button
          type="button"
          className="ws-switch"
          onClick={toggle}
          aria-controls={aria.id}
          aria-expanded={aria['aria-expanded']}
          aria-haspopup="menu"
          aria-label="Switch workspace"
        >
          <Avatar name={workspace.name} square />
          <span className="grow" style={{ minWidth: 0 }}>
            <div className="ws-switch__name">{workspace.name}</div>
            <div className="ws-switch__meta">
              {labelFor(ROLES, role)} · {workspace.currency}
            </div>
          </span>
          <span className="ws-switch__chev" aria-hidden="true">
            ▼
          </span>
        </button>
      )}
    />
  );
}
