import { formatDateTime, type ActivityDto, type Tone } from '@ledgerline/shared';
import type { TimelineItem } from '../components/Timeline';

const TONE_BY_ACTION: Array<[RegExp, Tone]> = [
  [/reject|void|delete|overdue|remove/i, 'negative'],
  [/approve|paid|payment|accept/i, 'positive'],
  [/submit|pending|invite/i, 'warning'],
  [/send|sent|create|post/i, 'info'],
];

export function toneForAction(action: string): Tone {
  for (const [re, tone] of TONE_BY_ACTION) if (re.test(action)) return tone;
  return 'neutral';
}

export function activityToTimeline(items: ActivityDto[]): TimelineItem[] {
  return items.map((a) => ({
    key: a.id,
    title: a.summary,
    meta: `${a.actorName} · ${formatDateTime(a.createdAt)}`,
    tone: toneForAction(a.action),
    body: typeof a.meta.comment === 'string' && a.meta.comment ? `“${a.meta.comment}”` : undefined,
  }));
}
