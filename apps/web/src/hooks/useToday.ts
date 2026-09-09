import type { IsoDate } from '@ledgerline/shared';
import { useMeta } from '../api/meta';
import { browserToday } from '../lib/dates';

/** The server's business date. Falls back to the browser clock only while /api/meta loads. */
export function useToday(): IsoDate {
  const meta = useMeta();
  return meta.data?.today ?? browserToday();
}
