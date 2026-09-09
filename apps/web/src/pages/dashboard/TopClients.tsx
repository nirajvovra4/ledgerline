import { Link } from 'react-router-dom';
import { formatBp, type DashboardDto } from '@ledgerline/shared';
import { ShareBar } from '../../components/Progress';
import { useWorkspace } from '../../hooks/useWorkspace';

export function TopClients({ clients }: { clients: DashboardDto['topClients'] }) {
  const { money, base } = useWorkspace();
  if (clients.length === 0) return <p className="muted small">No revenue in this period.</p>;
  return (
    <ul className="dash__list">
      {clients.map((c) => (
        <li key={c.clientId} className="dash__client">
          <Link to={`${base}/clients/${c.clientId}`} className="truncate">
            {c.name}
          </Link>
          <span className="num">
            {money.fmt(c.revenueCents)}{' '}
            <span className="muted tiny">{formatBp(c.shareBp, { decimals: 0 })}</span>
          </span>
          <ShareBar bp={c.shareBp} />
        </li>
      ))}
    </ul>
  );
}
