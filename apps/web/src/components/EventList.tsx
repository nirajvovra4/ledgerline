import { Link } from 'react-router-dom';
import { formatDate, type CalendarEvent } from '@ledgerline/shared';
import { useWorkspace } from '../hooks/useWorkspace';
import { cx } from '../lib/cx';
import { Money } from './Money';

export function eventHref(base: string, link: string): string {
  return link.startsWith('/') ? link : `${base}/${link}`;
}

export function EventList({
  events,
  showDate = true,
  emptyLabel = 'Nothing scheduled.',
}: {
  events: CalendarEvent[];
  showDate?: boolean;
  emptyLabel?: string;
}) {
  const { base, currency } = useWorkspace();
  if (events.length === 0) return <p className="muted small">{emptyLabel}</p>;
  return (
    <ul className="event-list">
      {events.map((e) => (
        <li key={e.id} className="event-list__item">
          <span
            className={cx('event-list__bar', `event-list__bar--${e.tone}`)}
            aria-hidden="true"
          />
          <div style={{ minWidth: 0 }}>
            <div className="event-list__title truncate">
              <Link to={eventHref(base, e.link)}>{e.title}</Link>
            </div>
            <div className="event-list__sub">
              {showDate ? `${formatDate(e.date)} · ` : ''}
              {e.subtitle}
            </div>
          </div>
          {e.amountCents != null ? (
            <Money cents={e.amountCents} currency={currency} className="small" />
          ) : (
            <span />
          )}
        </li>
      ))}
    </ul>
  );
}
