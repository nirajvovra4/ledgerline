import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NotificationDto, Paginated } from '@ledgerline/shared';
import { api, wsPath, type QueryParams } from './client';
import { notificationKeys } from './keys';
import { useSlug } from './slug';

export interface NotificationListParams extends QueryParams {
  unread?: boolean;
  page?: number;
  pageSize?: number;
}

export interface NotificationListResponse extends Paginated<NotificationDto> {
  unreadCount: number;
}

export function useNotifications(
  params: NotificationListParams = {},
  options: { enabled?: boolean; refetchInterval?: number } = {},
) {
  const slug = useSlug();
  return useQuery({
    queryKey: notificationKeys.list(slug, params),
    queryFn: () => api.get<NotificationListResponse>(wsPath(slug, '/notifications'), params),
    placeholderData: (prev) => prev,
    enabled: options.enabled ?? true,
    refetchInterval: options.refetchInterval,
  });
}

/** Lightweight unread badge for the rail. */
export function useUnreadCount() {
  const q = useNotifications({ unread: true, pageSize: 1 }, { refetchInterval: 60 * 1000 });
  return q.data?.unreadCount ?? 0;
}

export function useMarkNotificationRead() {
  const slug = useSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ notification: NotificationDto }>(wsPath(slug, `/notifications/${id}/read`)),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.all(slug) }),
  });
}

export function useMarkAllNotificationsRead() {
  const slug = useSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{ ok: true; updated: number }>(wsPath(slug, '/notifications/read-all')),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.all(slug) }),
  });
}
