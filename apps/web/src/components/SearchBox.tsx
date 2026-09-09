import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SearchHit } from '@ledgerline/shared';
import { useSearch } from '../api/workspaces';
import { useDebounce } from '../hooks/useDebounce';
import { useHotkeys } from '../hooks/useHotkeys';
import { useWorkspace } from '../hooks/useWorkspace';
import { cx } from '../lib/cx';
import { IconSearch } from './Icons';

const GROUPS: Array<{ key: keyof ReturnType<typeof groupsOf>; label: string }> = [
  { key: 'clients', label: 'Clients' },
  { key: 'projects', label: 'Projects' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'expenses', label: 'Expenses' },
];

function groupsOf(
  data:
    | { clients: SearchHit[]; projects: SearchHit[]; invoices: SearchHit[]; expenses: SearchHit[] }
    | undefined,
) {
  return {
    clients: data?.clients ?? [],
    projects: data?.projects ?? [],
    invoices: data?.invoices ?? [],
    expenses: data?.expenses ?? [],
  };
}

/** Workspace-wide search with a results dropdown. "/" focuses it from anywhere. */
export function SearchBox({ className }: { className?: string }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const q = useDebounce(text, 200);
  const search = useSearch(q);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { base } = useWorkspace();
  const listId = useId();

  const groups = groupsOf(search.data);
  const flat = useMemo(() => GROUPS.flatMap((g) => groups[g.key]), [groups]);

  useHotkeys(
    useMemo(
      () => ({
        '/': () => inputRef.current?.focus(),
        'mod+k': () => inputRef.current?.focus(),
      }),
      [],
    ),
  );

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => setActive(0), [q]);

  const go = (hit: SearchHit) => {
    setOpen(false);
    setText('');
    navigate(hit.link.startsWith('/') ? hit.link : `${base}/${hit.link}`);
  };

  const showResults = open && q.trim().length >= 2;

  return (
    <div
      ref={rootRef}
      className={cx('searchbox', className)}
      role="combobox"
      aria-expanded={showResults}
      aria-haspopup="listbox"
      aria-owns={listId}
    >
      <span className="searchbox__icon">
        <IconSearch />
      </span>
      <input
        ref={inputRef}
        className="input searchbox__input"
        placeholder="Search clients, projects, invoices…"
        aria-label="Search workspace"
        aria-autocomplete="list"
        aria-controls={listId}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
            inputRef.current?.blur();
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(flat.length - 1, a + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === 'Enter') {
            const hit = flat[active];
            if (hit) go(hit);
          }
        }}
      />
      {!text ? (
        <kbd className="searchbox__kbd" aria-hidden="true">
          /
        </kbd>
      ) : null}
      {showResults ? (
        <div className="searchbox__results" id={listId} role="listbox">
          {search.isLoading ? (
            <div className="searchbox__empty">Searching…</div>
          ) : flat.length === 0 ? (
            <div className="searchbox__empty">No matches for “{q}”.</div>
          ) : (
            GROUPS.map((g) => {
              const hits = groups[g.key];
              if (hits.length === 0) return null;
              return (
                <div key={g.key}>
                  <div className="searchbox__group">{g.label}</div>
                  {hits.map((hit) => {
                    const idx = flat.indexOf(hit);
                    return (
                      <button
                        type="button"
                        key={hit.id}
                        role="option"
                        aria-selected={idx === active}
                        className={cx('searchbox__hit', idx === active && 'is-active')}
                        style={{ width: '100%', textAlign: 'left' }}
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => go(hit)}
                      >
                        <div>{hit.title}</div>
                        {hit.subtitle ? (
                          <div className="searchbox__hit-sub">{hit.subtitle}</div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
