import { Fragment } from 'react';
import { Link } from 'react-router-dom';

export interface Crumb {
  label: string;
  to?: string;
}

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb">
      <ol className={className ?? 'breadcrumbs'}>
        {items.map((c, i) => (
          <Fragment key={`${c.label}-${i}`}>
            {i > 0 ? (
              <li className="breadcrumbs__sep" aria-hidden="true">
                /
              </li>
            ) : null}
            <li>
              {c.to && i < items.length - 1 ? (
                <Link to={c.to}>{c.label}</Link>
              ) : (
                <span aria-current={i === items.length - 1 ? 'page' : undefined}>{c.label}</span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
