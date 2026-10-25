-- Minimal fresh-install reference data. Contains no users, passwords or operational records.
insert into tbl_peranan (nama_peranan, tahap_capaian)
values ('Pentadbir Sistem', 1), ('Ketua Pengawal', 2), ('Pengawal Keselamatan', 3)
on conflict (nama_peranan) do nothing;
