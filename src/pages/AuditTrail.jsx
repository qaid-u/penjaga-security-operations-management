import { PeriodControls } from '../components/PeriodControls';
import { ExportButton } from '../components/ExportButton';
import { useMemo, useState, useEffect } from 'react';
import { Filter, History } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/axios';
import { monthLabel, recentMonthOptions } from '../utils/helpers';
import { Card, Button, AlertMessage, Field, Input, Select, EmptyState, Pagination, LoadingState } from '../components/ui';

export function AuditTrail() {
  const [meta, setMeta] = useState({ roles: [], posts: [] });
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({ user: '', role: '', pos: '', module: '', activity: '', dateMode: 'all', date: '', month: '', year: '', status: '' });
  const [periodReset,setPeriodReset] = useState(0);
  const [page, setPage] = useState(1);
  const auditMonthOptions = useMemo(() => recentMonthOptions(36), []);

  useEffect(() => {
    Promise.all([api.get('/meta'), api.get('/users')]).then(([m, u]) => {
      setMeta(m.data);
      setUsers(u.data);
    }).catch(() => { /* The log and export remain available if filter options fail. */ });
  }, []);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['audit', { ...filters, page }],
    queryFn: async () => {
      const res = await api.get('/audit', { params: { ...filters, page, limit: 8 } });
      return res.data;
    },

  });

  const handleFilterChange = (key, value) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'dateMode') {
        delete next.from; delete next.to;
        next.date = '';
        next.month = '';
        next.year = '';
      }
      return next;
    });
    setPage(1);
  };

  const resetFilters = () => {
    setPeriodReset(value=>value+1);
    setFilters({ user: '', role: '', pos: '', module: '', activity: '', dateMode: 'all', date: '', month: '', year: '', status: '' });
    setPage(1);
  };

  const rows = data?.data || [];
  const totalPages = data?.meta?.totalPages || 1;

  return (
    <div className="desktop-ops">
      <Card title="Audit Trail" action={<ExportButton endpoint="/audit" filename="audit-trail.csv" filters={filters}/>}>
        <p className="mb-4 workspace-note"><History size={15} className="inline mr-2"/>Semak aktiviti sistem atau eksport rekod mengikut minggu, bulan dan tahun.</p>
        <PeriodControls key={periodReset} onChange={range=>{setFilters(current=>({...current,...range,from:range.from,to:range.to,dateMode:'all',date:'',month:'',year:''}));setPage(1);}}/><details className="workspace-disclosure mb-4"><summary><Filter size={15} className="inline mr-2"/>Tapis rekod audit</summary><div className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Field label="Pengguna"><Select value={filters.user} onChange={(e) => handleFilterChange('user', e.target.value)}><option value="">Semua pengguna</option>{users.map((user) => <option key={user.id_pengguna} value={user.nama_penuh}>{user.nama_penuh}</option>)}</Select></Field>
              <Field label="Peranan"><Select value={filters.role} onChange={(e) => handleFilterChange('role', e.target.value)}><option value="">Semua peranan</option>{meta.roles.map((role) => <option key={role.id_peranan} value={role.nama_peranan}>{role.nama_peranan}</option>)}</Select></Field>
              <Field label="Pos"><Select value={filters.pos} onChange={(e) => handleFilterChange('pos', e.target.value)}><option value="">Semua pos</option>{meta.posts.map((post) => <option key={post.id_pos} value={post.nama_pos}>{post.nama_pos}</option>)}</Select></Field>
            </div>
            <Button type="button" variant="ghost" className="self-end" onClick={resetFilters}>Reset tapisan</Button>
          </div>
          <div className="grid gap-3 border-t pt-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_minmax(260px,1.3fr)_180px]">
            <Field label="Modul"><Input placeholder="Contoh: Laporan Harian" value={filters.module} onChange={(e) => handleFilterChange('module', e.target.value)} /></Field>
            <Field label="Aktiviti / penerangan"><Input placeholder="Cari aktiviti atau penerangan audit" value={filters.activity} onChange={(e) => handleFilterChange('activity', e.target.value)} /></Field>
            <Field label="Status"><Select value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)}><option value="">Semua status</option><option>Berjaya</option><option>Gagal</option></Select></Field>
          </div>
          <div className="grid gap-3 border-t pt-3 sm:grid-cols-2 lg:grid-cols-[220px_minmax(220px,320px)]">
            <Field label="Tempoh audit"><Select value={filters.dateMode} onChange={(e) => handleFilterChange('dateMode', e.target.value)}><option value="all">Semua masa</option><option value="date">Tarikh tepat</option><option value="month">Bulan</option><option value="year">Tahun</option></Select></Field>
            {filters.dateMode === 'date' && <Field label="Pilih tarikh"><Input type="date" value={filters.date} onChange={(e) => handleFilterChange('date', e.target.value)} /></Field>}
            {filters.dateMode === 'month' && <Field label="Pilih bulan"><Select value={filters.month} onChange={(e) => handleFilterChange('month', e.target.value)}><option value="">Semua bulan</option>{auditMonthOptions.map((month) => <option key={month} value={month}>{monthLabel(month)}</option>)}</Select></Field>}
            {filters.dateMode === 'year' && <Field label="Pilih tahun"><Input type="number" min="2020" max="2100" placeholder="Contoh: 2026" value={filters.year} onChange={(e) => handleFilterChange('year', e.target.value)} /></Field>}
          </div>
        </div></details>
        
        {isError && <AlertMessage>Rekod audit belum dapat dimuatkan. <button type="button" onClick={()=>refetch()} className="underline">Cuba lagi</button></AlertMessage>}
        {isLoading ? (
          <LoadingState message="Memuatkan audit trail..." />
        ) : (
          <>
            <p className="mb-3 text-sm text-secondary-token">{data?.meta?.total || 0} rekod dijumpai. Memaparkan muka surat {page} daripada {totalPages}.</p>
            <div className="space-y-3 md:hidden">
              {rows.length ? rows.map((r) => (
                <div key={r.id_audit} className="app-row rounded-md border p-3 text-sm">
                  <p className="text-data">{new Date(r.tarikh_masa_aktiviti || r.tarikh_tindakan).toLocaleString()}</p>
                  <p className="font-medium text-primary-token">{r.jenis_aktiviti || r.tindakan}</p>
                  <p>{r.modul_sistem || r.sasaran_sumber} - {r.status_aktiviti || r.status_tindakan}</p>
                  <p>{r.nama_penuh || '-'} - {r.nama_peranan || '-'}</p>
                </div>
              )) : <EmptyState title="Tiada audit" description="Log audit akan dipaparkan selepas aktiviti sistem." />}
            </div>
            <div className="desktop-table-scroll hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="app-divider border-b">
                    <th className="py-2">Masa</th>
                    <th>User</th>
                    <th>Role</th>
                    <th>Aktiviti</th>
                    <th>Modul</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id_audit} className="app-divider border-b">
                      <td className="text-data py-2">{new Date(r.tarikh_masa_aktiviti || r.tarikh_tindakan).toLocaleString()}</td>
                      <td>{r.nama_penuh || '-'}</td>
                      <td>{r.nama_peranan || '-'}</td>
                      <td>{r.jenis_aktiviti || r.tindakan}</td>
                      <td>{r.modul_sistem || r.sasaran_sumber}</td>
                      <td>{r.status_aktiviti || r.status_tindakan}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length && <div className="mt-4"><EmptyState title="Tiada audit" description="Log audit akan dipaparkan selepas aktiviti sistem." /></div>}
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
