import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Crumb } from '../components/Breadcrumbs';

export interface StripState {
  title: string;
  crumbs: Crumb[];
  primary?: ReactNode;
}

interface StripApi {
  state: StripState | null;
  set: (state: StripState | null) => void;
}

const StripContext = createContext<StripApi | null>(null);

export function StripProvider({ children }: { children: ReactNode }) {
  const [state, set] = useState<StripState | null>(null);
  const value = useMemo(() => ({ state, set }), [state]);
  return <StripContext.Provider value={value}>{children}</StripContext.Provider>;
}

export function useStrip(): StripApi | null {
  return useContext(StripContext);
}
