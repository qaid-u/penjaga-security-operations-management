import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { notifySuccess } from '../../utils/helpers';

const configured = Number(import.meta.env.VITE_3D_REFRESH_MS ?? 60000);
const interval = configured === 0 ? false : Math.max(60000, Number.isFinite(configured) ? configured : 60000);
const settings = { staleTime: 30000, gcTime: 60000, refetchInterval: interval, refetchIntervalInBackground: false, retry: (count, error) => count < 1 && ![400,401,403,404].includes(error.response?.status) };
export function use3DOperations(hotspot, period, filters = {}, mode = 'mapping', page = 1) {
  const { user } = useAuth();
  const scope = ['threeD', user?.id_pengguna, user?.nama_peranan];
  const params = { ...period, zone: filters.zone || '', post: filters.post || '', mapping: filters.mapping || 'all',
    ...(mode === 'incidents' || mode === 'followup' ? { risk: filters.risk || '', category: filters.category || '', report_status: filters.report_status || '', action_status: filters.action_status || '' } : {}) };
  const overview = useQuery({ ...settings, queryKey: [...scope, 'overview', mode, params], queryFn: ({ signal }) => api.get('/3d/overview', { params, signal }).then((r) => r.data) });
  const references = useQuery({ ...settings, staleTime: 300000, refetchInterval: false, queryKey: [...scope, 'filters'], queryFn: ({ signal }) => api.get('/3d/filters', { signal }).then((r) => r.data) });
  const location = overview.data?.locations.find((item) => item.hotspot_id === hotspot);
  const summary = useQuery({ ...settings, queryKey: [...scope, 'summary', location?.id_lokasi, location?.id_pos, location?.tarikh_kemaskini, mode, params], enabled: Boolean(location && hotspot), queryFn: ({ signal }) => api.get(`/3d/locations/${location.id_lokasi}/summary`, { params, signal }).then((r) => r.data) });
  const incidents = useQuery({ ...settings, queryKey: [...scope, 'incidents', mode, params, page, overview.data?.locations.map((l) => [l.id_lokasi,l.id_pos,l.tarikh_kemaskini])], enabled: mode === 'incidents' || mode === 'followup', queryFn: ({ signal }) => api.get('/3d/incidents', { params: { ...params, page, limit: 20 }, signal }).then((r) => r.data) });
  return { overview, summary, location, references, incidents, refresh: () => { overview.refetch(); references.refetch(); if (location) summary.refetch(); if (mode === 'incidents' || mode === 'followup') incidents.refetch(); } };
}
export function use3DMapping() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ id, post }) => api.patch(`/3d/locations/${id}/mapping`, { id_pos: post }), onSuccess: () => { notifySuccess('Pautan disimpan dan direkodkan dalam audit.'); return client.invalidateQueries({ queryKey: ['threeD'] }); } });
}
