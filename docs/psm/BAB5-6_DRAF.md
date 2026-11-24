# Draf Bab 5 dan Bab 6 — PENJAGA

> **Nota format (UTHM Report Writing Guideline 2024, AITCS 2025):** setiap bab dimulakan pada halaman baharu; tajuk dan sub-tajuk bernombor; jarak baris 1.5; kapsyen jadual **di atas** jadual (Jadual 5.1, tanpa noktah di hujung), kapsyen rajah **di bawah** rajah (Rajah 5.1); jadual yang bersambung ditanda "Jadual 5.x (sambungan)"; hanya garis mendatar dalam jadual; rujukan gaya APA edisi ke-7.
>
> **Penanda dalam draf ini:**
> - **[MASUKKAN]**: data yang belum dikumpul (ujian penerimaan pengguna, UAT) atau angka yang perlu dijalankan semula. Jangan isi dengan anggaran.
> - **[RAJAH]**: tangkapan skrin atau gambar rajah yang perlu disediakan. Tangkapan skrin sintetik sedia ada disenaraikan dalam `docs/psm/evidence/SCREENSHOT_INDEX.md`.
> - **[SEMAK]**: perkara yang perlu disahkan oleh pelajar atau penyelia.
>
> **Sumber angka:** `docs/testing/AUTOMATIC_CLASSIFICATION.md`, `backend/ml/model/classification-training-report.json`, `docs/testing/evidence/classification-2000-evaluation.json`, `docs/psm/FINAL_TESTING_REPORT.md`, `docs/psm-evaluation/FUNCTIONAL_TEST_RESULTS.md` dan `SECURITY_TEST_REPORT.md`. Bilangan ujian pelayan (147) dan ujian logik bangunan (33) diambil daripada larian November 2026; beberapa dokumen Oktober 2026 masih mencatat angka lama (33 dan 10). Jalankan semula semua suite sebelum penyerahan dan kemas kini Jadual 5.2.

---

# BAB 5

# HASIL DAN PERBINCANGAN

## 5.1 Pengenalan

Bab ini membentangkan hasil pembangunan Sistem Pengurusan Operasi Keselamatan Berasaskan Kepintaran Buatan (PENJAGA) serta keputusan pengujian yang dijalankan. Perbincangan disusun mengikut tiga objektif projek. Bahagian 5.2 menerangkan persekitaran pembangunan. Bahagian 5.3 membentangkan modul yang telah dibangunkan bagi menjawab objektif pertama dan kedua. Bahagian 5.4 hingga 5.8 membentangkan keputusan pengujian fungsi, penilaian model analisis laporan, pengujian keselamatan, pengujian prestasi dan pengujian penerimaan pengguna bagi menjawab objektif ketiga. Bahagian 5.9 membincangkan dapatan berbanding objektif dan sistem sedia ada yang dikaji dalam Bab 2, dan Bahagian 5.10 meringkaskan bab ini.

## 5.2 Persekitaran Pembangunan

Sistem dibangunkan sebagai aplikasi web pelanggan-pelayan tiga lapisan: lapisan hadapan React, pelayan aplikasi Express dan pangkalan data PostgreSQL. Jadual 5.1 menyenaraikan perisian dan peralatan yang digunakan.

Jadual 5.1: Persekitaran pembangunan sistem PENJAGA

| Komponen | Teknologi |
|---|---|
| Lapisan hadapan | React 19, Vite 8, Tailwind CSS 3, React Router 7, Recharts, three.js (@react-three/fiber) |
| Pelayan aplikasi | Node.js 24, Express.js 4 |
| Pangkalan data | PostgreSQL 17 semasa pembangunan tempatan; imej PostgreSQL 16 dalam Docker Compose |
| Pengesahan dan keselamatan | JSON Web Token (JWT, HS256), bcrypt, Helmet, pengehad kadar permintaan |
| Analisis laporan | Model Multinomial Naive Bayes dan peraturan kontekstual (JavaScript, dijalankan secara tempatan); semakan Gemini secara pilihan |
| Pengujian | Node.js test runner, Playwright (pelayar Microsoft Edge dan Chromium) |
| Pengehosan | Docker Compose (PostgreSQL, API, Nginx) atau Vercel bagi lapisan hadapan |
| Kawalan versi dan integrasi berterusan | Git dan GitHub Actions |

Perkakasan pembangunan ialah komputer riba Windows 11 dengan pemproses Intel Core i7-12650H (16 pemproses logik). Pangkalan data ujian dijalankan sebagai pangkalan data PostgreSQL tempatan yang berasingan daripada pangkalan data operasi. Ujian integrasi pula mencipta skema sementara bagi setiap larian dan memadamkannya selepas itu. Dengan cara ini, data sintetik ujian tidak bercampur dengan rekod sebenar.

Perubahan struktur pangkalan data diurus melalui fail migrasi bernombor (`001` hingga `010`). Setiap migrasi yang telah digunakan direkodkan bersama nilai semak SHA-256, dan pelari migrasi menolak sebarang fail yang telah diubah selepas digunakan. Pendekatan ini memastikan pangkalan data pembangunan, ujian dan pengehosan mempunyai struktur yang sama.

## 5.3 Hasil Pembangunan Sistem

Bahagian ini menerangkan modul yang telah dibangunkan. Setiap modul dikawal oleh peranan pengguna: Pengawal Keselamatan, Ketua Pengawal atau Pentadbir Sistem. Kawalan akses dilaksanakan di pelayan pada setiap permintaan, dan bukan hanya pada antara muka. Jadual 5.2 meringkaskan capaian setiap peranan.

Jadual 5.2: Capaian modul mengikut peranan

| Modul | Pengawal Keselamatan | Ketua Pengawal | Pentadbir Sistem |
|---|---|---|---|
| Jadual bertugas | Lihat jadual sendiri; daftar masuk dan keluar | Bina dan ubah jadual (kecuali minggu dikunci) | Bina, sahkan, kunci, import dan salin jadual |
| Laporan harian | Hantar dan lihat laporan sendiri | Semak, lulus atau tolak; sahkan kategori | Pantau semua laporan |
| Tindakan susulan | – | Rekod kemajuan | Cipta, kemas kini status dan tutup |
| Papan pemuka dan Pusat Kawalan 3D | Papan pemuka pengawal | Papan pemuka analitik dan 3D | Papan pemuka analitik dan 3D |
| Pengguna, pos dan audit trail | – | – | Urus pengguna dan pos; lihat dan eksport audit |

### 5.3.1 Modul Log Masuk dan Pengurusan Pengguna

Pengguna log masuk menggunakan nama pengguna dan kata laluan. Nama pengguna dipadankan tanpa mengira huruf besar atau kecil. Pelayan mengesahkan kata laluan yang disimpan sebagai cincangan bcrypt, kemudian mengeluarkan token JWT yang sah selama 12 jam. Pada setiap permintaan, sistem memuat semula status akaun dan peranan semasa daripada pangkalan data. Oleh itu, akaun yang dinyahaktifkan tidak lagi boleh digunakan walaupun tokennya belum tamat, dan perubahan peranan berkuat kuasa serta-merta. Apabila pengguna menukar kata laluan, sistem merekod masa pertukaran dan menolak semua token yang dikeluarkan sebelum masa itu, lalu mengeluarkan token baharu bagi sesi semasa. Pengguna kemudian dialihkan ke papan pemuka mengikut peranan. Sistem meminta pengesahan sebelum log keluar.

Pentadbir Sistem mendaftar pengguna baharu, menetapkan peranan, menyahaktifkan akaun dan mengurus pos kawalan, termasuk keperluan bilangan pengawal bagi setiap pos dan syif. Akaun pentadbir pertama dalam persekitaran pengehosan dicipta melalui skrip *bootstrap* dan bukan melalui data demo.

**[RAJAH]** Rajah 5.1: Antara muka log masuk
**[RAJAH]** Rajah 5.2: Antara muka pengurusan pengguna

### 5.3.2 Modul Penjadualan dan Kehadiran

Ketua Pengawal dan Pentadbir Sistem membina jadual bertugas mingguan. Kalendar mingguan memaparkan kekurangan pengawal bagi setiap hari berdasarkan keperluan bilangan pengawal setiap pos dan syif. Paparan harian mengumpulkan syif di bawah pos masing-masing, dan pengguna boleh mencari pos atau bangunan serta menapis pos yang masih memerlukan pengawal.

Sistem menyediakan beberapa cara untuk mengisi jadual:

1. **Tugasan tunggal.** Pengguna memilih pos dan syif, kemudian memilih pengawal. Semakan pertindihan dijalankan secara automatik sebelum tugasan disimpan.
2. **Isi kekosongan harian.** Beberapa pengawal boleh ditugaskan ke beberapa pos dan syif serentak. Jika satu tugasan bertindih, keseluruhan kumpulan dibatalkan supaya jadual tidak tinggal separa lengkap.
3. **Salin minggu.** Jadual satu minggu disalin ke minggu berikutnya selepas pratonton, dengan had 500 tugasan bagi setiap salinan.
4. **Import fail.** Pentadbir boleh mengimport jadual daripada fail CSV, atau memuat naik jadual dalam format PDF sebagai rujukan.

Semakan pertindihan mengambil kira syif malam yang merentasi tengah malam. Hanya akaun aktif berperanan Pengawal Keselamatan boleh ditugaskan, dan hanya ke pos yang aktif. Setiap minggu jadual mempunyai status Draf, Disahkan atau Dikunci. Ketua Pengawal tidak boleh mengubah minggu yang telah dikunci oleh Pentadbir Sistem. Apabila jadual yang bukan lagi draf berubah, pengawal yang terlibat menerima notifikasi.

Pengawal melihat syif semasa dan akan datang dalam *Jadual Bertugas Saya*, termasuk penunjuk syif malam, dan merekod daftar masuk serta daftar keluar bagi tugasan pada hari semasa.

**[RAJAH]** Rajah 5.3: Kalendar jadual mingguan dan kekurangan harian
**[RAJAH]** Rajah 5.4: Dialog *Isi kekosongan harian* (paparan telefon)
**[RAJAH]** Rajah 5.5: Paparan jadual pengawal dan daftar masuk

### 5.3.3 Modul Laporan Harian Digital

Pengawal menghantar laporan melalui borang yang mesra peranti mudah alih. Borang merangkumi pos kawalan, syif, tarikh dan masa, naratif laporan, senarai semak rondaan dan sehingga enam lampiran bukti (maksimum 8 MB setiap fail). Jenis setiap lampiran ditentukan berdasarkan tandatangan fail sebenar, bukan sambungan nama fail. Jika borang ditolak, lampiran yang telah dimuat naik dipadamkan.

Laporan disimpan bersama satu tugas analisis dalam satu transaksi pangkalan data. Tugas ini dikenal pasti melalui cincangan input (naratif, pos dan jawapan penjelasan). Oleh itu, laporan tidak hilang walaupun analisis gagal atau pelayan dimulakan semula, dan laporan yang sama tidak dianalisis berulang kali. Selepas dihantar, borang memaparkan status analisis dan mengemas kini ringkasan apabila analisis selesai.

**[RAJAH]** Rajah 5.6: Borang laporan harian (paparan telefon)

### 5.3.4 Modul Analisis Laporan (NLP Hibrid)

Pemproses latar belakang yang berjalan dalam proses pelayan mengambil tugas analisis daripada baris gilir dan menganalisis setiap laporan dalam lima peringkat:

1. **Prapemprosesan.** Teks dibersihkan, ditukar kepada huruf kecil dan ditokenkan. Tokenisasi menyokong teks Bahasa Melayu dan Bahasa Inggeris.
2. **Pengelasan topik.** Model Multinomial Naive Bayes berasaskan kiraan perkataan mencadangkan kategori insiden.
3. **Analisis konteks peristiwa.** Peraturan kontekstual dan kata kunci yang dikonfigurasi dalam pangkalan data membahagikan naratif kepada peristiwa, kemudian menentukan status setiap peristiwa: dilaporkan, disyaki, dinafikan (contohnya "tiada kebakaran"), latihan (*drill*) atau tidak jelas. Setiap bukti disimpan bersama kedudukan petikan dalam teks asal supaya penyemak boleh melihat sumbernya.
4. **Penilaian risiko.** Skor risiko 0–100 dikira dan dipetakan kepada tahap risiko: Rendah (0–30), Sederhana (31–60), Tinggi (61–80) dan Kritikal (81–100).
5. **Penyimpanan dan amaran.** Keputusan, tahap risiko laporan dan notifikasi disimpan dalam satu transaksi. Notifikasi dihantar kepada Ketua Pengawal sekiranya risiko Tinggi atau Kritikal, dan notifikasi yang berulang bagi laporan yang sama disekat.

Pelayan turut menyokong jawapan penjelasan (contohnya lokasi sebenar peristiwa) yang disimpan berasingan daripada naratif asal dan dipertimbangkan dalam analisis. Pembantu analisis interaktif pada borang laporan telah dikeluarkan daripada antara muka supaya borang kekal ringkas, maka analisis kini berjalan sepenuhnya selepas laporan dihantar. **[SEMAK]** sama ada ciri ini perlu disebut dalam laporan.

**Data latihan.** Model dilatih menggunakan 2,000 contoh laporan sintetik yang seimbang (250 contoh bagi setiap kategori) merentasi lapan kategori: Rondaan Biasa, Pencerobohan, Kebakaran, Pergaduhan, Kehilangan Aset, Vandalisme, Keselamatan Fizikal dan Kerosakan Kemudahan. Korpus dibina daripada 64 laporan benih, 80 senario asal dan 168 senario tambahan yang ditulis oleh pembangun, serta variasi ayatnya. Sebanyak 1,576 contoh digunakan untuk latihan dan 424 contoh diasingkan untuk penilaian. Pembahagian dibuat mengikut kumpulan, iaitu variasi daripada senario yang sama kekal dalam satu partisi. Ciri unigram dan bigram tersedia, tetapi carian 36 tetapan memilih pelicinan α = 0.05, pemberat bigram 0 (inferens unigram) dan kebarangkalian prior empirik.

**Pembelajaran berterusan.** Ketua Pengawal boleh mengesahkan atau membetulkan kategori secara eksplisit melalui fungsi *Sahkan kategori*, berasingan daripada keputusan meluluskan laporan, dan memilih sama ada label itu boleh digunakan untuk latihan. Apabila sekurang-kurangnya 20 kumpulan label baharu yang layak terkumpul, model calon dilatih dalam *worker thread* yang berasingan supaya permintaan pengguna tidak tersekat. Model calon hanya diaktifkan jika skor F1 makro, ketepatan dan dapatan semula setiap kategori tidak menurun berbanding model semasa, dan jika ia tidak menghasilkan risiko Tinggi atau Kritikal pada kes penafian dan latihan. Data demo dan ramalan model sendiri tidak pernah digunakan sebagai label.

**Semakan AI luaran.** Semakan tambahan oleh model bahasa Gemini adalah pilihan dan bersifat nasihat sahaja. Ia dijalankan dalam baris gilir yang berasingan, tidak boleh mengubah skor risiko atau keputusan semakan, dan tidak boleh menyekat amaran berisiko tinggi. Naratif laporan dianggap sebagai data yang tidak dipercayai, jadi arahan yang terkandung dalam teks laporan tidak dilaksanakan.

**[RAJAH]** Rajah 5.7: Seni bina saluran analisis laporan (laporan → baris gilir → pemproses → keputusan dan notifikasi)
**[RAJAH]** Rajah 5.8: Ringkasan kategori dan risiko dalam paparan laporan

### 5.3.5 Modul Semakan Laporan dan Tindakan Susulan

Ketua Pengawal menyemak laporan asal bersama cadangan kategori, tahap risiko dan petikan bukti. Beliau kemudian meluluskan atau menolak laporan dengan ulasan, mengesahkan atau membetulkan kategori, dan memutuskan secara eksplisit sama ada tindakan susulan diperlukan. Keputusan ini tidak bergantung kepada tahap risiko: laporan berisiko rendah boleh memerlukan tindakan, manakala laporan berisiko tinggi boleh ditutup tanpa tindakan. Semakan manusia tetap boleh dibuat walaupun analisis automatik tidak tersedia. Status laporan disemak semula semasa keputusan disimpan untuk mengelakkan dua keputusan yang bertindih.

Laporan yang diluluskan dan memerlukan tindakan dimasukkan ke dalam senarai calon tindakan, dan Pentadbir Sistem dimaklumkan. Pentadbir Sistem mencipta tindakan susulan rasmi, menetapkan pegawai yang bertanggungjawab, mengemas kini status (Baru, Dalam Tindakan, Selesai) dan boleh meminta kemas kini kemajuan. Ketua Pengawal merekod kemajuan tindakan bersama sehingga tiga lampiran. Tindakan ditutup oleh Pentadbir Sistem selepas kemajuan disemak.

**[RAJAH]** Rajah 5.9: Antara muka semakan laporan
**[RAJAH]** Rajah 5.10: Antara muka tindakan susulan

### 5.3.6 Modul Papan Pemuka, Notifikasi dan Pusat Kawalan 3D

Papan pemuka memaparkan jumlah laporan, laporan berisiko tinggi, laporan belum disemak, status tindakan dan trend mengikut tempoh. Pengguna boleh membandingkan tempoh semasa dengan tempoh sebelumnya serta menapis data mengikut tarikh, pos dan tahap risiko. Hanya hasil analisis terkini bagi setiap laporan dikira. Data papan pemuka boleh dieksport dalam format CSV, dan carta dalam format SVG.

Pusat Kawalan 3D memaparkan model luaran lapan bangunan dengan 15 pos kawalan rasmi. Apabila sesuatu pos dipilih, jadual, kehadiran, laporan dan tindakan berkaitan dipaparkan dalam panel sisi. Model dimuatkan satu demi satu dan disimpan dalam cache sesi untuk mengelakkan muat turun berulang. Antara muka ini menyokong sentuhan, papan kekunci dan tetapan pergerakan dikurangkan (*reduced motion*). Kedudukan penanda pos ialah anggaran visual dan bukan koordinat yang telah diukur.

Notifikasi dihantar kepada Ketua Pengawal bagi laporan berisiko tinggi, kepada Pentadbir Sistem apabila laporan memerlukan tindakan susulan, dan kepada pengawal apabila jadual yang telah diterbitkan berubah.

**[RAJAH]** Rajah 5.11: Papan pemuka analitik
**[RAJAH]** Rajah 5.12: Pusat Kawalan 3D dan panel data pos

### 5.3.7 Modul Audit Trail

Aktiviti penting direkod secara automatik, antaranya log masuk berjaya dan gagal, penghantaran dan semakan laporan, perubahan dan import jadual, penukaran kata laluan dan kemas kini tindakan. Pentadbir Sistem boleh menapis rekod audit mengikut julat tarikh dan mengeksportnya dalam format CSV (sehingga 10,000 baris bagi setiap eksport). Nilai yang bermula dengan aksara seperti `=`, `+`, `-` atau `@` diberi awalan supaya tidak dilaksanakan sebagai formula apabila dibuka dalam perisian hamparan.

**[RAJAH]** Rajah 5.13: Antara muka audit trail

## 5.4 Pengujian Fungsi

Pengujian fungsi dijalankan secara automatik pada tiga peringkat:

1. **Ujian unit** menguji logik terasing seperti pemprosesan teks, pengelasan, geometri bangunan dan penempatan penanda.
2. **Ujian integrasi** memanggil API sebenar dengan pengesahan JWT dan pangkalan data PostgreSQL. Setiap larian mencipta skema sementara, menjalankan semua migrasi ke dalamnya dan memadamkannya selepas selesai. Ujian aliran operasi menggunakan pemproses analisis latar belakang yang sebenar, bukan simulasi.
3. **Ujian pelayar** (Playwright) menguji aliran kerja melalui antara muka. Sebahagian suite memintas panggilan API dengan data tetap, manakala suite demo menggunakan pelayan dan pangkalan data demo yang berasingan.

Semua data ujian adalah sintetik. Jadual 5.3 meringkaskan keputusan.

Jadual 5.3: Ringkasan keputusan pengujian fungsi automatik

| Suite ujian | Arahan | Skop | Bilangan ujian | Lulus | Gagal |
|---|---|---|---:|---:|---:|
| Ujian pelayan | `npm run test:backend` | API, peranan, aliran laporan, NLP, pembelajaran automatik, penjadualan, pangkalan data, keselamatan | 147 | 147 | 0 |
| Ujian logik bangunan 3D | `npm run test:building` | Model, penanda, unjuran, penempatan pos | 33 | 33 | 0 |
| Ujian pelayar 3D | `npm run test:building:browser` | Paparan model, kamera, mod paparan, kegagalan WebGL, emulasi mudah alih | 18 | 18 | 0 |
| Ujian pelayar aliran demo | `npm run test:phase5:browser` | Log masuk sebenar, pertukaran akaun, sentuhan, penafian fail peribadi | 5 | 5 | 0 |
| Ujian kitar hayat operasi | `npm run test:phase6` | Jadual, kehadiran, laporan, semakan, tindakan, notifikasi; 17 tangkapan skrin | 2 | 2 | 0 |
| Ujian pelayar kebolehgunaan | `npm run test:phase8:browser` | Penjadualan, laporan, semakan dan paparan mudah alih | **[MASUKKAN]** | | |
| Semakan binaan | `npm run check` | *Lint*, semakan sintaks pelayan, binaan produksi | – | Lulus | – |

*Nota: Angka ujian pelayan dan ujian logik bangunan adalah daripada larian November 2026. Jalankan semula semua suite pada tarikh akhir penyerahan dan catat tarikh larian di bawah jadual.* **[MASUKKAN]** tarikh larian akhir.

### 5.4.1 Kecacatan yang Dikesan

Pengujian turut mengesan kecacatan yang kemudiannya dibaiki. Selaras dengan templat AITCS, ujian yang gagal pada mulanya dilaporkan dan tidak disembunyikan. Setiap pembaikan disertakan ujian regresi supaya kecacatan yang sama tidak berulang. Jadual 5.4 menyenaraikan kecacatan utama. Tahap keterukan P1 bermaksud kecacatan yang menjejaskan keselamatan data atau ketepatan rekod, manakala P2 bermaksud kecacatan yang menjejaskan kebolehgunaan atau prestasi.

Jadual 5.4: Kecacatan yang dikesan dan dibaiki melalui pengujian

| ID | Tahap | Kecacatan | Pembaikan |
|---|---|---|---|
| FIX-01 | P1 | Cache data kekal apabila pengguna lain log masuk pada pelayar yang sama | Cache baharu bagi setiap akaun dan peranan; ujian pertukaran dua pengawal |
| FIX-02 | P1 | Identiti tersimpan yang rosak menyebabkan ralat | Identiti yang tidak sah dibersihkan dan pengguna dikembalikan ke log masuk |
| FIX-03 | P1 | Laporan, tindakan dan papan pemuka mengira semua hasil analisis lama bagi satu laporan | Hanya hasil analisis terkini digunakan |
| FIX-04 | P1 | Kegagalan sambungan pangkalan data tidak dikendalikan | Sambungan diperoleh dalam blok kawalan ralat; respons terkawal |
| FIX-05 | P1 | Kebenaran muat turun lampiran berdasarkan padanan sebahagian nama; jenis fail daripada nama fail | Padanan rujukan penuh dan jenis fail berdasarkan kandungan |
| FIX-06 | P1 | Pelayan pembangunan boleh menyajikan fail peribadi pelayan | Laluan peribadi ditolak (403) |
| FIX-07 | P1 | Paparan 3D tidak dikemas kini selepas pergerakan kamera tertentu | Paparan dipaksa dikemas kini selepas setiap perubahan kamera |
| FIX-08 | P2 | Model 3D dimuat turun berulang kali apabila halaman dilawati semula | Permintaan dikongsi dan cache sesi |
| FIX-09 | P2 | Peta bayang dikira semula pada setiap pergerakan kamera | Peta bayang dikira sekali; panggilan lukisan berkurang separuh |
| FIX-10 | P2 | Lampiran kekal tersimpan apabila borang ditolak; ralat saiz fail memberi respons 500 | Pembersihan fail dan respons 400/413 |
| FIX-11 | P2 | Papan pemuka pengawal merujuk medan yang tidak wujud | Medan yang betul digunakan |
| FIX-12 | P2 | Pratonton lampiran lewat boleh membocorkan memori pelayar | Permintaan dibatalkan apabila komponen ditutup |
| FIX-13 | P1/P2 | Nasihat keselamatan kebergantungan dan ketidakserasian pustaka dengan React 19 | Pustaka dikemas kini; kebergantungan tidak digunakan dibuang |
| SEC-1 | P1 | Tugasan jadual boleh diberikan kepada akaun bukan pengawal atau pos tidak aktif | Semakan peranan dan status pada semua laluan penjadualan |
| SEC-2 | P1 | Token lama kekal sah selepas kata laluan ditukar | Token sebelum pertukaran ditolak; token baharu dikeluarkan |

Selain kecacatan sistem, beberapa ujian sendiri didapati salah pada larian pertama, contohnya URL jadual yang tidak tepat dan stub sambungan pangkalan data yang tidak mematuhi antara muka pustaka `pg`. Ujian tersebut dibetulkan, dan hanya larian yang lengkap selepas pembetulan dilaporkan.

### 5.4.2 Pemetaan Keperluan Fungsian

Jadual 5.5 memetakan keperluan fungsian dalam Bab 4 kepada kes ujian dan hasilnya.

Jadual 5.5: Pemetaan keperluan fungsian kepada hasil pengujian

| Keperluan | Kes ujian | Jenis ujian | Status |
|---|---|---|---|
| FR01 Pengesahan dan kawalan akses berasaskan peranan | Token tamat, salah tandatangan atau format salah ditolak; akaun tidak aktif ditolak; peranan disemak pada setiap laluan; pengawal hanya melihat rekod sendiri | Integrasi, pelayar | Lulus |
| FR02 Laporan harian dan analisis NLP | Laporan dan lampiran dihantar; tugas analisis dijalankan oleh pemproses latar belakang; kategori, risiko dan notifikasi disimpan | Integrasi (aliran operasi), unit | Lulus |
| FR03 Semakan dan pengesahan laporan | Ketua Pengawal meluluskan atau menolak; pengesahan kategori berasingan; keputusan bertindih dihalang; pentadbir tidak boleh meluluskan | Integrasi, pelayar | Lulus |
| FR04 Tindakan susulan | Pentadbir mencipta tindakan; Ketua Pengawal merekod kemajuan; tindakan pendua dihalang; peranan lain ditolak | Integrasi | Lulus |
| FR05 Papan pemuka | Perbandingan tempoh, hari tanpa data, penapis pos dan risiko; hanya analisis terkini dikira | Integrasi, pelayar | Lulus |
| FR06 Audit trail | Rekod aktiviti, penapisan dan eksport CSV mengikut julat tarikh; perlindungan formula | Integrasi | Lulus |
| Penjadualan dan kehadiran | Pertindihan syif malam, pembatalan kumpulan, salinan minggu, kekosongan harian, minggu dikunci; daftar masuk dan keluar oleh pemilik tugasan sahaja | Integrasi, pelayar | Lulus |

**[SEMAK]** Pastikan kod dan nama keperluan (FR01–FR06) sepadan dengan Bab 4 yang telah dibetulkan.

## 5.5 Penilaian Model Analisis Laporan

### 5.5.1 Kaedah Penilaian

Penilaian dibuat pada dua set data yang berasingan:

1. **Set pembangunan:** 424 contoh daripada korpus sintetik yang tidak digunakan dalam latihan. Variasi daripada senario yang sama dikekalkan dalam satu partisi bagi mengelakkan kebocoran data. Set ini menilai model Naive Bayes sahaja.
2. **Set cabaran:** 40 kes sintetik yang ditulis secara berasingan dan tidak pernah digunakan dalam latihan atau pemilihan tetapan. Set ini menilai keseluruhan saluran analisis (model dan peraturan kontekstual). Sebanyak 26 kes berlabel kategori digunakan untuk menilai kategori, manakala kesemua 40 kes digunakan untuk menilai status peristiwa. Set ini termasuk ayat penafian, latihan, insiden disyaki dan laporan yang tidak jelas.

Metrik utama ialah skor F1 makro, iaitu purata skor F1 bagi setiap kategori. Metrik ini dipilih kerana ia memberi pemberat yang sama kepada setiap kategori. Kepersisan (*precision*) dan dapatan semula (*recall*) dikira bagi setiap kategori *c*:

Kepersisan = TP / (TP + FP)  (Persamaan 5.1)

Dapatan semula = TP / (TP + FN)  (Persamaan 5.2)

F1 = 2 × (Kepersisan × Dapatan semula) / (Kepersisan + Dapatan semula)  (Persamaan 5.3)

dengan TP ialah positif benar, FP ialah positif palsu dan FN ialah negatif palsu.

### 5.5.2 Keputusan Model Naive Bayes pada Set Pembangunan

Model mencapai ketepatan 78.3% dan F1 makro 78.2% pada 424 contoh pembangunan. Jadual 5.6 menunjukkan prestasi bagi setiap kategori, dan Jadual 5.7 menunjukkan matriks kekeliruan.

Jadual 5.6: Prestasi model Naive Bayes mengikut kategori (set pembangunan, n = 424)

| Kategori | Sokongan | Kepersisan (%) | Dapatan semula (%) | F1 (%) |
|---|---:|---:|---:|---:|
| Kebakaran | 51 | 81.0 | 100.0 | 89.5 |
| Kehilangan Aset | 60 | 85.7 | 80.0 | 82.8 |
| Kerosakan Kemudahan | 54 | 97.9 | 85.2 | 91.1 |
| Keselamatan Fizikal | 52 | 70.7 | 55.8 | 62.4 |
| Pencerobohan | 48 | 57.4 | 72.9 | 64.2 |
| Pergaduhan | 50 | 70.4 | 76.0 | 73.1 |
| Rondaan Biasa | 57 | 70.7 | 71.9 | 71.3 |
| Vandalisme | 52 | 100.0 | 84.6 | 91.7 |
| **Purata makro** | 424 | | | **78.2** |

Jadual 5.7: Matriks kekeliruan model Naive Bayes (baris: label sebenar; lajur: ramalan)

| Sebenar \ Ramalan | KB | KA | KK | KF | PC | PG | RB | VD |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Kebakaran (KB) | **51** | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Kehilangan Aset (KA) | 3 | **48** | 0 | 0 | 0 | 0 | 9 | 0 |
| Kerosakan Kemudahan (KK) | 0 | 0 | **46** | 0 | 8 | 0 | 0 | 0 |
| Keselamatan Fizikal (KF) | 0 | 7 | 0 | **29** | 8 | 0 | 8 | 0 |
| Pencerobohan (PC) | 0 | 0 | 1 | 12 | **35** | 0 | 0 | 0 |
| Pergaduhan (PG) | 9 | 1 | 0 | 0 | 2 | **38** | 0 | 0 |
| Rondaan Biasa (RB) | 0 | 0 | 0 | 0 | 8 | 8 | **41** | 0 |
| Vandalisme (VD) | 0 | 0 | 0 | 0 | 0 | 8 | 0 | **44** |

Kategori Kebakaran, Vandalisme dan Kerosakan Kemudahan mencapai F1 melebihi 89%, kerana kosa kata kategori ini agak khusus (contohnya "asap", "api", "conteng", "rosak"). Prestasi terendah ialah Keselamatan Fizikal (62.4%) dan Pencerobohan (64.2%). Matriks kekeliruan menunjukkan bahawa kedua-dua kategori ini saling dikelirukan (12 laporan Pencerobohan diramal sebagai Keselamatan Fizikal, dan 8 sebaliknya). Hal ini dijangka kerana kedua-duanya melibatkan pintu, pagar dan akses, dan perbezaannya bergantung kepada konteks, bukan kepada perkataan tunggal. Kekeliruan Kehilangan Aset dengan Rondaan Biasa pula berlaku apabila laporan rondaan menyebut pemeriksaan aset.

Set pembangunan ini turut digunakan untuk memilih tetapan model daripada 36 kombinasi. Oleh itu, skor 78.2% cenderung optimistik dan bukan anggaran tanpa bias bagi data baharu.

### 5.5.3 Keputusan Saluran Hibrid pada Set Cabaran

Jadual 5.8 membandingkan saluran hibrid dengan garis dasar padanan kata kunci pada kes cabaran yang sama.

Jadual 5.8: Perbandingan saluran hibrid dengan padanan kata kunci (set cabaran sintetik)

| Penilaian | Sampel | Padanan kata kunci | Saluran hibrid |
|---|---:|---:|---:|
| Ketepatan kategori | 26 | 61.5% | 96.2% |
| F1 makro kategori | 26 | 61.5% | 95.7% |
| Ketepatan status peristiwa | 40 | – | 90.0% |
| F1 makro status peristiwa | 40 | – | 86.3% |
| Keluaran risiko Tinggi/Kritikal pada kes penafian dan latihan | 8 | – | 0 daripada 8 |

Garis dasar kata kunci gagal sepenuhnya bagi kategori Kerosakan Kemudahan (F1 0%) dan cenderung meramalkan Rondaan Biasa apabila tiada kata kunci yang jelas. Saluran hibrid hanya tersilap satu kes, iaitu satu laporan Kerosakan Kemudahan yang diramal sebagai Vandalisme. Daripada 40 keputusan, 25 dibuat oleh model terlatih, 7 oleh peraturan konteks dan kata kunci, dan 8 ditanda tidak diketahui untuk semakan manusia. Oleh itu, skor 95.7% ialah skor keseluruhan saluran dan tidak boleh dikaitkan dengan model Naive Bayes sahaja.

Jadual 5.9: Prestasi pengenalpastian status peristiwa (n = 40)

| Status | Sokongan | Kepersisan (%) | Dapatan semula (%) | F1 (%) |
|---|---:|---:|---:|---:|
| Dilaporkan | 26 | 95.8 | 88.5 | 92.0 |
| Disyaki | 2 | 100.0 | 50.0 | 66.7 |
| Dinafikan | 6 | 100.0 | 100.0 | 100.0 |
| Latihan | 2 | 100.0 | 100.0 | 100.0 |
| Tidak jelas | 4 | 57.1 | 100.0 | 72.7 |

Kesemua ayat penafian dan latihan dikenal pasti dengan betul. Kesilapan utama ialah tiga laporan sebenar yang dikelaskan sebagai tidak jelas. Kesilapan ini bersifat berhati-hati, kerana laporan tersebut masih dihantar untuk semakan manusia dan tidak diabaikan. Satu insiden disyaki pula dikelaskan sebagai dilaporkan, iaitu kesilapan yang meningkatkan amaran dan bukan mengurangkannya.

Dapatan lain daripada set cabaran:
- Kesemua 92 petikan bukti yang disemak merujuk kepada kedudukan yang sah dalam teks asal (100%).
- Cadangan lokasi bagi 13 kes berlabel sepadan sepenuhnya dengan zon yang diluluskan.
- Masa analisis tempatan bagi satu laporan: median 1.54 ms, persentil ke-95 4.19 ms dan maksimum 61.5 ms (termasuk panggilan pertama).

### 5.5.4 Analisis Amaran dan Regresi

Saluran analisis tidak menghasilkan risiko Tinggi atau Kritikal bagi lapan kes penafian dan latihan. Walau bagaimanapun, polisi notifikasi konservatif sengaja mengekalkan perlindungan berasaskan kata kunci: amaran dihantar jika garis dasar kata kunci **atau** analisis menilai risiko Tinggi/Kritikal. Dalam simulasi, polisi ini masih akan menghantar amaran bagi lima daripada lapan kes tersebut. Reka bentuk ini memilih untuk menerima sebahagian amaran palsu supaya insiden sebenar tidak terlepas. Oleh itu, projek ini tidak mendakwa bahawa semua amaran palsu telah dihapuskan.

Pada subset tetap 276 contoh daripada keluarga senario tambahan, model terdahulu mencapai F1 makro 75.2%, manakala model yang dilatih dengan korpus 2,000 contoh mencapai 68.6%. Penurunan ini dilaporkan secara terbuka. Ia menunjukkan bahawa menambah variasi sintetik tidak semestinya meningkatkan generalisasi, dan menyokong keperluan semakan regresi sebelum model baharu diaktifkan (Bahagian 5.3.4).

### 5.5.5 Batasan Penilaian

Semua data penilaian adalah sintetik dan dilabel oleh pembangun tanpa pengesahan pakar domain. Set cabaran juga kecil (26 kes berlabel kategori, dengan dua hingga empat kes bagi setiap kategori), maka perbezaan satu kes mengubah skor dengan ketara. Keputusan ini ialah bukti pembangunan dan bukan ketepatan operasi sebenar. Skor keyakinan model juga tidak dikalibrasi dan tidak boleh ditafsirkan sebagai kebarangkalian sebenar sesuatu insiden. Penilaian prestasi semakan Gemini tidak dijalankan.

## 5.6 Pengujian Keselamatan

Pengujian keselamatan dijalankan secara automatik terhadap API dan antara muka menggunakan data sintetik, bersama audit kebergantungan. Jadual 5.10 meringkaskan kawalan yang disahkan.

Jadual 5.10: Keputusan pengujian keselamatan

| Kategori | Kes ujian | Keputusan |
|---|---|---|
| Pengesahan | Token tiada, tamat, salah tandatangan, subjek tidak sah dan bukan Bearer | Ditolak (401) |
| Pengesahan | Akaun dinyahaktifkan; token sebelum pertukaran kata laluan | Ditolak (401) |
| Kebenaran | Pengawal mengakses audit, pengguna, pos atau data pengurusan 3D | Ditolak (403) |
| Kebenaran | Pengawal membaca laporan atau lampiran pengawal lain | Ditolak; pengawal hanya melihat rekod sendiri |
| Kebenaran | Pentadbir cuba meluluskan laporan; Ketua Pengawal cuba mengubah status tindakan | Ditolak (403) |
| Pengesahan input | Tarikh, ID, zon, risiko, status, kategori dan nombor halaman tidak sah; pengecam berbentuk SQL; JSON rosak | Ditolak (400); semua pertanyaan SQL berparameter |
| Muat naik fail | Kandungan tidak sepadan dengan jenis, fail melebihi saiz, rujukan dengan awalan yang sama | Ditolak (400/413); jenis fail ditentukan daripada kandungan |
| Pelayan pembangunan | Laluan fail peribadi (`backend/`, `.env`, `docs/`) | Ditolak (403) |
| Konfigurasi produksi | Rahsia JWT lemah atau contoh; asal (*origin*) yang tidak dibenarkan | Pelayan enggan bermula; asal ditolak (403) |
| Pengepala HTTP | Helmet, `no-store` pada API dan muat naik, `nosniff` | Disahkan |
| Ralat | Kegagalan pangkalan data yang disimulasikan | Mesej ralat tetap tanpa butiran sambungan |

Jadual 5.11: Keputusan audit kebergantungan (npm audit)

| Projek | Sebelum | Selepas |
|---|---|---|
| Lapisan hadapan | 16 nasihat (10 tinggi, 5 sederhana, 1 rendah) | 0 |
| Pelayan | 11 nasihat (2 kritikal, 5 tinggi, 4 sederhana) | 0 |

Keputusan audit menggambarkan keadaan pada masa ujian dijalankan dan bukan jaminan kekal. Batasan yang masih wujud:
- Token disimpan dalam *localStorage* pelayar. Log keluar memadamkan token pada pelayar, tetapi token yang telah dicuri kekal sah sehingga tamat tempoh.
- Pengehad kadar permintaan disimpan dalam memori satu proses sahaja.
- Semakan tandatangan fail bukan imbasan perisian hasad.
- Ujian penembusan luaran belum dijalankan.

## 5.7 Pengujian Prestasi

Prestasi diukur pada komputer pembangunan menggunakan pelayar Edge mod tanpa kepala (*headless*) dengan WebGL perisian (SwiftShader), tanpa pengehadan rangkaian. Setiap keadaan direkod sekali sebelum dan sekali selepas pengoptimuman Pusat Kawalan 3D. Pengoptimuman utama ialah cache model dalam sesi dan pengiraan peta bayang sekali sahaja. Jadual 5.12 menunjukkan keputusan paparan, dan Jadual 5.13 menunjukkan masa respons API.

Jadual 5.12: Keputusan pengujian prestasi paparan 3D

| Metrik | Sebelum | Selepas |
|---|---:|---:|
| Laluan ke model sedia (desktop) | 4,321 ms | 3,471 ms |
| Laluan ke model sedia (emulasi mudah alih) | 2,036 ms | 1,894 ms |
| FPS putaran kamera (desktop) | 9.95 | 13.79 |
| FPS putaran kamera (emulasi mudah alih) | 10.83 | 19.49 |
| Panggilan lukisan setiap bingkai | 384 | 192 |
| Muat turun semula model selepas 4 lawatan | 4 | 0 |
| Perubahan memori *heap* selepas 4 lawatan | 3.373 MB | 3.309 MB |
| Pemilihan pos ke panel data (desktop / emulasi mudah alih) | – | 467 ms / 915 ms |

Jadual 5.13: Masa respons median API (tujuh sampel)

| Titik akhir API | Sebelum (ms) | Selepas (ms) |
|---|---:|---:|
| Gambaran keseluruhan 3D (*overview*) | 29.89 | 19.59 |
| Ringkasan pos 3D (*summary*) | 34.57 | 25.77 |
| Senarai insiden 3D | 31.80 | 31.14 |
| Papan pemuka lama | 20.61 | 56.16 |

Bilangan panggilan lukisan berkurang separuh kerana peta bayang tidak lagi dikira semula pada setiap pergerakan kamera, dan model tidak dimuat turun semula apabila halaman dilawati semula. Kesemua respons API median adalah di bawah 60 ms. Masa respons papan pemuka lama meningkat kerana pertanyaan kini memilih hasil analisis terkini bagi setiap laporan (FIX-03). Peningkatan ini ialah kos ketepatan data, dan menunjukkan bahawa tidak semua titik akhir menjadi lebih pantas. Dengan tujuh sampel sahaja, perbezaan kecil seperti senarai insiden tidak boleh dianggap signifikan.

Sasaran 30 FPS tidak dicapai dalam persekitaran WebGL perisian. WebGL perisian menggunakan CPU dan bukan GPU, maka keputusan ini dijangka lebih rendah daripada prestasi pada peranti sebenar. Pengujian pada GPU fizikal dan telefon sebenar belum dijalankan. **[MASUKKAN]** Keputusan pengukuran pada sekurang-kurangnya satu komputer dengan GPU dan satu telefon pintar, jika dijalankan.

## 5.8 Pengujian Penerimaan Pengguna (UAT)

Pengujian penerimaan pengguna bertujuan menilai kebolehgunaan sistem oleh bakal pengguna sebenar. Pelan ujian disediakan dalam `docs/psm-evaluation/USER_ACCEPTANCE_TEST_PLAN.md`. Responden diberi senario tugasan mengikut peranan, kemudian menjawab soal selidik kebolehgunaan yang dibina khusus untuk projek ini. Soal selidik ini mempunyai sembilan item berskala Likert 1–5 (1: sangat tidak setuju, 5: sangat setuju) serta pilihan "Tidak berkaitan". Soal selidik ini bukan instrumen *System Usability Scale* (SUS). Oleh itu, keputusan dilaporkan sebagai taburan dan median bagi setiap item, bukan sebagai skor SUS.

**[MASUKKAN]** Bilangan responden mengikut peranan (Pengawal Keselamatan, Ketua Pengawal, Pentadbir), tarikh dan lokasi ujian, peranti yang digunakan, serta cara persetujuan responden diperoleh.

Jadual 5.14: Senario tugasan UAT

| No | Peranan | Tugasan | Kriteria berjaya | Kadar berjaya | Masa purata |
|---|---|---|---|---|---|
| T1 | Pengawal Keselamatan | Log masuk dan lihat syif hari ini | Syif dipaparkan | **[MASUKKAN]** | |
| T2 | Pengawal Keselamatan | Daftar masuk syif | Rekod kehadiran disimpan | | |
| T3 | Pengawal Keselamatan | Hantar laporan harian dengan satu lampiran | Laporan disimpan dan dianalisis | | |
| T4 | Ketua Pengawal | Tugaskan pengawal ke pos yang kekurangan | Tugasan disimpan tanpa pertindihan | | |
| T5 | Ketua Pengawal | Semak dan luluskan laporan berisiko tinggi | Keputusan disimpan | | |
| T6 | Ketua Pengawal | Cari pos dalam Pusat Kawalan 3D dan baca laporannya | Panel pos dibuka | | |
| T7 | Pentadbir Sistem | Cipta tindakan susulan bagi laporan yang diluluskan | Tindakan dicipta | | |
| T8 | Pentadbir Sistem | Eksport audit trail bagi satu minggu | Fail CSV dimuat turun | | |

**[SEMAK]** Laraskan senarai tugasan supaya sepadan dengan senario sebenar dalam pelan UAT.

Jadual 5.15: Keputusan soal selidik kebolehgunaan

| No | Item | n | Median | Min | Maks |
|---|---|---:|---:|---:|---:|
| 1 | Saya boleh menavigasi antara muka dengan mudah | [MASUKKAN] | | | |
| 2 | Maklumat operasi yang dipaparkan jelas | | | | |
| 3 | Saya mudah menemui pos keselamatan yang diminta | | | | |
| 4 | Persembahan antara muka membantu saya memahami maklumat | | | | |
| 5 | Penunjuk lokasi dan status mudah difahami | | | | |
| 6 | Kawalan paparan dan navigasi mudah digunakan | | | | |
| 7 | Antara muka bertindak balas cukup pantas | | | | |
| 8 | Saya yakin telah menemui maklumat yang diminta | | | | |
| 9 | Secara keseluruhan, saya berpuas hati dengan antara muka ini | | | | |

**[RAJAH]** Rajah 5.14: Taburan jawapan bagi setiap item (carta bar bertindan)

**[MASUKKAN]** Masa purata menghantar laporan (objektif 3: "masa pengguna menghantar laporan"), berbanding kaedah semasa jika data perbandingan tersedia.

**[MASUKKAN]** Ringkasan jawapan soalan terbuka: ciri paling berguna, interaksi paling mengelirukan dan cadangan perubahan. Nyatakan perubahan yang dibuat hasil daripada maklum balas ini, jika ada.

*Jika UAT tidak dapat dijalankan sebelum penyerahan, gantikan bahagian ini dengan perenggan yang menyatakan bahawa pelan dan instrumen telah disediakan tetapi pengumpulan data belum dilaksanakan, dan pindahkan Jadual 5.14 dan 5.15 ke lampiran sebagai instrumen.*

## 5.9 Perbincangan

### 5.9.1 Pencapaian Objektif 1 dan 2

Sistem telah direka bentuk menggunakan pendekatan berorientasikan objek dan dibangunkan sebagai aplikasi web yang menggabungkan penjadualan, kehadiran, pelaporan harian, analisis laporan, tindakan susulan, papan pemuka dan audit trail dalam satu platform. Kesemua modul dalam Bahagian 5.3 berfungsi dengan pangkalan data yang sama, maka laporan boleh dikaitkan terus dengan pos, syif dan pengawal yang bertugas.

Analisis laporan berkembang daripada pendekatan berasaskan peraturan sahaja (Bab 1) kepada pendekatan hibrid. Perubahan ini dibuat kerana padanan kata kunci tidak dapat membezakan ayat seperti "tiada kebakaran" atau "latihan kebakaran" daripada laporan kebakaran sebenar. Pada set cabaran yang sama, saluran hibrid mencapai F1 makro kategori 95.7%, berbanding 61.5% bagi padanan kata kunci (Jadual 5.8). Model Naive Bayes sahaja mencapai 78.2% pada set pembangunan yang berbeza dan lebih besar (Jadual 5.6). Kedua-dua angka ini tidak boleh dibandingkan secara langsung, tetapi kedua-duanya menunjukkan bahawa model terlatih dan peraturan konteks saling melengkapi: model mengenal pasti topik, manakala peraturan menentukan sama ada peristiwa itu benar-benar berlaku.

Keputusan per kategori menunjukkan bahawa kelemahan utama model ialah membezakan kategori yang berkongsi kosa kata, seperti Pencerobohan dan Keselamatan Fizikal. Sekiranya sistem digunakan secara operasi, kedua-dua kategori ini mungkin perlu ditakrifkan semula dengan lebih jelas, atau digabungkan. Mekanisme pengesahan kategori oleh Ketua Pengawal membolehkan kesilapan ini dibetulkan dan dijadikan data latihan.

### 5.9.2 Pencapaian Objektif 3

Kesemua 147 ujian pelayan dan suite ujian lain yang dijalankan lulus, dan keperluan fungsian FR01–FR06 disahkan (Jadual 5.5). Pengujian juga berjaya mengesan 15 kecacatan, termasuk sembilan kecacatan tahap P1 yang melibatkan keselamatan data atau ketepatan rekod, sebelum sistem digunakan (Jadual 5.4). Keupayaan mengenal pasti maklumat kritikal disahkan melalui pengenalpastian kesemua ayat penafian dan latihan, dan tiada keluaran berisiko tinggi bagi kes tersebut (Jadual 5.8 dan 5.9). Penilaian kebolehgunaan bergantung kepada data UAT dalam Bahagian 5.8. **[MASUKKAN]** Rumusan dapatan UAT.

### 5.9.3 Reka Bentuk Berpusatkan Keputusan Manusia

Dalam reka bentuk PENJAGA, keputusan rasmi kekal di tangan Ketua Pengawal dan Pentadbir Sistem. Cadangan model tidak meluluskan laporan atau mencipta tindakan secara automatik. Semakan Gemini bersifat nasihat dan tidak boleh menyekat amaran. Latihan semula hanya menggunakan kategori yang disahkan secara eksplisit oleh manusia, dan model baharu hanya diaktifkan selepas lulus semakan regresi. Penurunan prestasi pada subset 276 contoh (Bahagian 5.5.4) menunjukkan mengapa semakan ini perlu: model yang dilatih dengan lebih banyak data tidak semestinya lebih baik.

Polisi notifikasi juga mengutamakan keselamatan. Amaran kekal dihantar bagi lima daripada lapan kes penafian dan latihan, kerana kos terlepas insiden sebenar lebih tinggi daripada kos menyemak amaran palsu. Pertukaran ini wajar bagi sistem keselamatan, tetapi kadar amaran palsu perlu dipantau dengan data sebenar supaya pengguna tidak mengabaikan amaran.

### 5.9.4 Perbandingan dengan Sistem Sedia Ada

Jadual 5.16 membandingkan PENJAGA dengan sistem sedia ada yang dikaji dalam Bab 2.

Jadual 5.16: Perbandingan PENJAGA dengan sistem sedia ada

| Ciri | Guardhouse | TrackTik | SafetyCulture | PENJAGA |
|---|---|---|---|---|
| Penjadualan dan kehadiran pengawal | Ya | Ya | Terhad | Ya |
| Laporan insiden digital | Ya | Ya | Ya | Ya |
| Analisis kandungan laporan teks bebas (kategori dan risiko) | Tidak | Tidak | Tidak | Ya (hibrid) |
| Pengenalpastian penafian dan latihan | Tidak | Tidak | Tidak | Ya |
| Antara muka Bahasa Melayu | **[SEMAK]** | **[SEMAK]** | **[SEMAK]** | Ya |
| Paparan lokasi 3D | **[SEMAK]** | **[SEMAK]** | Tidak | Ya (anggaran) |
| Integrasi CCTV, GPS atau sensor | **[SEMAK]** | **[SEMAK]** | **[SEMAK]** | Tidak |

**[SEMAK]** Sahkan setiap sel berdasarkan kajian literatur dalam Bab 2 yang telah dibetulkan.

Guardhouse dan TrackTik menyediakan penjadualan dan pengurusan tenaga kerja, manakala SafetyCulture menyokong pelaporan insiden digital. Ketiga-tiga sistem tersebut tidak menganalisis kandungan laporan bebas untuk mengenal pasti kategori dan tahap risiko. PENJAGA mengisi jurang ini dengan menggabungkan operasi harian dan analisis laporan dalam satu platform. Sebaliknya, sistem komersial tersebut lebih matang dari segi integrasi peranti, aplikasi mudah alih asli dan skala penggunaan, yang tidak menjadi skop projek ini.

## 5.10 Ringkasan Bab

Bab ini telah membentangkan hasil pembangunan tujuh modul PENJAGA serta keputusan pengujian fungsi, model analisis laporan, keselamatan, prestasi dan kebolehgunaan. Ujian automatik mengesahkan bahawa keperluan fungsian dipenuhi dan kawalan akses dikuatkuasakan di pelayan. Saluran analisis hibrid mencapai F1 makro 95.7% pada set cabaran sintetik, jauh lebih tinggi daripada padanan kata kunci, dan mengenal pasti kesemua ayat penafian dan latihan. Walau bagaimanapun, semua data penilaian adalah sintetik, maka ketepatan operasi sebenar masih perlu disahkan. Bab seterusnya merumuskan pencapaian objektif, batasan projek dan cadangan penambahbaikan.

---

# BAB 6

# KESIMPULAN DAN CADANGAN

## 6.1 Pengenalan

Bab ini merumuskan pencapaian objektif projek PENJAGA, sumbangan projek, batasan yang dikenal pasti semasa pembangunan dan pengujian, serta cadangan bagi kerja masa hadapan. Bab ini diakhiri dengan kesimpulan keseluruhan projek.

## 6.2 Pencapaian Objektif

Jadual 6.1 merumuskan tahap pencapaian setiap objektif beserta buktinya.

Jadual 6.1: Pencapaian objektif projek

| Objektif | Pencapaian | Bukti |
|---|---|---|
| 1. Mereka bentuk sistem pengurusan operasi keselamatan berasaskan web menggunakan pendekatan berorientasikan objek | Dicapai | Rajah UML, ERD dan reka bentuk pangkalan data (Bab 4); migrasi pangkalan data (Bahagian 5.2) |
| 2. Membangunkan sistem yang mengintegrasikan analisis laporan harian menggunakan NLP | Dicapai | Tujuh modul dalam Bahagian 5.3; analisis hibrid Naive Bayes dan peraturan kontekstual (Bahagian 5.3.4) |
| 3. Menguji dan menilai sistem dari segi fungsi, kebolehgunaan dan keupayaan mengenal pasti maklumat kritikal | Fungsi dan keupayaan analisis: dicapai. Kebolehgunaan: **[MASUKKAN selepas UAT]** | Jadual 5.3–5.15 |

**Objektif 1** dicapai melalui reka bentuk berorientasikan objek yang dibentangkan dalam Bab 4 dan dilaksanakan sebagai tiga lapisan: antara muka, pelayan aplikasi dan pangkalan data. Struktur pangkalan data diurus melalui migrasi bernombor, maka reka bentuk yang sama digunakan dalam pembangunan, pengujian dan pengehosan.

**Objektif 2** dicapai melalui pembangunan modul analisis yang mengelaskan setiap laporan secara automatik selepas dihantar, menilai tahap risiko, dan memaklumkan Ketua Pengawal bagi laporan berisiko tinggi. Analisis dijalankan secara tempatan dalam baris gilir yang tahan terhadap kegagalan, maka laporan tidak hilang walaupun analisis gagal.

**Objektif 3** dicapai sebahagiannya. Pengujian fungsi, keselamatan dan prestasi telah dilaksanakan dan didokumenkan. Keupayaan mengenal pasti maklumat kritikal telah dinilai pada data sintetik. **[MASUKKAN]** Rumusan UAT, atau nyatakan bahawa penilaian kebolehgunaan dengan pengguna sebenar belum dilaksanakan.

## 6.3 Sumbangan Projek

1. **Platform operasi bersepadu.** Satu platform berpusat yang menggabungkan penjadualan, kehadiran, pelaporan harian, tindakan susulan, papan pemuka dan audit trail bagi operasi keselamatan, dengan kawalan akses berasaskan peranan yang dikuatkuasakan di pelayan.
2. **Analisis laporan hibrid dalam Bahasa Melayu.** Pendekatan yang menggabungkan model Naive Bayes dengan peraturan kontekstual untuk membezakan insiden sebenar daripada ayat penafian, latihan dan insiden yang disyaki. Pada set cabaran sintetik, pendekatan ini mencapai F1 makro 95.7% berbanding 61.5% bagi padanan kata kunci.
3. **Pembelajaran berterusan yang terkawal.** Mekanisme latihan semula yang hanya menggunakan kategori yang disahkan secara eksplisit oleh manusia, dengan semakan regresi sebelum model baharu diaktifkan dan kemampuan untuk kembali kepada model asas.
4. **Reka bentuk AI sebagai penasihat.** Keputusan rasmi kekal di tangan Ketua Pengawal dan Pentadbir Sistem, manakala cadangan model dan semakan AI luaran bersifat nasihat dan tidak boleh menyekat amaran berisiko tinggi.
5. **Visualisasi lokasi 3D.** Pusat Kawalan 3D yang menghubungkan pos kawalan dengan jadual, kehadiran, laporan dan tindakan, untuk membantu penyelia memahami situasi mengikut lokasi.

## 6.4 Batasan Projek

1. **Data latihan dan penilaian sintetik.** Model dilatih dan dinilai menggunakan data sintetik yang dilabel oleh pembangun. Set cabaran kecil (26 kes berlabel kategori), dan set pembangunan turut digunakan untuk memilih tetapan. Ketepatan pada laporan operasi sebenar belum diukur, dan skor keyakinan tidak dikalibrasi.
2. **Kategori yang bertindih.** Model kerap mengelirukan kategori Pencerobohan dengan Keselamatan Fizikal (F1 64.2% dan 62.4%).
3. **Amaran palsu.** Polisi notifikasi konservatif masih menghantar amaran bagi lima daripada lapan kes penafian dan latihan dalam simulasi.
4. **Penilaian kebolehgunaan.** **[Kemas kini]** UAT melibatkan bilangan responden yang terhad. *(Jika UAT belum dijalankan, nyatakan bahawa penilaian kebolehgunaan dengan pengguna sebenar belum dilaksanakan.)*
5. **Prestasi pada peranti sebenar.** Ujian prestasi dijalankan menggunakan WebGL perisian. Sasaran 30 FPS bagi Pusat Kawalan 3D belum disahkan pada GPU fizikal dan telefon pintar.
6. **Lokasi dan integrasi fizikal.** Kedudukan pos dalam model 3D ialah anggaran visual. Sistem tidak berintegrasi dengan CCTV, sensor IoT, kawalan akses pintu atau GPS, dan rekod kehadiran tidak membuktikan kedudukan fizikal pengawal. Daftar masuk dan keluar hanya dibenarkan pada tarikh tugasan, maka daftar keluar bagi syif malam semalam belum disokong. **[SEMAK]** sama ada batasan ini masih wujud.
7. **Keselamatan.** Ujian penembusan luaran, imbasan perisian hasad dan latihan pemulihan sandaran belum dijalankan. Pengehad kadar permintaan disimpan dalam memori satu proses, dan token disimpan dalam *localStorage*.
8. **Fungsi yang belum dibangunkan.** Eskalasi automatik bagi tindakan yang melepasi tempoh, eksport audit dalam format PDF, dan rekod alamat IP serta peranti dalam audit trail. Lajur bagi alamat IP dan peranti telah wujud dalam skema pangkalan data, tetapi belum diisi dengan nilai sebenar.

## 6.5 Cadangan Penambahbaikan

Cadangan berikut disusun mengikut keutamaan.

1. **Data operasi sebenar.** Mengumpul laporan operasi sebenar yang telah dianonimkan dan dilabel oleh pakar domain, dengan kebenaran pihak pengurusan. Data ini digunakan untuk menilai semula model pada set ujian bebas yang tidak digunakan untuk memilih tetapan, dan untuk mengkalibrasi skor keyakinan.
2. **Taksonomi kategori.** Mentakrif semula atau menggabungkan kategori yang bertindih, seperti Pencerobohan dan Keselamatan Fizikal, bersama pakar domain.
3. **UAT yang lebih luas.** Menjalankan UAT dengan bilangan pengawal dan penyelia yang lebih besar di premis sebenar, termasuk pengujian pada telefon pintar pengawal, dan menggunakan instrumen piawai seperti SUS sebagai pelengkap.
4. **Model bahasa yang lebih maju.** Membandingkan model Naive Bayes dengan model berasaskan *embedding* atau model transformer kecil yang dijalankan secara tempatan, selepas data sebenar tersedia.
5. **Eskalasi dan notifikasi.** Membangunkan eskalasi automatik bagi tindakan susulan yang melepasi tempoh, serta notifikasi melalui e-mel atau aplikasi pesanan.
6. **Audit trail.** Merekod alamat IP dan peranti dalam audit trail, serta menyediakan eksport audit dalam format PDF.
7. **Keselamatan pengehosan.** Memindahkan pengehad kadar permintaan ke storan kongsi seperti Redis, menyimpan sesi dalam kuki *HttpOnly*, serta menjalankan ujian penembusan dan latihan pemulihan sandaran sebelum penggunaan operasi.
8. **Pusat Kawalan 3D.** Mengesahkan koordinat pos di lapangan, menambah pelan aras dalaman, dan mengukur prestasi pada GPU dan telefon sebenar.
9. **Integrasi peranti.** Meneroka integrasi dengan CCTV, GPS atau sistem kawalan akses bagi mengesahkan kehadiran dan laporan dengan data sensor.

## 6.6 Kesimpulan

PENJAGA telah dibangunkan sebagai sistem pengurusan operasi keselamatan berasaskan web yang mengintegrasikan penjadualan, kehadiran, pelaporan harian digital, analisis laporan hibrid, tindakan susulan, papan pemuka analitik, Pusat Kawalan 3D dan audit trail. Pengujian automatik mengesahkan bahawa keperluan fungsian dipenuhi dan kawalan akses berasaskan peranan dikuatkuasakan di pelayan. Analisis hibrid mampu mengenal pasti kategori insiden dan membezakan insiden sebenar daripada ayat penafian dan latihan pada data penilaian sintetik, dengan prestasi yang jauh lebih baik daripada padanan kata kunci.

Secara keseluruhan, projek ini menunjukkan bahawa laporan harian dalam bentuk teks bebas boleh ditukar kepada maklumat operasi yang berstruktur, tanpa mengetepikan peranan manusia dalam membuat keputusan. Pengesahan dengan data dan pengguna sebenar merupakan langkah seterusnya sebelum sistem digunakan secara operasi.

---

## Rujukan tambahan bagi Bab 5–6 (gaya APA)

- Brooke, J. (1996). SUS: A "quick and dirty" usability scale. In P. W. Jordan, B. Thomas, B. A. Weerdmeester, & I. L. McClelland (Eds.), *Usability evaluation in industry* (pp. 189–194). Taylor & Francis.
- Manning, C. D., Raghavan, P., & Schütze, H. (2008). *Introduction to information retrieval*. Cambridge University Press.
- McCallum, A., & Nigam, K. (1998). A comparison of event models for naive Bayes text classification. In *AAAI-98 Workshop on Learning for Text Categorization* (pp. 41–48).
- Sokolova, M., & Lapalme, G. (2009). A systematic analysis of performance measures for classification tasks. *Information Processing & Management, 45*(4), 427–437.

*(Sahkan butiran rujukan sebelum dimasukkan ke dalam senarai rujukan.)*
