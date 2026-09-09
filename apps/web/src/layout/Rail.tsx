import { NavLink } from 'react-router-dom';
import type { ComponentType, SVGProps } from 'react';
import { useUnreadCount } from '../api/notifications';
import { CountBadge } from '../components/Badge';
import {
  BrandMark,
  IconBell,
  IconCalendar,
  IconCheck,
  IconClients,
  IconClock,
  IconDashboard,
  IconExpense,
  IconInvoice,
  IconJournal,
  IconLedger,
  IconPayment,
  IconProjects,
  IconReports,
  IconSettings,
} from '../components/Icons';
import { useWorkspace } from '../hooks/useWorkspace';
import { cx } from '../lib/cx';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import type { Permission } from '@ledgerline/shared';
import { can } from '@ledgerline/shared';

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  permission?: Permission;
  badge?: 'notifications';
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { to: 'dashboard', label: 'Dashboard', icon: IconDashboard },
      { to: 'calendar', label: 'Calendar', icon: IconCalendar },
      { to: 'approvals', label: 'Approvals', icon: IconCheck },
      { to: 'notifications', label: 'Notifications', icon: IconBell, badge: 'notifications' },
    ],
  },
  {
    label: 'Work',
    items: [
      { to: 'clients', label: 'Clients', icon: IconClients, permission: 'clients.view' },
      { to: 'projects', label: 'Projects', icon: IconProjects },
      { to: 'time', label: 'Time', icon: IconClock },
    ],
  },
  {
    label: 'Billing',
    items: [
      { to: 'invoices', label: 'Invoices', icon: IconInvoice },
      { to: 'payments', label: 'Payments', icon: IconPayment },
      { to: 'expenses', label: 'Expenses', icon: IconExpense },
    ],
  },
  {
    label: 'Books',
    items: [
      {
        to: 'ledger/accounts',
        label: 'Chart of accounts',
        icon: IconLedger,
        permission: 'ledger.view',
      },
      { to: 'ledger/journal', label: 'Journal', icon: IconJournal, permission: 'ledger.view' },
      { to: 'reports', label: 'Reports', icon: IconReports, permission: 'reports.view' },
    ],
  },
  {
    label: 'Workspace',
    items: [{ to: 'settings', label: 'Settings', icon: IconSettings }],
  },
];

export function Rail() {
  const { base, role } = useWorkspace();
  const unread = useUnreadCount();
  return (
    <aside className="rail" aria-label="Primary">
      <NavLink to="/workspaces" className="rail__brand">
        <BrandMark className="rail__brand-mark" />
        Ledgerline
      </NavLink>
      <div className="rail__workspace">
        <WorkspaceSwitcher />
      </div>
      <nav className="rail__nav">
        {GROUPS.map((g) => {
          const items = g.items.filter((it) => !it.permission || can(role, it.permission));
          if (items.length === 0) return null;
          return (
            <div key={g.label} style={{ display: 'contents' }}>
              <div className="rail__group">{g.label}</div>
              {items.map((it) => (
                <NavLink
                  key={it.to}
                  to={`${base}/${it.to}`}
                  className={({ isActive }) => cx('rail__link', isActive && 'is-active')}
                >
                  <it.icon className="rail__icon" />
                  <span className="rail__link-label">{it.label}</span>
                  {it.badge === 'notifications' ? (
                    <CountBadge count={unread} label="unread" />
                  ) : null}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>
      <div className="rail__foot">
        Press <kbd>/</kbd> to search
      </div>
    </aside>
  );
}
