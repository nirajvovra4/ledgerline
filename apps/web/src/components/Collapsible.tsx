import { useId, useState, type ReactNode } from 'react';

export function Collapsible({
  title,
  children,
  defaultOpen = false,
}: {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className="collapsible">
      <button
        type="button"
        className="collapsible__toggle"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="collapsible__chevron" aria-hidden="true">
          ▶
        </span>
        {title}
      </button>
      {open ? <div id={id}>{children}</div> : null}
    </div>
  );
}
