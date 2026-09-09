import { useEffect, type ReactNode } from 'react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { Breadcrumbs, type Crumb } from './Breadcrumbs';
import { useStrip } from '../layout/StripContext';

export interface PageHeaderProps {
  title: string;
  titleNode?: ReactNode;
  subtitle?: ReactNode;
  crumbs?: Crumb[];
  actions?: ReactNode;
  /** Primary action mirrored into the top ledger-line strip. */
  primary?: ReactNode;
  meta?: ReactNode;
}

/** Page heading; also publishes title/crumbs/primary action to the AppShell strip. */
export function PageHeader({
  title,
  titleNode,
  subtitle,
  crumbs = [],
  actions,
  primary,
  meta,
}: PageHeaderProps) {
  useDocumentTitle(title);
  const strip = useStrip();
  useEffect(() => {
    strip?.set({ title, crumbs, primary });
    return () => strip?.set(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, primary, JSON.stringify(crumbs)]);
  return (
    <header className="page-header">
      <div>
        {crumbs.length > 0 ? <Breadcrumbs items={crumbs} /> : null}
        <div className="page-header__meta">
          <h1 className="page-header__title">{titleNode ?? title}</h1>
          {meta}
        </div>
        {subtitle ? <div className="page-header__sub">{subtitle}</div> : null}
      </div>
      {actions || (primary && !strip) ? (
        <div className="page-header__actions">
          {actions}
          {!strip ? primary : null}
        </div>
      ) : null}
    </header>
  );
}
