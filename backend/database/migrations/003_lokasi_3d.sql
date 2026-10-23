-- Additive and repeatable. Architectural anchors start unlinked; no posts invented.
create table if not exists tbl_lokasi_3d (
  id_lokasi serial primary key,
  hotspot_id varchar(80) not null unique check (hotspot_id in (
    'HOTSPOT_MAIN_ENTRANCE','HOTSPOT_CENTRAL_BLOCK','HOTSPOT_LEFT_WING',
    'HOTSPOT_RIGHT_WING','HOTSPOT_FRONT_PLAZA','HOTSPOT_LEFT_TOWER','HOTSPOT_RIGHT_TOWER')),
  nama_paparan varchar(120) not null,
  kawasan varchar(120) not null,
  label_aras varchar(80),
  id_pos integer references tbl_pos_kawalan(id_pos) on delete set null,
  status_aktif boolean not null default true,
  tarikh_dicipta timestamptz not null default now(),
  tarikh_kemaskini timestamptz not null default now()
);
insert into tbl_lokasi_3d (hotspot_id,nama_paparan,kawasan) values
('HOTSPOT_MAIN_ENTRANCE','Pintu Masuk Utama','Pintu masuk'),
('HOTSPOT_CENTRAL_BLOCK','Blok Tengah','Blok utama'),
('HOTSPOT_LEFT_WING','Sayap Kiri','Sayap kiri'),
('HOTSPOT_RIGHT_WING','Sayap Kanan','Sayap kanan'),
('HOTSPOT_FRONT_PLAZA','Plaza Hadapan','Kawasan luar'),
('HOTSPOT_LEFT_TOWER','Menara Kiri','Menara fasad'),
('HOTSPOT_RIGHT_TOWER','Menara Kanan','Menara fasad')
on conflict (hotspot_id) do nothing;
create index if not exists idx_lokasi_3d_pos on tbl_lokasi_3d(id_pos);
create index if not exists idx_3d_jadual_pos_date on tbl_jadual_bertugas(id_pos,tarikh_tugas);
create index if not exists idx_3d_laporan_pos_date on tbl_laporan_harian(id_pos,tarikh_laporan);
create index if not exists idx_3d_nlp_latest on tbl_hasil_nlp(id_laporan,tarikh_analisis desc,id_nlp desc);
create index if not exists idx_3d_progress_latest on tbl_progress_tindakan(id_tindakan,tarikh_progress desc,id_progress desc);
