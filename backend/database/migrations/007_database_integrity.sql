-- No rows are deleted. Unknown invalid legacy values cause the whole transaction to roll back.
-- This older label has the same meaning as the application's current in-progress state.
-- Preserve operational dates and IDs; record every label change in the audit trail.
with normalized as (
  update tbl_tindakan_susulan set status_tindakan='Dalam Tindakan'
  where status_tindakan='Dalam Proses' returning id_tindakan
)
insert into tbl_audit_trail(modul_sistem,jenis_aktiviti,penerangan_aktiviti,rekod_terlibat,nilai_lama,nilai_baharu,status_aktiviti)
select 'Database migration','NORMALIZE_ACTION_STATUS','007: Seragamkan label status tindakan lama',
  'Tindakan #'||id_tindakan,'Dalam Proses','Dalam Tindakan','Berjaya' from normalized;
-- New reports without an analysis must not implicitly claim Low risk.
alter table tbl_laporan_harian alter column tahap_risiko set default 'Unknown';
do $migration$
declare item record;
begin
  for item in select * from (values
    ('tbl_pengguna','ck_penjaga_user_status', $$status_akaun in ('Aktif','Tidak Aktif')$$),
    ('tbl_pos_kawalan','ck_penjaga_post_status', $$status_pos in ('Aktif','Tidak Aktif')$$),
    ('tbl_laporan_harian','ck_penjaga_report_status', $$status_laporan in ('Dihantar','Diluluskan','Ditolak')$$),
    ('tbl_laporan_harian','ck_penjaga_report_shift', $$syif in ('Pagi','Petang','Malam','Office Hour')$$),
    ('tbl_laporan_harian','ck_penjaga_report_risk', $$tahap_risiko in ('Low','Medium','High','Critical','Unknown')$$),
    ('tbl_hasil_nlp','ck_penjaga_nlp_risk', $$tahap_risiko in ('Low','Medium','High','Critical','Unknown')$$),
    ('tbl_hasil_nlp','ck_penjaga_nlp_confidence', $$tahap_keyakinan between 0 and 1$$),
    ('tbl_pengesahan_laporan','ck_penjaga_review_status', $$status_pengesahan in ('Diluluskan','Ditolak')$$),
    ('tbl_tindakan_susulan','ck_penjaga_action_status', $$status_tindakan in ('Baru','Dalam Tindakan','Selesai')$$),
    ('tbl_tindakan_susulan','ck_penjaga_action_priority', $$tahap_keutamaan in ('Low','Medium','High','Critical')$$),
    ('tbl_tindakan_susulan','ck_penjaga_action_dates', $$tarikh_selesai is null or tarikh_selesai >= tarikh_mula$$),
    ('tbl_jawapan_checklist','ck_penjaga_checklist_answer', $$jawapan in ('Ya','Tidak','Tidak Berkaitan')$$),
    ('tbl_jadual_mingguan','ck_penjaga_week_dates', $$tarikh_tamat >= tarikh_mula$$),
    ('tbl_jadual_mingguan','ck_penjaga_week_status', $$status_jadual in ('Draf','Disahkan','Dikunci')$$),
    ('tbl_jadual_bertugas','ck_penjaga_assignment_shift', $$syif in ('Pagi','Petang','Malam','Office Hour')$$),
    ('tbl_jadual_bertugas','ck_penjaga_assignment_times', $$masa_mula <> masa_tamat$$),
    ('tbl_keperluan_pos','ck_penjaga_requirement_count', $$bilangan_diperlukan >= 0$$),
    ('tbl_keperluan_pos','ck_penjaga_requirement_shift', $$syif in ('Pagi','Petang','Malam','Office Hour')$$),
    ('tbl_kehadiran_tugas','ck_penjaga_attendance_order', $$masa_check_out is null or (masa_check_in is not null and masa_check_out >= masa_check_in)$$),
    ('tbl_notifikasi','ck_penjaga_notification_status', $$status_bacaan in ('Belum Dibaca','Dibaca')$$)
  ) as checks(table_name,constraint_name,expression)
  loop
    if not exists(select 1 from pg_constraint where conrelid=to_regclass(item.table_name) and conname=item.constraint_name) then
      execute format('alter table %I add constraint %I check (%s) not valid',item.table_name,item.constraint_name,item.expression);
    end if;
    execute format('alter table %I validate constraint %I',item.table_name,item.constraint_name);
  end loop;
end $migration$;

-- The API accepts one final review and one answer per checklist/report.
create unique index if not exists uq_review_report on tbl_pengesahan_laporan(id_laporan);
create unique index if not exists uq_checklist_report_item on tbl_jawapan_checklist(id_laporan,id_checklist);

-- Complement the existing post/date and latest-NLP indexes with leading keys used by these queries.
create index if not exists idx_report_date_id on tbl_laporan_harian(tarikh_laporan desc,id_laporan desc);
create index if not exists idx_report_guard_date on tbl_laporan_harian(id_pengguna,tarikh_laporan desc,id_laporan desc);
create index if not exists idx_report_pending_date on tbl_laporan_harian(tarikh_laporan,id_pos) where status_laporan='Dihantar';
create index if not exists idx_notification_user_date on tbl_notifikasi(id_pengguna,tarikh_hantar desc,id_notifikasi desc);
create index if not exists idx_notification_unread_user on tbl_notifikasi(id_pengguna,id_notifikasi) where status_bacaan='Belum Dibaca';
create index if not exists idx_assignment_date_post on tbl_jadual_bertugas(tarikh_tugas,id_pos);
create index if not exists idx_audit_user_time on tbl_audit_trail(id_pengguna,tarikh_masa_aktiviti desc,id_audit desc);
