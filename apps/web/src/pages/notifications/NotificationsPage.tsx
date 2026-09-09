import { useNavigate } from 'react-router-dom';
import { formatDateTime, labelFor, NOTIFICATION_KINDS, pluralize } from '@ledgerline/shared';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '../../api/notifications';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Checkbox } from '../../components/Checkbox';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { PageHeader } from '../../components/PageHeader';
import { Pagination } from '../../components/Pagination';
import { SkeletonRows } from '../../components/Skeleton';
import { useQueryParams } from '../../hooks/useQueryParams';
import { useWorkspace } from '../../hooks/useWorkspace';
import { cx } from '../../lib/cx';

const DEFAULTS = { unread: false, page: 1, pageSize: 25 };

export function NotificationsPage() {
  const { base } = useWorkspace();
  const navigate = useNavigate();
  const [params, setParams] = useQueryParams(DEFAULTS);
  const query = useNotifications({
    unread: params.unread || undefined,
    page: params.page,
    pageSize: params.pageSize,
  });
  const markOne = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const unread = query.data?.unreadCount ?? 0;

  const open = (n: { id: string; link: string; readAt: string | null }) => {
    if (!n.readAt) markOne.mutate(n.id);
    if (n.link) navigate(n.link.startsWith('/') ? n.link : `${base}/${n.link}`);
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={
          query.data ? `${pluralize(unread, 'unread')} · ${query.data.total} total` : undefined
        }
        crumbs={[{ label: 'Notifications' }]}
        actions={
          <Checkbox
            label="Unread only"
            checked={params.unread}
            onChange={(e) => setParams({ unread: e.target.checked })}
          />
        }
        primary={
          <Button
            onClick={() => markAll.mutate()}
            loading={markAll.isPending}
            disabled={unread === 0}
          >
            Mark all read
          </Button>
        }
      />
      {query.isLoading ? (
        <SkeletonRows rows={6} />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (query.data?.items ?? []).length === 0 ? (
        <EmptyState
          title={params.unread ? 'You’re all caught up' : 'No notifications yet'}
          description="Approvals, payments and overdue invoices will show up here."
        />
      ) : (
        <>
          <div className="paper">
            {(query.data?.items ?? []).map((n) => (
              <div key={n.id} className={cx('notif-row', !n.readAt && 'is-unread')}>
                <span className="notif-row__dot" aria-hidden="true" />
                <div style={{ minWidth: 0 }}>
                  <div className="notif-row__title">
                    <button
                      type="button"
                      className="notif-row__title"
                      style={{ textAlign: 'left', color: 'inherit' }}
                      onClick={() => open(n)}
                    >
                      {n.title}
                    </button>
                  </div>
                  {n.body ? <div className="notif-row__body">{n.body}</div> : null}
                  <div className="notif-row__meta">
                    <Badge>{labelFor(NOTIFICATION_KINDS, n.kind)}</Badge> ·{' '}
                    {formatDateTime(n.createdAt)}
                  </div>
                </div>
                <div className="row">
                  {!n.readAt ? (
                    <Button size="sm" variant="ghost" onClick={() => markOne.mutate(n.id)}>
                      Mark read
                    </Button>
                  ) : null}
                  {n.link ? (
                    <Button size="sm" onClick={() => open(n)}>
                      Open
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          <Pagination
            page={params.page}
            pageSize={params.pageSize}
            total={query.data?.total ?? 0}
            onPageChange={(page) => setParams({ page })}
          />
        </>
      )}
    </>
  );
}
