import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = (props: P) => ({
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...props,
});

export const IconDashboard = (p: P) => (
  <svg {...base(p)}>
    <rect x="2" y="2" width="5" height="5" />
    <rect x="9" y="2" width="5" height="5" />
    <rect x="2" y="9" width="5" height="5" />
    <rect x="9" y="9" width="5" height="5" />
  </svg>
);
export const IconCalendar = (p: P) => (
  <svg {...base(p)}>
    <rect x="2" y="3" width="12" height="11" />
    <path d="M2 6.5h12M5 1.5v3M11 1.5v3" />
  </svg>
);
export const IconCheck = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 8.5l3 3 7-7" />
  </svg>
);
export const IconBell = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 11V7a4 4 0 118 0v4l1.5 1.5h-11L4 11zM6.5 13.5a1.5 1.5 0 003 0" />
  </svg>
);
export const IconClients = (p: P) => (
  <svg {...base(p)}>
    <circle cx="6" cy="5.5" r="2.5" />
    <path d="M1.5 13.5a4.5 4.5 0 019 0M10.5 3.5a2.5 2.5 0 010 4M12 9.5a4 4 0 012.5 4" />
  </svg>
);
export const IconProjects = (p: P) => (
  <svg {...base(p)}>
    <path d="M2 4.5h4l1.5 1.5H14v8H2z" />
  </svg>
);
export const IconClock = (p: P) => (
  <svg {...base(p)}>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 4.5V8l2.5 1.5" />
  </svg>
);
export const IconInvoice = (p: P) => (
  <svg {...base(p)}>
    <path d="M3.5 1.5h9v13l-1.5-1-1.5 1-1.5-1-1.5 1-1.5-1-1.5 1z" />
    <path d="M6 5.5h4M6 8h4M6 10.5h2.5" />
  </svg>
);
export const IconPayment = (p: P) => (
  <svg {...base(p)}>
    <rect x="1.5" y="4" width="13" height="8.5" rx="1" />
    <path d="M1.5 7h13" />
  </svg>
);
export const IconExpense = (p: P) => (
  <svg {...base(p)}>
    <path d="M2.5 3.5h11v10h-11z" />
    <path d="M5 1.5v2M11 1.5v2M5.5 8h5M5.5 10.5h3" />
  </svg>
);
export const IconLedger = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 2v12h10" />
    <path d="M6 5.5h7M6 8.5h7M6 11.5h7" />
  </svg>
);
export const IconJournal = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 2.5h10v11H3z" />
    <path d="M6 2.5v11M8.5 5.5h2.5M8.5 8h2.5" />
  </svg>
);
export const IconReports = (p: P) => (
  <svg {...base(p)}>
    <path d="M2 13.5h12M3.5 11V7M7 11V3.5M10.5 11V6M14 11V8.5" />
  </svg>
);
export const IconSettings = (p: P) => (
  <svg {...base(p)}>
    <circle cx="8" cy="8" r="2.5" />
    <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" />
  </svg>
);
export const IconSearch = (p: P) => (
  <svg {...base(p)}>
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5l3.5 3.5" />
  </svg>
);
export const IconSun = (p: P) => (
  <svg {...base(p)}>
    <circle cx="8" cy="8" r="3" />
    <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" />
  </svg>
);
export const IconMoon = (p: P) => (
  <svg {...base(p)}>
    <path d="M13 10A6 6 0 016 3a6 6 0 107 7z" />
  </svg>
);
export const IconPlus = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 3v10M3 8h10" />
  </svg>
);
export const IconTrash = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 4.5h10M6.5 4.5v-2h3v2M4.5 4.5l.7 9h5.6l.7-9" />
  </svg>
);
export const IconPencil = (p: P) => (
  <svg {...base(p)}>
    <path d="M11 2.5l2.5 2.5-8 8H3v-2.5z" />
  </svg>
);
export const IconArrowUp = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 13V3M4 7l4-4 4 4" />
  </svg>
);
export const IconArrowDown = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 3v10M4 9l4 4 4-4" />
  </svg>
);
export const IconPrint = (p: P) => (
  <svg {...base(p)}>
    <path d="M4.5 6V2.5h7V6M3 6h10a1 1 0 011 1v4h-2.5v2.5h-7V11H2V7a1 1 0 011-1z" />
  </svg>
);
export const IconWorkspaces = (p: P) => (
  <svg {...base(p)}>
    <rect x="2" y="2" width="12" height="12" rx="2" />
    <path d="M2 6.5h12M6.5 6.5v7.5" />
  </svg>
);
export const BrandMark = (p: P) => (
  <svg viewBox="0 0 32 32" width={22} height={22} aria-hidden="true" {...p}>
    <path d="M6 9h20M6 15h20M6 21h20" stroke="var(--rule-strong)" strokeWidth="1" />
    <path
      d="M9 6v20h14"
      fill="none"
      stroke="var(--blue)"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M6 27h20" stroke="var(--red)" strokeWidth="2" />
  </svg>
);
