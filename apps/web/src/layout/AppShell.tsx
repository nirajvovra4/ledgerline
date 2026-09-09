import { Suspense, type ReactNode } from 'react';
import { SkeletonRows } from '../components/Skeleton';
import { Rail } from './Rail';
import { Strip } from './Strip';
import { StripProvider } from './StripContext';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <StripProvider>
      <div className="shell">
        <Rail />
        <Strip />
        <main className="content" id="main">
          <div className="content__inner">
            <Suspense fallback={<SkeletonRows rows={6} />}>{children}</Suspense>
          </div>
        </main>
      </div>
    </StripProvider>
  );
}
