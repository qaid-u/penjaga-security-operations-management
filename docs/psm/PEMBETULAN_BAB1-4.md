# Draf pembetulan Laporan PSM Bab 1–4 (PENJAGA)

Teks ini menggantikan bahagian dalam *Compiled_Chap1-4.pdf* yang tidak lagi sepadan dengan sistem semasa. Setiap bahagian menyatakan lokasi asal dan teks gantian. Item bertanda **[PILIHAN]** ialah fungsi yang diterangkan dalam laporan tetapi belum dibangunkan: sama ada buang daripada laporan (teks gantian diberi) atau kekalkan dan bangunkan dalam PSM 2.

---

## Abstrak / Abstract (ayat tentang NLP)

**Ganti** "rule-based Natural Language Processing (NLP)" / "NLP berasaskan peraturan" dengan:

> …analisis laporan harian menggunakan pendekatan NLP hibrid yang menggabungkan model pengelasan Multinomial Naive Bayes dengan peraturan kontekstual, penjadualan dan kehadiran pengawal, pengurusan insiden, papan pemuka analitik dan audit trail.

*Abstract (EN):* "…a hybrid NLP approach combining a Multinomial Naive Bayes classifier with contextual rules, guard scheduling and attendance, incident management, an analytical dashboard and an audit trail."

## 1.3 Objektif (Objektif 2)

> 2. Membangunkan sistem pengurusan operasi keselamatan berasaskan web yang mengintegrasikan penjadualan bertugas dan analisis laporan harian menggunakan pendekatan NLP hibrid, iaitu model Multinomial Naive Bayes dan peraturan kontekstual.

## 1.4 Skop (ganti perenggan 2 dan 3)

> Fungsi utama sistem merangkumi pengurusan pengguna dan pos kawalan, penjadualan bertugas mingguan serta kehadiran (daftar masuk dan daftar keluar), pelaporan harian digital berstruktur, analisis laporan menggunakan NLP, pengurusan insiden dan tindakan susulan, notifikasi, papan pemuka analitik, paparan lokasi pos dalam model bangunan tiga dimensi (3D) dan audit trail.
>
> Analisis laporan menggunakan pendekatan hibrid. Model Multinomial Naive Bayes yang dilatih secara setempat menggunakan data latihan sintetik mencadangkan kategori insiden, manakala peraturan kontekstual mengesan penafian, latihan (drill), insiden yang disyaki dan kata kunci yang dikonfigurasi dalam pangkalan data. Skor risiko (0–100) dan tahap risiko kemudiannya ditentukan. Model boleh dilatih semula secara automatik menggunakan kategori yang disahkan secara eksplisit oleh Ketua Pengawal, dan model baharu hanya diaktifkan selepas lulus semakan regresi. Semakan tambahan oleh model bahasa luaran (Gemini) adalah pilihan dan bersifat nasihat sahaja; ia tidak mengubah skor risiko atau keputusan semakan.
>
> Projek ini tidak melibatkan integrasi dengan sistem keselamatan fizikal seperti CCTV, sensor IoT atau sistem akses pintu. Kedudukan pos dalam model 3D merupakan anggaran visual dan bukan koordinat sebenar. Skor keyakinan model merupakan skor relatif dan bukan kebarangkalian sebenar sesuatu insiden.

## 2.3 Kaedah dan Teknologi (tambah selepas 2.3.3)

> **2.3.4 Pengelasan Teks Multinomial Naive Bayes**
>
> Multinomial Naive Bayes ialah kaedah pengelasan teks berasaskan kebarangkalian yang menganggarkan kategori sesuatu dokumen berdasarkan kekerapan perkataan, dengan andaian setiap perkataan adalah bebas antara satu sama lain (McCallum & Nigam, 1998; Manning et al., 2008). Kaedah ini dipilih kerana ia ringan, pantas dilatih, boleh dijelaskan melalui kiraan perkataan dan sesuai untuk set data bersaiz kecil. Dalam PENJAGA, model ini digabungkan dengan analisis berasaskan peraturan supaya ayat bersifat penafian (contohnya "tiada kebakaran") atau latihan kebakaran tidak dianggap sebagai insiden sebenar.

> **2.3.5 Penjadualan Bertugas Pengawal**
>
> Penjadualan syif melibatkan pengagihan pengawal kepada pos dan syif tertentu berdasarkan keperluan bilangan pengawal setiap pos. Sistem perlu mengelakkan pertindihan tugasan, termasuk syif malam yang merentasi tengah malam, serta merekod kehadiran sebenar pengawal bagi tujuan pemantauan.

**Tambah dalam Rujukan:**
- McCallum, A., & Nigam, K. (1998). A comparison of event models for naive Bayes text classification. *AAAI-98 Workshop on Learning for Text Categorization*.
- Manning, C. D., Raghavan, P., & Schütze, H. (2008). *Introduction to information retrieval*. Cambridge University Press.

*(Sahkan butiran rujukan ini sebelum digunakan.)*

**Jadual 2.1:** tambah baris "Penjadualan dan kehadiran pengawal" (Sistem Cadangan ✓).

## 3.1 Jadual 3.1 Pembahagian Sprint (tambah/ubah)

| Sprint | Modul | Hasil |
|---|---|---|
| Sprint 3 | Analisis NLP hibrid | Model Naive Bayes, peraturan kontekstual, skor risiko, notifikasi risiko tinggi |
| Sprint 5 | Penjadualan dan Kehadiran | Jadual mingguan, isi kekosongan harian, salin jadual, import CSV, daftar masuk/keluar |
| Sprint 6 | Papan Pemuka, Audit Trail dan Pusat Kawalan 3D | Statistik, trend, eksport CSV, rekod audit, paparan pos 3D |
| Sprint 7 | Pengujian dan Penambahbaikan | Ujian unit, integrasi dan pelayar; pembaikan keselamatan |

## 4.1 Jadual 4.1 Modul Sistem (ganti keseluruhan)

| No | Modul | Penerangan |
|---|---|---|
| 1 | Pengurusan Pengguna dan Pos | Pentadbir mendaftar pengguna, menetapkan peranan, mengaktif/menyahaktif akaun dan mengurus pos kawalan. |
| 2 | Penjadualan dan Kehadiran | Ketua Pengawal dan Pentadbir merancang jadual mingguan dan mengisi kekosongan harian; pengawal mendaftar masuk dan keluar syif. |
| 3 | Laporan Harian Digital | Pengawal menghantar laporan berstruktur bersama senarai semak dan lampiran bukti. |
| 4 | Analisis NLP | Mencadangkan kategori insiden, kata kunci, skor dan tahap risiko; menjana ringkasan dan soalan penjelasan pilihan. |
| 5 | Semakan dan Tindakan Susulan | Ketua Pengawal meluluskan atau menolak laporan dan mengesahkan kategori; Pentadbir mengurus tindakan susulan rasmi dan Ketua Pengawal merekod kemajuan. |
| 6 | Notifikasi | Memaklumkan Ketua Pengawal tentang laporan berisiko tinggi dan pengawal tentang perubahan jadual. |
| 7 | Papan Pemuka dan Pusat Kawalan 3D | Memaparkan statistik, trend dan status tindakan; memaparkan rekod operasi mengikut pos dalam model bangunan 3D. |
| 8 | Audit Trail | Merekod aktiviti penting dan membenarkan Pentadbir menapis serta mengeksport rekod dalam format CSV. |

## 4.1.1 Jadual 4.2 Keperluan Fungsian (baris yang perlu diubah)

- **Pengurusan Pengguna:** ganti "membenarkan pengguna baharu … mendaftar akaun sebelum log masuk" dengan *"Sistem hendaklah membenarkan Pentadbir Sistem mendaftarkan akaun pengguna baharu dan menetapkan peranan mereka."*
- **Analisis NLP:** *"Sistem hendaklah mengklasifikasikan laporan kepada kategori seperti pencerobohan, kebakaran, pergaduhan, kehilangan aset, vandalisme, keselamatan fizikal, kerosakan kemudahan dan rondaan biasa."* serta *"Sistem hendaklah menetapkan tahap risiko (Rendah, Sederhana, Tinggi, Kritikal) berdasarkan skor risiko 0–100; laporan yang tidak dapat dikelaskan ditanda Tidak Diketahui."*
- **Pengurusan Insiden:** *"Sistem hendaklah membenarkan penetapan status tindakan susulan: Baru, Dalam Tindakan dan Selesai."*
- **Tambah modul Penjadualan:** *"Sistem hendaklah membenarkan Ketua Pengawal dan Pentadbir membina jadual bertugas mingguan dan menghalang tugasan yang bertindih."*; *"Sistem hendaklah membenarkan pengawal mendaftar masuk dan keluar bagi syif yang ditugaskan."*

## 4.2.2 Spesifikasi Use Case

**UC-2 Hantar Laporan Harian:** ganti langkah 5.0–9.0 dan E2:

> 5.0 Sistem menyimpan laporan bersama satu tugas analisis dalam baris gilir.
> 6.0 Pemproses latar belakang menjalankan pembersihan teks, tokenisasi dan pengekstrakan kata kunci.
> 7.0 Model Naive Bayes dan peraturan kontekstual mencadangkan kategori insiden, skor risiko dan tahap risiko (Rendah / Sederhana / Tinggi / Kritikal).
> 8.0 Sistem menyimpan hasil analisis dan menghantar notifikasi kepada Ketua Pengawal jika risiko Tinggi atau Kritikal.
> 9.0 Sistem memaparkan status laporan kepada pengguna.
>
> E2: Analisis gagal → laporan kekal tersimpan dan tugas analisis dicuba semula secara automatik.

**UC-3 Semak dan Sahkan Laporan:** tambah langkah selepas 6.0: *"Ketua Pengawal mengesahkan atau membetulkan kategori insiden yang dicadangkan (pengesahan berasingan daripada kelulusan laporan)."* Ganti A2: *"A2: Ketua Pengawal menolak laporan bersama ulasan; laporan berstatus Ditolak."* (Status sebenar: Dihantar, Diluluskan, Ditolak.)

**UC-4 Pengurusan Tindakan Susulan:** tukar Pelakon kepada **Pentadbir Sistem, Ketua Pengawal** dan ganti aliran:

> 1.0 Ketua Pengawal menandakan laporan yang memerlukan tindakan susulan semasa semakan.
> 2.0 Pentadbir Sistem mencipta tindakan susulan rasmi (pegawai bertanggungjawab, tindakan, keutamaan, tarikh mula).
> 3.0 Ketua Pengawal merekod kemajuan tindakan bersama catatan dan lampiran.
> 4.0 Pentadbir Sistem mengemas kini status rasmi (Baru / Dalam Tindakan / Selesai) dan boleh meminta kemas kini daripada Ketua Pengawal.
> 5.0 Semua perubahan direkod dalam audit trail dan dipaparkan dalam papan pemuka.

**[PILIHAN]** Buang A1 (cadangan tindakan automatik) dan A2 (eskalasi apabila tamat tempoh), atau bangunkan dalam PSM 2. A3 boleh dikekalkan sebagai: *"Sejarah kemajuan dan perubahan tindakan disimpan sebagai rekod kemajuan dan audit trail."*

**UC-6 Audit Trail:** tukar Pelakon kepada **Sistem PENJAGA, Pentadbir Sistem** (Ketua Pengawal tiada akses). Ganti A.2 langkah 2: *"Sistem menjana fail CSV mengikut penapis semasa."* **[PILIHAN]** Buang E.1 langkah 3 (notifikasi kegagalan kepada Pentadbir) dan E.2 langkah 3 (rekod cubaan akses tidak sah), serta "alamat IP" dalam langkah 3.0, kerana sistem semasa tidak merekod alamat IP sebenar atau peranti pengguna.

**UC-5 Papan Pemuka:** **[PILIHAN]** buang langkah 9.0 (merekod aktiviti paparan papan pemuka dalam audit trail).

## 4.2.4 Gambarajah Hubungan Entiti (ganti perenggan 2)

> Pangkalan data PENJAGA mengandungi 25 jadual. Lapan jadual teras ialah tbl_pengguna, tbl_peranan, tbl_laporan_harian, tbl_hasil_nlp, tbl_kategori_insiden, tbl_tindakan_susulan, tbl_notifikasi dan tbl_audit_trail. Jadual sokongan merangkumi pos kawalan dan keperluan pos (tbl_pos_kawalan, tbl_keperluan_pos), penjadualan dan kehadiran (tbl_jadual_mingguan, tbl_jadual_bertugas, tbl_kehadiran_tugas), senarai semak (tbl_checklist, tbl_jawapan_checklist), tindakan susulan (tbl_progress_tindakan), baris gilir dan pembelajaran model (tbl_job_nlp, tbl_model_labels, tbl_model_training_runs) serta lokasi 3D (tbl_lokasi_3d).

*(Kemas kini Rajah 4.3 sekurang-kurangnya dengan tbl_pos_kawalan, tbl_jadual_bertugas dan tbl_kehadiran_tugas, dan gunakan nama Malay tbl_ secara konsisten.)*

## 4.3.2 Reka Bentuk Pangkalan Data (pembetulan medan)

- **iii. tbl_laporan_harian:** ganti `lokasi_bertugas` dengan `id_pos` (FK kepada tbl_pos_kawalan); tambah `perlu_tindakan_susulan`.
- **iv. tbl_hasil_nlp:** `id_nlp, id_laporan, teks_diproses, kata_kunci_dikesan, kategori_dikesan, skor_risiko, tahap_risiko, ringkasan_automatik, tahap_keyakinan, metadata, tarikh_analisis`. Buang `skor_sentimen` (lajur wujud tetapi tidak digunakan).
- **v. tbl_kategori_insiden:** tambah `kata_kunci_rujukan`.
- **vii. tbl_notifikasi:** tambah `id_laporan, id_tindakan, tahap_keutamaan`.
- **viii. tbl_audit_trail:** `id_audit, id_pengguna, modul_sistem, jenis_aktiviti, penerangan_aktiviti, rekod_terlibat, nilai_lama, nilai_baharu, alamat_ip, peranti_pengguna, status_aktiviti, tarikh_masa_aktiviti`.

**Jadual 4.12 Jadual Pengguna** (nombor jadual asal tersalah: "Jadual 0.12"):

| Atribut | Jenis Data | Saiz | Kunci | Penerangan |
|---|---|---|---|---|
| id_pengguna | SERIAL | – | PK | ID unik pengguna |
| id_peranan | INT | – | FK | Rujukan kepada tbl_peranan |
| nama_penuh | VARCHAR | 120 | – | Nama penuh pengguna |
| no_kad_pengenalan | VARCHAR | 20 | – | Nombor kad pengenalan |
| no_telefon | VARCHAR | 30 | – | Nombor telefon |
| emel | VARCHAR | 120 | UK | Alamat emel |
| nama_pengguna | VARCHAR | 60 | UK | Nama log masuk |
| kata_laluan | TEXT | – | – | Cincangan bcrypt kata laluan |
| status_akaun | VARCHAR | 20 | – | Aktif / Tidak Aktif |
| kata_laluan_ditukar | TIMESTAMPTZ | – | – | Masa kata laluan terakhir ditukar |
| tarikh_dicipta | TIMESTAMP | – | – | Tarikh akaun diwujudkan |
| tarikh_kemaskini | TIMESTAMP | – | – | Tarikh kemas kini terakhir |

## 4.3.1 Seni Bina Sistem (ganti ayat tentang modul NLP)

> Sistem dibangunkan menggunakan React dan Vite bagi lapisan hadapan, Node.js dan Express.js bagi API, serta PostgreSQL sebagai pangkalan data berpusat. Pengesahan menggunakan JSON Web Token (JWT) dan kata laluan disimpan sebagai cincangan bcrypt. Modul NLP berjalan dalam pelayan aplikasi sebagai pemproses latar belakang: laporan disimpan terlebih dahulu bersama tugas analisis, kemudian dianalisis secara tak segerak supaya kegagalan analisis tidak menyebabkan laporan hilang. Sistem boleh dihoskan menggunakan Docker Compose (PostgreSQL, API dan Nginx) atau dengan lapisan hadapan di Vercel.

## 4.1.3 Jadual 4.5 (tambah keperluan perisian pembangunan)

| Aspek | Keperluan |
|---|---|
| Lapisan hadapan | React 19, Vite, Tailwind CSS, Recharts, three.js |
| Pelayan | Node.js 24, Express.js |
| Pangkalan data | PostgreSQL 17 |
| Pengesahan | JWT, bcrypt |
| Pengujian | Node test runner, Playwright |
| Pengehosan | Docker Compose / Vercel |
