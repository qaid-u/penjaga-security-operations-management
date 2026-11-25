import { useQuery } from '@tanstack/react-query';
import api from '../api/axios';
import { Card, AlertMessage } from './ui';

const LABELS = {
  LOGIN_FAILED: 'Log masuk gagal',
  LOGIN_BLOCKED: 'Akaun disekat',
  LOGIN_RATE_LIMITED: 'Had percubaan dicapai',
  ACCESS_DENIED: 'Akses ditolak',
};

export function SecuritySummary() {
  const { data } = useQuery({
    queryKey: ['audit', 'security-summary'],
    queryFn: async () => (await api.get('/audit/security-summary')).data,
    refetchInterval: 60_000,
  });
  if (!data?.totals) return null;

  return (
    <Card title="Pemantauan Keselamatan (24 jam lalu)">
      {data.alert && <AlertMessage>Aktiviti mencurigakan dikesan. Semak rekod audit dan alamat IP di bawah.</AlertMessage>}
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Object.entries(LABELS).map(([key, label]) => (
          <div key={key} className="app-row rounded-md border p-3">
            <dt className="text-xs text-secondary-token">{label}</dt>
            <dd className="text-data text-2xl text-primary-token">{data.totals[key] || 0}</dd>
          </div>
        ))}
      </dl>
      {data.sources?.length > 0 && (
        <p className="mt-3 text-sm text-secondary-token">
          Alamat IP dengan kegagalan terbanyak: {data.sources.map((source) => `${source.alamat_ip} (${source.total})`).join(', ')}
        </p>
      )}
    </Card>
  );
}
