drop table if exists tbl_audit_trail, tbl_notifikasi, tbl_fail_jadual, tbl_kehadiran_tugas, tbl_jadual_bertugas, tbl_jadual_mingguan, tbl_keperluan_pos, tbl_status_bertugas, tbl_jawapan_checklist, tbl_checklist, tbl_progress_tindakan, tbl_tindakan_susulan, tbl_pengesahan_laporan, tbl_hasil_nlp, tbl_laporan_harian, tbl_kategori_insiden, tbl_pos_kawalan, tbl_pengguna, tbl_peranan cascade;

create table tbl_peranan (
  id_peranan serial primary key,
  nama_peranan varchar(80) unique not null,
  keterangan_peranan text,
  tahap_capaian int not null,
  tarikh_dicipta timestamp not null default now()
);

create table tbl_pengguna (
  id_pengguna serial primary key,
  id_peranan int not null references tbl_peranan(id_peranan),
  nama_penuh varchar(120) not null,
  no_kad_pengenalan varchar(20),
  no_telefon varchar(30),
  emel varchar(120) unique not null,
  nama_pengguna varchar(60) unique not null,
  kata_laluan text not null,
  status_akaun varchar(20) not null default 'Aktif',
  tarikh_dicipta timestamp not null default now(),
  tarikh_kemaskini timestamp not null default now()
);

create table tbl_pos_kawalan (
  id_pos serial primary key,
  nama_pos varchar(120) not null,
  nama_bangunan varchar(120),
  lokasi text,
  waktu_operasi varchar(80),
  status_pos varchar(20) not null default 'Aktif',
  tarikh_dicipta timestamp not null default now()
);

create table tbl_kategori_insiden (
  id_kategori_insiden serial primary key,
  nama_kategori varchar(100) unique not null,
  tahap_keutamaan varchar(20) not null,
  penerangan_kategori text,
  kata_kunci_rujukan text[],
  status_kategori varchar(20) not null default 'Aktif',
  tarikh_dicipta timestamp not null default now()
);

create table tbl_laporan_harian (
  id_laporan serial primary key,
  id_pengguna int not null references tbl_pengguna(id_pengguna),
  id_pos int not null references tbl_pos_kawalan(id_pos),
  id_kategori_insiden int references tbl_kategori_insiden(id_kategori_insiden),
  tajuk_laporan varchar(160) not null,
  syif varchar(30) not null,
  tarikh_laporan date not null,
  masa_laporan time not null,
  kandungan_laporan text not null,
  status_laporan varchar(30) not null default 'Dihantar',
  tahap_risiko varchar(20) not null default 'Low',
  perlu_tindakan_susulan boolean not null default false,
  lampiran_fail text,
  tarikh_dicipta timestamp not null default now(),
  tarikh_kemaskini timestamp not null default now()
);

create table tbl_hasil_nlp (
  id_nlp serial primary key,
  id_laporan int not null references tbl_laporan_harian(id_laporan) on delete cascade,
  teks_diproses text not null,
  kata_kunci_dikesan text[] not null default '{}',
  kategori_dikesan varchar(100) not null,
  skor_sentimen numeric(4,2) not null default 0,
  skor_risiko int not null check (skor_risiko between 0 and 100),
  tahap_risiko varchar(20) not null,
  ringkasan_automatik text,
  tahap_keyakinan numeric(4,2) not null default 0,
  tarikh_analisis timestamp not null default now()
);

create table tbl_pengesahan_laporan (
  id_pengesahan serial primary key,
  id_laporan int not null references tbl_laporan_harian(id_laporan) on delete cascade,
  id_pengguna_pengesah int not null references tbl_pengguna(id_pengguna),
  status_pengesahan varchar(30) not null,
  catatan_pengesahan text,
  tarikh_pengesahan timestamp not null default now()
);

create table tbl_tindakan_susulan (
  id_tindakan serial primary key,
  id_laporan int not null references tbl_laporan_harian(id_laporan) on delete cascade,
  pegawai_bertanggungjawab varchar(120) not null,
  tindakan_diambil text not null,
  status_tindakan varchar(30) not null default 'Baru',
  tahap_keutamaan varchar(20) not null default 'Medium',
  tarikh_mula date not null default current_date,
  tarikh_selesai date,
  catatan_tindakan text,
  tarikh_kemaskini timestamp not null default now()
);

create table tbl_progress_tindakan (
  id_progress serial primary key,
  id_tindakan int not null references tbl_tindakan_susulan(id_tindakan) on delete cascade,
  id_pengguna int not null references tbl_pengguna(id_pengguna),
  catatan_progress text not null,
  jenis_progress varchar(40) not null default 'Kemaskini Ketua',
  perlu_respon_ketua boolean not null default false,
  lampiran_fail text,
  tarikh_progress timestamp not null default now(),
  dilihat_admin boolean not null default false
);

create table tbl_checklist (
  id_checklist serial primary key,
  nama_checklist varchar(160) not null,
  penerangan_checklist text,
  kategori_checklist varchar(80),
  status_aktif boolean not null default true,
  tarikh_dicipta timestamp not null default now()
);

create table tbl_jawapan_checklist (
  id_jawapan serial primary key,
  id_laporan int not null references tbl_laporan_harian(id_laporan) on delete cascade,
  id_checklist int not null references tbl_checklist(id_checklist),
  jawapan varchar(30) not null,
  catatan text,
  tarikh_jawapan timestamp not null default now()
);

create table tbl_status_bertugas (
  id_status serial primary key,
  id_pengguna int not null references tbl_pengguna(id_pengguna),
  id_pos int not null references tbl_pos_kawalan(id_pos),
  tarikh date not null,
  syif varchar(30) not null,
  status_bertugas varchar(30) not null,
  masa_mula time,
  masa_tamat time,
  tarikh_kemaskini timestamp not null default now()
);

create table tbl_jadual_mingguan (
  id_jadual_mingguan serial primary key,
  tarikh_mula date not null,
  tarikh_tamat date not null,
  tajuk_jadual varchar(150),
  status_jadual varchar(30) not null default 'Draf',
  dicipta_oleh int references tbl_pengguna(id_pengguna),
  disahkan_oleh int references tbl_pengguna(id_pengguna),
  tarikh_dicipta timestamp not null default now(),
  tarikh_disahkan timestamp,
  catatan text
);

create table tbl_jadual_bertugas (
  id_jadual serial primary key,
  id_jadual_mingguan int not null references tbl_jadual_mingguan(id_jadual_mingguan) on delete cascade,
  id_pengguna int not null references tbl_pengguna(id_pengguna),
  id_pos int not null references tbl_pos_kawalan(id_pos),
  tarikh_tugas date not null,
  syif varchar(30) not null,
  masa_mula time not null,
  masa_tamat time not null,
  status_bertugas varchar(30) not null default 'Dijadualkan',
  catatan text,
  dicipta_oleh int references tbl_pengguna(id_pengguna),
  tarikh_dicipta timestamp not null default now(),
  tarikh_kemaskini timestamp not null default now()
);

create table tbl_keperluan_pos (
  id_keperluan serial primary key,
  id_pos int not null references tbl_pos_kawalan(id_pos) on delete cascade,
  syif varchar(30) not null,
  bilangan_diperlukan int not null default 1,
  status_aktif boolean not null default true,
  tarikh_dicipta timestamp not null default now(),
  unique(id_pos, syif)
);

create table tbl_kehadiran_tugas (
  id_kehadiran serial primary key,
  id_jadual int not null references tbl_jadual_bertugas(id_jadual) on delete cascade,
  id_pengguna int not null references tbl_pengguna(id_pengguna),
  masa_check_in timestamp,
  masa_check_out timestamp,
  status_kehadiran varchar(30) not null default 'Belum Hadir',
  catatan text,
  tarikh_dicipta timestamp not null default now()
);

create table tbl_fail_jadual (
  id_fail serial primary key,
  id_jadual_mingguan int not null references tbl_jadual_mingguan(id_jadual_mingguan) on delete cascade,
  nama_fail varchar(255),
  jenis_fail varchar(30),
  path_fail text,
  dimuat_naik_oleh int references tbl_pengguna(id_pengguna),
  tarikh_muat_naik timestamp not null default now()
);

create table tbl_notifikasi (
  id_notifikasi serial primary key,
  id_pengguna int not null references tbl_pengguna(id_pengguna),
  id_laporan int references tbl_laporan_harian(id_laporan) on delete set null,
  id_tindakan int references tbl_tindakan_susulan(id_tindakan) on delete set null,
  tajuk_notifikasi varchar(160) not null,
  mesej_notifikasi text not null,
  jenis_notifikasi varchar(80) not null,
  tahap_keutamaan varchar(20) not null,
  status_bacaan varchar(20) not null default 'Belum Dibaca',
  tarikh_hantar timestamp not null default now(),
  tarikh_dibaca timestamp
);

create table tbl_audit_trail (
  id_audit serial primary key,
  id_pengguna int references tbl_pengguna(id_pengguna),
  modul_sistem varchar(100) not null,
  jenis_aktiviti varchar(100) not null,
  penerangan_aktiviti text not null,
  rekod_terlibat varchar(80),
  nilai_lama text,
  nilai_baharu text,
  alamat_ip varchar(80),
  peranti_pengguna text,
  status_aktiviti varchar(30) not null,
  tarikh_masa_aktiviti timestamp not null default now()
);

create index idx_laporan_status on tbl_laporan_harian(status_laporan);
create index idx_laporan_risiko on tbl_laporan_harian(tahap_risiko);
create index idx_audit_time on tbl_audit_trail(tarikh_masa_aktiviti desc);
create index idx_jadual_mingguan_dates on tbl_jadual_mingguan(tarikh_mula, tarikh_tamat);
create index idx_jadual_bertugas_week on tbl_jadual_bertugas(id_jadual_mingguan);
create index idx_jadual_bertugas_guard_time on tbl_jadual_bertugas(id_pengguna, tarikh_tugas, masa_mula, masa_tamat);
