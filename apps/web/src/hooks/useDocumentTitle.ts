import { useEffect } from 'react';

export function useDocumentTitle(title: string | undefined): void {
  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = `${title} · Ledgerline`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
