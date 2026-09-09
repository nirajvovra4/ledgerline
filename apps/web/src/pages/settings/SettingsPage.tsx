import { PageHeader } from '../../components/PageHeader';
import { UrlTabs, useUrlTab } from '../../components/Tabs';
import { usePermission } from '../../hooks/usePermission';
import { useWorkspace } from '../../hooks/useWorkspace';
import { GeneralTab } from './GeneralTab';
import { InvoicingTab } from './InvoicingTab';
import { MembersTab } from './MembersTab';
import { ProfileTab } from './ProfileTab';
import { TaxRatesTab } from './TaxRatesTab';

const TABS = [
  { key: 'general', label: 'General' },
  { key: 'invoicing', label: 'Invoicing' },
  { key: 'tax', label: 'Tax rates' },
  { key: 'members', label: 'Members' },
  { key: 'profile', label: 'Profile' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

export function SettingsPage() {
  const { workspace } = useWorkspace();
  const canManage = usePermission('workspace.manage');
  const canMembers = usePermission('members.manage');
  const [tab] = useUrlTab<TabKey>([...TABS], 'general');
  return (
    <div className="settings-layout">
      <PageHeader
        title="Settings"
        subtitle={canManage ? workspace.name : `${workspace.name} · read-only for your role`}
        crumbs={[{ label: 'Settings' }]}
      />
      <UrlTabs items={[...TABS]} defaultKey="general" ariaLabel="Settings sections" />
      <div className="paper">
        <div className="paper__body">
          {tab === 'general' ? <GeneralTab readOnly={!canManage} /> : null}
          {tab === 'invoicing' ? <InvoicingTab readOnly={!canManage} /> : null}
          {tab === 'tax' ? <TaxRatesTab readOnly={!canManage} /> : null}
          {tab === 'members' ? <MembersTab readOnly={!canMembers} /> : null}
          {tab === 'profile' ? <ProfileTab /> : null}
        </div>
      </div>
    </div>
  );
}
