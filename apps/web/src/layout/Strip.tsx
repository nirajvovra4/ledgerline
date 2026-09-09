import { Link } from 'react-router-dom';
import { IconMoon, IconSun } from '../components/Icons';
import { SearchBox } from '../components/SearchBox';
import { useTheme } from '../hooks/useTheme';
import { useStrip } from './StripContext';
import { UserMenu } from './UserMenu';

/** The "ledger line": page title + breadcrumbs, primary action, search, theme, user. */
export function Strip() {
  const strip = useStrip();
  const [theme, toggleTheme] = useTheme();
  const state = strip?.state;
  return (
    <header className="strip">
      <div className="strip__title-block">
        {state?.crumbs && state.crumbs.length > 1 ? (
          <div className="strip__crumbs">
            {state.crumbs.slice(0, -1).map((c, i) => (
              <span key={i}>
                {c.to ? <Link to={c.to}>{c.label}</Link> : c.label}
                <span aria-hidden="true"> / </span>
              </span>
            ))}
          </div>
        ) : null}
        <div className="strip__title">{state?.title ?? 'Ledgerline'}</div>
      </div>
      <div className="strip__tools">
        {state?.primary ? <div className="no-print">{state.primary}</div> : null}
        <SearchBox className="strip__search" />
        <button
          type="button"
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          title="Toggle theme"
        >
          {theme === 'dark' ? <IconSun /> : <IconMoon />}
        </button>
        <UserMenu />
      </div>
    </header>
  );
}
