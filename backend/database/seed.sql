insert into tbl_peranan (nama_peranan, keterangan_peranan, tahap_capaian) values
('Pentadbir Sistem', 'Mengurus pengguna, peranan, pos kawalan, audit trail dan dashboard', 3),
('Ketua Pengawal', 'Menyemak laporan, melihat analisis NLP dan mengurus tindakan susulan', 2),
('Pengawal Keselamatan', 'Menghantar laporan harian dan checklist bertugas', 1);

insert into tbl_pengguna (id_peranan, nama_penuh, no_kad_pengenalan, no_telefon, emel, nama_pengguna, kata_laluan, status_akaun) values
(1, 'Admin PENJAGA', '900101010001', '012-1000001', 'admin@penjaga.local', 'admin', '$2b$10$9Lo0uAtINIJStdbyFpxxN.pbdkklKScVMsUbFYxlIdG1iMGKsxyDi', 'Aktif'),
(2, 'Ketua Pengawal Rahman', '850202020002', '012-2000002', 'ketua@penjaga.local', 'ketua', '$2b$10$9Lo0uAtINIJStdbyFpxxN.pbdkklKScVMsUbFYxlIdG1iMGKsxyDi', 'Aktif'),
(3, 'Pengawal Amir', '970303030003', '012-3000003', 'amir@penjaga.local', 'amir', '$2b$10$9Lo0uAtINIJStdbyFpxxN.pbdkklKScVMsUbFYxlIdG1iMGKsxyDi', 'Aktif'),
(3, 'Pengawal Siti', '980404040004', '012-3000004', 'siti@penjaga.local', 'siti', '$2b$10$9Lo0uAtINIJStdbyFpxxN.pbdkklKScVMsUbFYxlIdG1iMGKsxyDi', 'Aktif'),
(3, 'Pengawal Kumar', '990505050005', '012-3000005', 'kumar@penjaga.local', 'kumar', '$2b$10$9Lo0uAtINIJStdbyFpxxN.pbdkklKScVMsUbFYxlIdG1iMGKsxyDi', 'Aktif');

insert into tbl_pos_kawalan (nama_pos, nama_bangunan, lokasi, waktu_operasi, status_pos) values
('Pos Lobi Utama', 'Bangunan Sultan Ismail', 'Lobi utama', '24 Jam', 'Aktif'),
('Pos Bilik Kawalan CCTV', 'Bangunan Sultan Ismail', 'Bilik kawalan keselamatan', '24 Jam', 'Aktif'),
('Pos Tingkat 3 Pejabat Setiausaha Kerajaan Johor', 'Bangunan Sultan Ismail', 'Tingkat 3', '07:00-19:00', 'Aktif'),
('Pos Tingkat 4 Hadapan Pejabat Menteri Besar Johor', 'Bangunan Sultan Ismail', 'Tingkat 4', '07:00-19:00', 'Aktif'),
('Pos Lif LG', 'Bangunan Sultan Ismail', 'Lif aras LG', '24 Jam', 'Aktif'),
('Pos BDARA', 'Kompleks BDARA', 'Pintu masuk BDARA', '24 Jam', 'Aktif'),
('Pos BDMSP', 'Kompleks BDMSP', 'Pintu masuk BDMSP', '24 Jam', 'Aktif'),
('Pos BDMIM', 'Kompleks BDMIM', 'Pintu masuk BDMIM', '24 Jam', 'Aktif'),
('Pos UTC', 'UTC Johor', 'Lobi UTC', '08:00-22:00', 'Aktif');

insert into tbl_kategori_insiden (nama_kategori, tahap_keutamaan, penerangan_kategori, kata_kunci_rujukan) values
('Pencerobohan', 'High', 'Individu memasuki kawasan tanpa kebenaran', array['pencerobohan','ceroboh','orang asing','masuk tanpa izin']),
('Kebakaran', 'Critical', 'Asap, api atau kebakaran di kawasan pemantauan', array['kebakaran','asap','api','terbakar']),
('Pergaduhan', 'High', 'Pergaduhan atau kekecohan melibatkan individu', array['pergaduhan','gaduh','kekecohan']),
('Kehilangan Aset', 'High', 'Kehilangan, kecurian atau aset dicuri', array['kehilangan','hilang','curi','dicuri']),
('Vandalisme', 'Medium', 'Kerosakan sengaja atau contengan harta benda', array['vandalisme','rosak','pecah','conteng']),
('Keselamatan Fizikal', 'Medium', 'Pintu terbuka atau tidak berkunci', array['pintu terbuka','tidak berkunci']),
('Kerosakan Kemudahan', 'Medium', 'Lampu, CCTV, lif atau kemudahan rosak', array['lampu rosak','cctv rosak','lif rosak']),
('Rondaan Biasa', 'Low', 'Rondaan selesai dan keadaan terkawal', array['rondaan selesai','keadaan terkawal','tiada insiden']);

insert into tbl_checklist (nama_checklist, penerangan_checklist, kategori_checklist) values
('Rondaan kawasan selesai', 'Rondaan kawasan mengikut tugasan pos', 'Rondaan'),
('Pintu utama diperiksa', 'Pastikan pintu utama berkunci atau dikawal', 'Keselamatan Fizikal'),
('Lampu kawasan diperiksa', 'Semak lampu laluan dan kawasan gelap', 'Kemudahan'),
('CCTV diperiksa', 'Semak paparan CCTV utama', 'Peralatan'),
('Tiada individu mencurigakan', 'Pastikan tiada individu mencurigakan di kawasan pos', 'Rondaan'),
('Buku laporan dikemas kini', 'Rekod laporan dan pelawat lengkap', 'Pentadbiran'),
('Keadaan pos terkawal', 'Pastikan pos dalam keadaan terkawal', 'Operasi');

insert into tbl_laporan_harian (id_pengguna, id_pos, id_kategori_insiden, tajuk_laporan, syif, tarikh_laporan, masa_laporan, kandungan_laporan, status_laporan, tahap_risiko) values
(3, 1, 8, 'Keadaan pos terkawal', 'Pagi', current_date - interval '5 day', '08:30', 'Keadaan pos terkawal dan tiada insiden dilaporkan.', 'Diluluskan', 'Low'),
(4, 5, 7, 'Lampu parking rosak', 'Petang', current_date - interval '4 day', '16:10', 'Rondaan blok B selesai. Lampu parking rosak.', 'Dihantar', 'Medium'),
(5, 3, 1, 'Individu cuba masuk tanpa izin', 'Malam', current_date - interval '3 day', '22:40', 'Terdapat individu mencurigakan cuba masuk tanpa izin.', 'Dihantar', 'High'),
(3, 9, 2, 'Kebakaran kecil berhampiran parkir', 'Malam', current_date - interval '2 day', '23:20', 'Kebakaran kecil berlaku berhampiran kawasan parkir.', 'Dihantar', 'Critical'),
(4, 4, 6, 'Pintu belakang tidak berkunci', 'Pagi', current_date - interval '1 day', '07:50', 'Pintu belakang didapati tidak berkunci semasa rondaan malam.', 'Ditolak', 'Medium');

insert into tbl_hasil_nlp (id_laporan, teks_diproses, kata_kunci_dikesan, kategori_dikesan, skor_sentimen, skor_risiko, tahap_risiko, ringkasan_automatik, tahap_keyakinan) values
(1, 'keadaan pos terkawal dan tiada insiden dilaporkan', array['keadaan terkawal','tiada insiden'], 'Rondaan Biasa', 0.20, 18, 'Low', 'Rondaan Biasa: keadaan pos terkawal dan tiada insiden dilaporkan', 0.79),
(2, 'rondaan blok b selesai lampu parking rosak', array['lampu parking rosak'], 'Kerosakan Kemudahan', -0.10, 42, 'Medium', 'Kerosakan Kemudahan: rondaan blok b selesai lampu parking rosak', 0.67),
(3, 'terdapat individu mencurigakan cuba masuk tanpa izin', array['masuk tanpa izin'], 'Pencerobohan', -0.60, 78, 'High', 'Pencerobohan: terdapat individu mencurigakan cuba masuk tanpa izin', 0.67),
(4, 'kebakaran kecil berlaku berhampiran kawasan parkir', array['kebakaran'], 'Kebakaran', -0.75, 92, 'Critical', 'Kebakaran: kebakaran kecil berlaku berhampiran kawasan parkir', 0.67),
(5, 'pintu belakang didapati tidak berkunci semasa rondaan malam', array['tidak berkunci'], 'Keselamatan Fizikal', -0.10, 50, 'Medium', 'Keselamatan Fizikal: pintu belakang didapati tidak berkunci semasa rondaan malam', 0.67);

insert into tbl_pengesahan_laporan (id_laporan, id_pengguna_pengesah, status_pengesahan, catatan_pengesahan) values
(1, 2, 'Diluluskan', 'Laporan rondaan lengkap.'),
(5, 2, 'Ditolak', 'Sila tambah gambar atau maklumat pintu yang terlibat.');

insert into tbl_tindakan_susulan (id_laporan, pegawai_bertanggungjawab, tindakan_diambil, status_tindakan, tahap_keutamaan, tarikh_mula, catatan_tindakan) values
(3, 'Ketua Pengawal Rahman', 'Semak rakaman CCTV dan laporkan kepada pihak pentadbiran.', 'Dalam Tindakan', 'High', current_date - interval '3 day', 'Menunggu semakan rakaman.'),
(4, 'Unit Keselamatan dan Fasiliti', 'Periksa bilik utiliti dan pastikan punca asap disahkan.', 'Baru', 'Critical', current_date - interval '2 day', 'Perlu tindakan segera.');

insert into tbl_jawapan_checklist (id_laporan, id_checklist, jawapan, catatan) values
(1, 1, 'Ya', null), (1, 2, 'Ya', null), (1, 3, 'Ya', null), (1, 4, 'Ya', null), (1, 5, 'Ya', null),
(3, 1, 'Ya', null), (3, 2, 'Ya', 'Rakaman perlu disemak'), (3, 3, 'Ya', null), (3, 4, 'Ya', null), (3, 5, 'Tidak', 'Tiada rekod pelawat untuk individu tersebut');

insert into tbl_status_bertugas (id_pengguna, id_pos, tarikh, syif, status_bertugas, masa_mula, masa_tamat) values
(3, 1, current_date, 'Pagi', 'Bertugas', '07:00', '15:00'),
(4, 2, current_date, 'Petang', 'Bertugas', '15:00', '23:00'),
(5, 3, current_date, 'Malam', 'Bertugas', '23:00', '07:00');

insert into tbl_notifikasi (id_pengguna, tajuk_notifikasi, mesej_notifikasi, jenis_notifikasi, tahap_keutamaan) values
(2, 'Laporan kritikal', 'Asap dikesan di bilik utiliti kolej kediaman.', 'Risiko Tinggi', 'Critical'),
(1, 'Semakan audit', 'Audit trail sedia untuk semakan pentadbir.', 'Sistem', 'Low');

insert into tbl_audit_trail (id_pengguna, modul_sistem, jenis_aktiviti, penerangan_aktiviti, rekod_terlibat, alamat_ip, peranti_pengguna, status_aktiviti) values
(1, 'Pengguna', 'User created', 'Seed pengguna demo diwujudkan', 'seed', '127.0.0.1', 'seed', 'Berjaya'),
(2, 'Semakan Laporan', 'Report approved', 'Laporan rondaan diluluskan', '1', '127.0.0.1', 'seed', 'Berjaya'),
(3, 'Laporan Harian', 'Submit daily report', 'Laporan contoh dihantar', '1', '127.0.0.1', 'seed', 'Berjaya'),
(3, 'NLP', 'NLP analysis completed', 'Analisis NLP rule-based seed selesai', '1', '127.0.0.1', 'seed', 'Berjaya');
