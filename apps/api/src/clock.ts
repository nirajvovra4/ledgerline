import { isoDateTimeAt, toIsoDate, type IsoDate, type IsoDateTime } from '@ledgerline/shared';

/**
 * Source of "now" for the whole API. Business logic never calls `Date.now()` directly, which is
 * what makes `LEDGERLINE_TODAY` demos and the test-suite deterministic.
 */
export interface Clock {
  today(): IsoDate;
  now(): IsoDateTime;
  /** True when the date is pinned rather than following the wall clock. */
  readonly fixed: boolean;
}

export class SystemClock implements Clock {
  readonly fixed = false;
  today(): IsoDate {
    return toIsoDate(new Date());
  }
  now(): IsoDateTime {
    return new Date().toISOString();
  }
}

/** A clock pinned to one calendar date; `now()` is that date at noon UTC. */
export class FixedClock implements Clock {
  readonly fixed = true;
  constructor(private readonly date: IsoDate) {}
  today(): IsoDate {
    return this.date;
  }
  now(): IsoDateTime {
    return isoDateTimeAt(this.date, 12, 0);
  }
}

/**
 * A clock the seed script can move forwards so that created-at timestamps and activity history
 * spread realistically over the demo period.
 */
export class MutableClock implements Clock {
  readonly fixed = true;
  private current: IsoDateTime;

  constructor(initial: IsoDate) {
    this.current = isoDateTimeAt(initial, 9, 0);
  }

  today(): IsoDate {
    return this.current.slice(0, 10);
  }

  now(): IsoDateTime {
    return this.current;
  }

  /** Move to `date` at the given UTC time. */
  set(date: IsoDate, hour = 9, minute = 0): void {
    this.current = isoDateTimeAt(date, hour, minute);
  }

  /** Advance by a number of minutes so consecutive events keep a stable order. */
  tick(minutes = 1): void {
    this.current = new Date(new Date(this.current).getTime() + minutes * 60_000).toISOString();
  }
}

export function createClock(fixedToday: string | null): Clock {
  return fixedToday ? new FixedClock(fixedToday) : new SystemClock();
}
