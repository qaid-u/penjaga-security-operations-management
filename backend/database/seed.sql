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

insert into tbl_pengguna (id_peranan, nama_penuh, no_kad_pengenalan, no_telefon, emel, nama_pengguna, kata_laluan, status_akaun) values
(3, 'Pengawal Farah', '960606060006', '012-3000006', 'farah@penjaga.local', 'farah', '$2b$10$9Lo0uAtINIJStdbyFpxxN.pbdkklKScVMsUbFYxlIdG1iMGKsxyDi', 'Aktif'),
(3, 'Pengawal Hafiz', '950707070007', '012-3000007', 'hafiz@penjaga.local', 'hafiz', '$2b$10$9Lo0uAtINIJStdbyFpxxN.pbdkklKScVMsUbFYxlIdG1iMGKsxyDi', 'Aktif'),
(3, 'Pengawal Mei Ling', '940808080008', '012-3000008', 'meiling@penjaga.local', 'meiling', '$2b$10$9Lo0uAtINIJStdbyFpxxN.pbdkklKScVMsUbFYxlIdG1iMGKsxyDi', 'Aktif'),
(3, 'Pengawal Arif', '930909090009', '012-3000009', 'arif@penjaga.local', 'arif', '$2b$10$9Lo0uAtINIJStdbyFpxxN.pbdkklKScVMsUbFYxlIdG1iMGKsxyDi', 'Aktif'),
(3, 'Pengawal Nadia', '921010100010', '012-3000010', 'nadia@penjaga.local', 'nadia', '$2b$10$9Lo0uAtINIJStdbyFpxxN.pbdkklKScVMsUbFYxlIdG1iMGKsxyDi', 'Aktif'),
(3, 'Pengawal Ramesh', '911111110011', '012-3000011', 'ramesh@penjaga.local', 'ramesh', '$2b$10$9Lo0uAtINIJStdbyFpxxN.pbdkklKScVMsUbFYxlIdG1iMGKsxyDi', 'Aktif'),
(3, 'Pengawal Izzat', '901212120012', '012-3000012', 'izzat@penjaga.local', 'izzat', '$2b$10$9Lo0uAtINIJStdbyFpxxN.pbdkklKScVMsUbFYxlIdG1iMGKsxyDi', 'Aktif'),
(3, 'Pengawal Liyana', '891313130013', '012-3000013', 'liyana@penjaga.local', 'liyana', '$2b$10$9Lo0uAtINIJStdbyFpxxN.pbdkklKScVMsUbFYxlIdG1iMGKsxyDi', 'Aktif');

insert into tbl_pos_kawalan (nama_pos, nama_bangunan, lokasi, waktu_operasi, status_pos) values
('Pos Lobi Utama', 'Bangunan Dato'' Jaafar Muhammad', 'Kota Iskandar', '24 Jam', 'Aktif'),
('Pos Bilik Kawalan CCTV', 'Bangunan Dato'' Jaafar Muhammad', 'Kota Iskandar', '24 Jam', 'Aktif'),
('Pos Tingkat 3 Pejabat Setiausaha Kerajaan Johor', 'Bangunan Dato'' Jaafar Muhammad', 'Kota Iskandar', '24 Jam', 'Aktif'),
('Pos Tingkat 4 Hadapan Pejabat Menteri Besar Johor', 'Bangunan Dato'' Jaafar Muhammad', 'Kota Iskandar', '24 Jam', 'Aktif'),
('Pos Tingkat 4 Belakang Pejabat Menteri Besar Johor', 'Bangunan Dato'' Jaafar Muhammad', 'Kota Iskandar', '24 Jam', 'Aktif'),
('Pos Lif LG Pejabat Setiausaha Kerajaan Johor', 'Bangunan Dato'' Jaafar Muhammad', 'Kota Iskandar', '24 Jam', 'Aktif'),
('Pos Lif LG Pejabat Menteri Besar Johor', 'Bangunan Dato'' Jaafar Muhammad', 'Kota Iskandar', '24 Jam', 'Aktif'),
('Pos BDARA', 'Bangunan Dato'' Abdul Rahman Andak', 'Kota Iskandar', '24 Jam', 'Aktif'),
('Pos BDMSP', 'Bangunan Dato'' Mohamad Salleh Perang', 'Kota Iskandar', '24 Jam', 'Aktif'),
('Pos BDMIM', 'Bangunan Dato'' Muhamad Ibrahim Munsyi', 'Kota Iskandar', '24 Jam', 'Aktif'),
('Pos Pejabat Jurutulis', 'Bangunan Sultan Ismail (BSI)', 'Kota Iskandar', '24 Jam', 'Aktif'),
('Pos Dewan Undangan Negeri (DUN)', 'Bangunan Sultan Ismail (BSI)', 'Kota Iskandar', '24 Jam', 'Aktif'),
('Pos C1S', 'Kabin C1S', 'Kota Iskandar', '24 Jam', 'Aktif'),
('Pos BSI Johor Bahru', 'Bangunan Sultan Ibrahim (BSI)', 'Johor Bahru', '24 Jam', 'Aktif'),
('Pos Rumah SS', 'Kediaman Rasmi Setiausaha Kerajaan Johor', 'Johor', '24 Jam', 'Aktif'),
('Pos Rumah VIP', 'Rumah VIP Setiausaha Kerajaan Johor', 'Johor', '24 Jam', 'Aktif'),
('Pos UTC', 'Kaunter UTC Pejabat Setiausaha Kerajaan Johor', 'UTC Johor', 'Hari bekerja 07:00-17:00', 'Aktif');

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

insert into tbl_laporan_harian (id_pengguna, id_pos, id_kategori_insiden, tajuk_laporan, syif, tarikh_laporan, masa_laporan, kandungan_laporan, status_laporan, tahap_risiko) values
(6, 2, 8, 'Rondaan CCTV terkawal', 'Pagi', current_date - interval '10 day', '08:15', 'FORMAT LAPORAN HARIAN | Pos: Pos Bilik Kawalan CCTV | Syif: Pagi | Pemerhatian: rondaan selesai, keadaan terkawal dan tiada insiden pada paparan kamera utama | Tindakan: buku laporan dikemas kini dan pos diserah kepada syif berikutnya | Status: Selesai.', 'Diluluskan', 'Low'),
(7, 6, 7, 'CCTV lif LG tidak berfungsi', 'Petang', current_date - interval '9 day', '17:05', 'FORMAT LAPORAN HARIAN | Pos: Pos Lif LG Pejabat Setiausaha Kerajaan Johor | Syif: Petang | Pemerhatian: cctv rosak dan paparan kamera lif LG tidak berfungsi | Tindakan: unit fasiliti dimaklumkan dan pemantauan manual dibuat sementara | Status: Perlu tindakan fasiliti.', 'Dihantar', 'Medium'),
(8, 14, 1, 'Individu tanpa pas di BSI Johor Bahru', 'Malam', current_date - interval '8 day', '22:35', 'FORMAT LAPORAN HARIAN | Pos: Pos BSI Johor Bahru | Syif: Malam | Pemerhatian: orang asing tanpa pas cuba masuk tanpa izin melalui pintu tepi | Tindakan: individu ditahan untuk semakan dan rakaman cctv disemak | Status: Menunggu arahan Ketua.', 'Dihantar', 'High'),
(9, 8, 2, 'Asap di bilik utiliti BDARA', 'Malam', current_date - interval '7 day', '23:10', 'FORMAT LAPORAN HARIAN | Pos: Pos BDARA | Syif: Malam | Pemerhatian: asap tebal dan bau hangit dikesan di bilik utiliti | Tindakan: kawasan dikosongkan, pemadam api disediakan dan bomba dimaklumkan | Status: Kritikal.', 'Dihantar', 'Critical'),
(10, 15, 6, 'Pagar kediaman SS terbuka', 'Pagi', current_date - interval '7 day', '07:40', 'FORMAT LAPORAN HARIAN | Pos: Pos Rumah SS | Syif: Pagi | Pemerhatian: pagar terbuka dan pintu belakang tidak berkunci selepas rondaan awal | Tindakan: pintu dikunci semula dan catatan dibuat dalam buku laporan | Status: Selesai sementara.', 'Diluluskan', 'Medium'),
(11, 11, 4, 'Kad akses jurutulis hilang', 'Petang', current_date - interval '6 day', '15:50', 'FORMAT LAPORAN HARIAN | Pos: Pos Pejabat Jurutulis | Syif: Petang | Pemerhatian: kad akses sementara dilaporkan hilang oleh kontraktor | Tindakan: rekod pinjaman disemak dan Ketua dimaklumkan | Status: Dalam semakan.', 'Dihantar', 'High'),
(12, 12, 5, 'Papan notis DUN diconteng', 'Petang', current_date - interval '6 day', '18:20', 'FORMAT LAPORAN HARIAN | Pos: Pos Dewan Undangan Negeri | Syif: Petang | Pemerhatian: papan notis rasmi diconteng dan kaca papan notis retak | Tindakan: gambar bukti diambil dan unit fasiliti dimaklumkan | Status: Perlu pembaikan.', 'Dihantar', 'Medium'),
(13, 17, 3, 'Kekecohan di Pos UTC', 'Pagi', current_date - interval '5 day', '10:25', 'FORMAT LAPORAN HARIAN | Pos: Pos UTC | Syif: Pagi | Pemerhatian: kekecohan berlaku apabila pelawat enggan mematuhi arahan keselamatan | Tindakan: pihak terlibat dileraikan dan keadaan dikawal | Status: Selesai dengan pemantauan.', 'Dihantar', 'High'),
(3, 13, 8, 'Rondaan Kabin C1S selesai', 'Malam', current_date - interval '4 day', '23:45', 'FORMAT LAPORAN HARIAN | Pos: Pos C1S | Syif: Malam | Pemerhatian: rondaan selesai, keadaan terkawal dan tiada insiden di kawasan kabin | Tindakan: buku laporan dikemas kini | Status: Selesai.', 'Diluluskan', 'Low'),
(4, 2, 7, 'Paparan kamera lobi terganggu', 'Pagi', current_date - interval '4 day', '09:30', 'FORMAT LAPORAN HARIAN | Pos: Pos Bilik Kawalan CCTV | Syif: Pagi | Pemerhatian: cctv tidak berfungsi untuk kamera lobi utama selama 15 minit | Tindakan: aduan pembaikan direkodkan dan rondaan fizikal ditambah | Status: Perlu tindakan.', 'Dihantar', 'Medium'),
(6, 4, 1, 'Cubaan masuk pejabat MB', 'Malam', current_date - interval '3 day', '21:55', 'FORMAT LAPORAN HARIAN | Pos: Pos Tingkat 4 Hadapan Pejabat Menteri Besar Johor | Syif: Malam | Pemerhatian: individu mencurigakan cuba ceroboh masuk ke kawasan pejabat selepas waktu operasi | Tindakan: akses ditolak, kawasan dikawal dan Ketua dimaklumkan | Status: Dilaporkan.', 'Diluluskan', 'High'),
(7, 9, 2, 'Percikan api di stor BDMSP', 'Malam', current_date - interval '3 day', '00:20', 'FORMAT LAPORAN HARIAN | Pos: Pos BDMSP | Syif: Malam | Pemerhatian: percikan api dan bau terbakar dikesan berhampiran suis lampu stor | Tindakan: suis dimatikan, kawasan dikosongkan dan unit fasiliti dihubungi | Status: Kritikal.', 'Dihantar', 'Critical'),
(8, 5, 6, 'Pintu belakang pejabat MB tidak berkunci', 'Pagi', current_date - interval '2 day', '07:35', 'FORMAT LAPORAN HARIAN | Pos: Pos Tingkat 4 Belakang Pejabat Menteri Besar Johor | Syif: Pagi | Pemerhatian: pintu belakang didapati tidak berkunci dan boleh dibuka tanpa kad | Tindakan: pintu dikunci semula dan pegawai bertanggungjawab dimaklumkan | Status: Pembetulan diperlukan.', 'Ditolak', 'Medium'),
(9, 10, 8, 'Rondaan BDMIM tanpa insiden', 'Petang', current_date - interval '2 day', '16:45', 'FORMAT LAPORAN HARIAN | Pos: Pos BDMIM | Syif: Petang | Pemerhatian: rondaan selesai, keadaan terkawal dan tiada individu mencurigakan | Tindakan: rekod pelawat disemak dan pos diserah kepada syif malam | Status: Selesai.', 'Dihantar', 'Low'),
(10, 16, 4, 'Radio komunikasi hilang', 'Malam', current_date - interval '1 day', '22:15', 'FORMAT LAPORAN HARIAN | Pos: Pos Rumah VIP | Syif: Malam | Pemerhatian: radio komunikasi pengawal dilaporkan hilang dari pos kawalan | Tindakan: kawasan stor diperiksa dan rekod serahan syif disemak | Status: Diluluskan untuk tindakan susulan.', 'Diluluskan', 'High'),
(5, 1, 5, 'Kerusi lobi dirosakkan', 'Petang', current_date - interval '1 day', '19:05', 'FORMAT LAPORAN HARIAN | Pos: Pos Lobi Utama | Syif: Petang | Pemerhatian: kerusi menunggu di lobi patah dan terdapat kesan sengaja dirosakkan | Tindakan: gambar bukti diambil dan kawasan ditanda untuk pembaikan | Status: Perlu pembaikan.', 'Dihantar', 'Medium');

insert into tbl_hasil_nlp (id_laporan, teks_diproses, kata_kunci_dikesan, kategori_dikesan, skor_sentimen, skor_risiko, tahap_risiko, ringkasan_automatik, tahap_keyakinan) values
(1, 'keadaan pos terkawal dan tiada insiden dilaporkan', array['keadaan terkawal','tiada insiden'], 'Rondaan Biasa', 0.20, 18, 'Low', 'Rondaan Biasa: keadaan pos terkawal dan tiada insiden dilaporkan', 0.79),
(2, 'rondaan blok b selesai lampu parking rosak', array['lampu parking rosak'], 'Kerosakan Kemudahan', -0.10, 42, 'Medium', 'Kerosakan Kemudahan: rondaan blok b selesai lampu parking rosak', 0.67),
(3, 'terdapat individu mencurigakan cuba masuk tanpa izin', array['masuk tanpa izin'], 'Pencerobohan', -0.60, 78, 'High', 'Pencerobohan: terdapat individu mencurigakan cuba masuk tanpa izin', 0.67),
(4, 'kebakaran kecil berlaku berhampiran kawasan parkir', array['kebakaran'], 'Kebakaran', -0.75, 92, 'Critical', 'Kebakaran: kebakaran kecil berlaku berhampiran kawasan parkir', 0.67),
(5, 'pintu belakang didapati tidak berkunci semasa rondaan malam', array['tidak berkunci'], 'Keselamatan Fizikal', -0.10, 50, 'Medium', 'Keselamatan Fizikal: pintu belakang didapati tidak berkunci semasa rondaan malam', 0.67);

insert into tbl_hasil_nlp (id_laporan, teks_diproses, kata_kunci_dikesan, kategori_dikesan, skor_sentimen, skor_risiko, tahap_risiko, ringkasan_automatik, tahap_keyakinan) values
(6, 'format laporan harian pos pos bilik kawalan cctv syif pagi pemerhatian rondaan selesai keadaan terkawal dan tiada insiden pada paparan kamera utama tindakan buku laporan dikemas kini dan pos diserah kepada syif berikutnya status selesai', array['rondaan selesai','keadaan terkawal','tiada insiden'], 'Rondaan Biasa', 0.20, 21, 'Low', 'Rondaan Biasa: rondaan selesai, keadaan terkawal dan tiada insiden pada paparan kamera utama', 0.91),
(7, 'format laporan harian pos pos lif lg pejabat setiausaha kerajaan johor syif petang pemerhatian cctv rosak dan paparan kamera lif lg tidak berfungsi tindakan unit fasiliti dimaklumkan dan pemantauan manual dibuat sementara status perlu tindakan fasiliti', array['cctv rosak'], 'Kerosakan Kemudahan', -0.10, 45, 'Medium', 'Kerosakan Kemudahan: cctv rosak dan paparan kamera lif LG tidak berfungsi', 0.86),
(8, 'format laporan harian pos pos bsi johor bahru syif malam pemerhatian orang asing tanpa pas cuba masuk tanpa izin melalui pintu tepi tindakan individu ditahan untuk semakan dan rakaman cctv disemak status menunggu arahan ketua', array['orang asing','masuk tanpa izin'], 'Pencerobohan', -0.60, 81, 'High', 'Pencerobohan: orang asing tanpa pas cuba masuk tanpa izin melalui pintu tepi', 0.90),
(9, 'format laporan harian pos pos bdara syif malam pemerhatian asap tebal dan bau hangit dikesan di bilik utiliti tindakan kawasan dikosongkan pemadam api disediakan dan bomba dimaklumkan status kritikal', array['asap','api'], 'Kebakaran', -0.75, 95, 'Critical', 'Kebakaran: asap tebal dan bau hangit dikesan di bilik utiliti', 0.93),
(10, 'format laporan harian pos pos rumah ss syif pagi pemerhatian pagar terbuka dan pintu belakang tidak berkunci selepas rondaan awal tindakan pintu dikunci semula dan catatan dibuat dalam buku laporan status selesai sementara', array['pagar terbuka','tidak berkunci'], 'Keselamatan Fizikal', -0.10, 56, 'Medium', 'Keselamatan Fizikal: pagar terbuka dan pintu belakang tidak berkunci selepas rondaan awal', 0.88),
(11, 'format laporan harian pos pos pejabat jurutulis syif petang pemerhatian kad akses sementara dilaporkan hilang oleh kontraktor tindakan rekod pinjaman disemak dan ketua dimaklumkan status dalam semakan', array['hilang'], 'Kehilangan Aset', -0.60, 73, 'High', 'Kehilangan Aset: kad akses sementara dilaporkan hilang oleh kontraktor', 0.84),
(12, 'format laporan harian pos pos dewan undangan negeri syif petang pemerhatian papan notis rasmi diconteng dan kaca papan notis retak tindakan gambar bukti diambil dan unit fasiliti dimaklumkan status perlu pembaikan', array['conteng'], 'Vandalisme', -0.10, 58, 'Medium', 'Vandalisme: papan notis rasmi diconteng dan kaca papan notis retak', 0.82),
(13, 'format laporan harian pos pos utc syif pagi pemerhatian kekecohan berlaku apabila pelawat enggan mematuhi arahan keselamatan tindakan pihak terlibat dileraikan dan keadaan dikawal status selesai dengan pemantauan', array['kekecohan'], 'Pergaduhan', -0.60, 74, 'High', 'Pergaduhan: kekecohan berlaku apabila pelawat enggan mematuhi arahan keselamatan', 0.85),
(14, 'format laporan harian pos pos c1s syif malam pemerhatian rondaan selesai keadaan terkawal dan tiada insiden di kawasan kabin tindakan buku laporan dikemas kini status selesai', array['rondaan selesai','keadaan terkawal','tiada insiden'], 'Rondaan Biasa', 0.20, 21, 'Low', 'Rondaan Biasa: rondaan selesai, keadaan terkawal dan tiada insiden di kawasan kabin', 0.91),
(15, 'format laporan harian pos pos bilik kawalan cctv syif pagi pemerhatian cctv tidak berfungsi untuk kamera lobi utama selama 15 minit tindakan aduan pembaikan direkodkan dan rondaan fizikal ditambah status perlu tindakan', array['cctv rosak'], 'Kerosakan Kemudahan', -0.10, 45, 'Medium', 'Kerosakan Kemudahan: cctv tidak berfungsi untuk kamera lobi utama', 0.80),
(16, 'format laporan harian pos pos tingkat 4 hadapan pejabat menteri besar johor syif malam pemerhatian individu mencurigakan cuba ceroboh masuk ke kawasan pejabat selepas waktu operasi tindakan akses ditolak kawasan dikawal dan ketua dimaklumkan status dilaporkan', array['ceroboh'], 'Pencerobohan', -0.60, 79, 'High', 'Pencerobohan: individu mencurigakan cuba ceroboh masuk ke kawasan pejabat selepas waktu operasi', 0.89),
(17, 'format laporan harian pos pos bdmsp syif malam pemerhatian percikan api dan bau terbakar dikesan berhampiran suis lampu stor tindakan suis dimatikan kawasan dikosongkan dan unit fasiliti dihubungi status kritikal', array['api','terbakar'], 'Kebakaran', -0.75, 95, 'Critical', 'Kebakaran: percikan api dan bau terbakar dikesan berhampiran suis lampu stor', 0.92),
(18, 'format laporan harian pos pos tingkat 4 belakang pejabat menteri besar johor syif pagi pemerhatian pintu belakang didapati tidak berkunci dan boleh dibuka tanpa kad tindakan pintu dikunci semula dan pegawai bertanggungjawab dimaklumkan status pembetulan diperlukan', array['tidak berkunci'], 'Keselamatan Fizikal', -0.10, 52, 'Medium', 'Keselamatan Fizikal: pintu belakang didapati tidak berkunci dan boleh dibuka tanpa kad', 0.86),
(19, 'format laporan harian pos pos bdmim syif petang pemerhatian rondaan selesai keadaan terkawal dan tiada individu mencurigakan tindakan rekod pelawat disemak dan pos diserah kepada syif malam status selesai', array['rondaan selesai','keadaan terkawal'], 'Rondaan Biasa', 0.20, 18, 'Low', 'Rondaan Biasa: rondaan selesai, keadaan terkawal dan tiada individu mencurigakan', 0.88),
(20, 'format laporan harian pos pos rumah vip syif malam pemerhatian radio komunikasi pengawal dilaporkan hilang dari pos kawalan tindakan kawasan stor diperiksa dan rekod serahan syif disemak status diluluskan untuk tindakan susulan', array['hilang'], 'Kehilangan Aset', -0.60, 73, 'High', 'Kehilangan Aset: radio komunikasi pengawal dilaporkan hilang dari pos kawalan', 0.86),
(21, 'format laporan harian pos pos lobi utama syif petang pemerhatian kerusi menunggu di lobi patah dan terdapat kesan sengaja dirosakkan tindakan gambar bukti diambil dan kawasan ditanda untuk pembaikan status perlu pembaikan', array['rosak'], 'Vandalisme', -0.10, 55, 'Medium', 'Vandalisme: kerusi menunggu di lobi patah dan sengaja dirosakkan', 0.80);

insert into tbl_pengesahan_laporan (id_laporan, id_pengguna_pengesah, status_pengesahan, catatan_pengesahan) values
(1, 2, 'Diluluskan', 'Laporan rondaan lengkap.'),
(5, 2, 'Ditolak', 'Sila tambah gambar atau maklumat pintu yang terlibat.'),
(6, 2, 'Diluluskan', 'Format laporan lengkap dan keadaan pos terkawal.'),
(10, 2, 'Diluluskan', 'Catatan keselamatan fizikal jelas dan tindakan awal sesuai.'),
(14, 2, 'Diluluskan', 'Laporan rondaan C1S lengkap.'),
(16, 2, 'Diluluskan', 'Insiden pencerobohan perlu tindakan susulan Admin.'),
(18, 2, 'Ditolak', 'Sila lampirkan gambar pintu dan catatan pegawai yang dimaklumkan.'),
(20, 2, 'Diluluskan', 'Kehilangan aset perlu tindakan susulan dan semakan rekod serahan syif.');

update tbl_laporan_harian
set perlu_tindakan_susulan = true
where id_laporan in (16, 20);

insert into tbl_tindakan_susulan (id_laporan, pegawai_bertanggungjawab, tindakan_diambil, status_tindakan, tahap_keutamaan, tarikh_mula, catatan_tindakan) values
(3, 'Ketua Pengawal Rahman', 'Semak rakaman CCTV dan laporkan kepada pihak pentadbiran.', 'Dalam Tindakan', 'High', current_date - interval '3 day', 'Menunggu semakan rakaman.'),
(4, 'Unit Keselamatan dan Fasiliti', 'Periksa bilik utiliti dan pastikan punca asap disahkan.', 'Baru', 'Critical', current_date - interval '2 day', 'Perlu tindakan segera.'),
(16, 'Pentadbir Sistem', 'Semak log akses tingkat 4 dan sahkan identiti individu melalui rakaman CCTV.', 'Dalam Tindakan', 'High', current_date - interval '3 day', 'Admin menunggu pengesahan rakaman daripada bilik kawalan.'),
(20, 'Pentadbir Sistem', 'Audit rekod serahan radio komunikasi dan dapatkan pengesahan pengawal syif sebelumnya.', 'Baru', 'High', current_date - interval '1 day', 'Perlu semakan aset keselamatan.');

insert into tbl_progress_tindakan (id_tindakan, id_pengguna, catatan_progress, tarikh_progress, dilihat_admin) values
(3, 2, 'Ketua telah menyemak laporan awal. Rakaman CCTV menunjukkan individu berada di koridor selama 4 minit sebelum diarahkan keluar.', current_timestamp - interval '2 day', true),
(3, 2, 'Cadangan Ketua: teruskan pemantauan tambahan di tingkat 4 untuk dua syif seterusnya.', current_timestamp - interval '1 day', false),
(4, 2, 'Ketua mengesahkan rekod serahan radio terakhir belum lengkap. Admin diminta semak buku aset dan pengawal syif malam.', current_timestamp - interval '12 hour', false);

insert into tbl_jawapan_checklist (id_laporan, id_checklist, jawapan, catatan) values
(1, 1, 'Ya', null), (1, 2, 'Ya', null), (1, 3, 'Ya', null), (1, 4, 'Ya', null), (1, 5, 'Ya', null),
(3, 1, 'Ya', null), (3, 2, 'Ya', 'Rakaman perlu disemak'), (3, 3, 'Ya', null), (3, 4, 'Ya', null), (3, 5, 'Tidak', 'Tiada rekod pelawat untuk individu tersebut'),
(6, 1, 'Ya', 'Rondaan CCTV selesai'), (6, 4, 'Ya', 'Semua paparan utama berfungsi'), (6, 7, 'Ya', 'Pos terkawal'),
(8, 1, 'Ya', 'Rondaan tambahan dibuat'), (8, 4, 'Ya', 'Rakaman disimpan'), (8, 5, 'Tidak', 'Individu tanpa pas dikesan'),
(9, 1, 'Ya', 'Kawasan utiliti diperiksa'), (9, 3, 'Tidak', 'Asap mengganggu laluan'), (9, 7, 'Tidak', 'Status kritikal semasa laporan'),
(10, 1, 'Ya', null), (10, 2, 'Tidak', 'Pagar dan pintu perlu tindakan'), (10, 7, 'Ya', 'Keadaan dikawal selepas pintu dikunci'),
(16, 1, 'Ya', 'Rondaan tingkat 4 dibuat'), (16, 4, 'Ya', 'Rakaman perlu semakan Admin'), (16, 5, 'Tidak', 'Individu mencurigakan dikesan'),
(20, 1, 'Ya', 'Rondaan stor dibuat'), (20, 6, 'Tidak', 'Rekod serahan radio tidak lengkap'), (20, 7, 'Ya', 'Pos terkawal selepas laporan');

insert into tbl_status_bertugas (id_pengguna, id_pos, tarikh, syif, status_bertugas, masa_mula, masa_tamat) values
(3, 1, current_date, 'Pagi', 'Bertugas', '07:00', '15:00'),
(4, 2, current_date, 'Petang', 'Bertugas', '15:00', '23:00'),
(5, 3, current_date, 'Malam', 'Bertugas', '23:00', '07:00'),
(6, 4, current_date, 'Malam', 'Dijadualkan', '23:00', '08:00'),
(7, 6, current_date, 'Petang', 'Dijadualkan', '14:45', '23:45'),
(8, 14, current_date, 'Malam', 'Bertugas', '23:00', '08:00'),
(9, 8, current_date, 'Pagi', 'Dijadualkan', '07:00', '16:00'),
(10, 15, current_date, 'Pagi', 'Selesai', '07:00', '16:00'),
(11, 11, current_date + interval '1 day', 'Petang', 'Dijadualkan', '14:45', '23:45'),
(12, 12, current_date + interval '1 day', 'Petang', 'Dijadualkan', '14:45', '23:45'),
(13, 17, current_date + interval '1 day', 'Pagi', 'Dijadualkan', '07:00', '17:00'),
(6, 2, current_date + interval '2 day', 'Pagi', 'Dijadualkan', '07:00', '16:00'),
(7, 9, current_date + interval '2 day', 'Malam', 'Dijadualkan', '23:00', '08:00'),
(8, 5, current_date + interval '2 day', 'Pagi', 'Dijadualkan', '07:00', '16:00'),
(9, 10, current_date + interval '2 day', 'Petang', 'Dijadualkan', '14:45', '23:45'),
(10, 16, current_date + interval '2 day', 'Malam', 'Dijadualkan', '23:00', '08:00');

insert into tbl_notifikasi (id_pengguna, tajuk_notifikasi, mesej_notifikasi, jenis_notifikasi, tahap_keutamaan) values
(2, 'Laporan kritikal', 'Asap dikesan di bilik utiliti kolej kediaman.', 'Risiko Tinggi', 'Critical'),
(1, 'Semakan audit', 'Audit trail sedia untuk semakan pentadbir.', 'Sistem', 'Low'),
(1, 'Progress tindakan baharu', 'Ketua Pengawal menghantar progress untuk tindakan pencerobohan tingkat 4.', 'Tindakan Susulan', 'Medium'),
(6, 'Laporan diluluskan', 'Laporan Cubaan masuk pejabat MB telah diluluskan dan dihantar kepada Admin untuk tindakan susulan.', 'Semakan Laporan', 'Low'),
(8, 'Laporan ditolak', 'Laporan Pintu belakang pejabat MB tidak berkunci memerlukan lampiran tambahan.', 'Semakan Laporan', 'Medium');

insert into tbl_audit_trail (id_pengguna, modul_sistem, jenis_aktiviti, penerangan_aktiviti, rekod_terlibat, alamat_ip, peranti_pengguna, status_aktiviti) values
(1, 'Pengguna', 'User created', 'Seed pengguna demo diwujudkan', 'seed', '127.0.0.1', 'seed', 'Berjaya'),
(2, 'Semakan Laporan', 'Report approved', 'Laporan rondaan diluluskan', '1', '127.0.0.1', 'seed', 'Berjaya'),
(3, 'Laporan Harian', 'Submit daily report', 'Laporan contoh dihantar', '1', '127.0.0.1', 'seed', 'Berjaya'),
(3, 'NLP', 'NLP analysis completed', 'Analisis NLP rule-based seed selesai', '1', '127.0.0.1', 'seed', 'Berjaya');
