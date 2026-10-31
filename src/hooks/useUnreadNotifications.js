import { useQuery } from '@tanstack/react-query';
import api from '../api/axios';

export function useUnreadNotifications() {
  return useQuery({ queryKey: ['notifications', 'unread-count'], queryFn: async ({ signal }) => (await api.get('/notifications/unread-count', { signal })).data, refetchInterval: 30000, refetchOnWindowFocus: true });
}
