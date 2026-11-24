# Draf Bab 5 dan Bab 6 — PENJAGA

> **Nota format (UTHM Report Writing Guideline 2024, AITCS 2025):** setiap bab dimulakan pada halaman baharu; tajuk dan sub-tajuk bernombor; jarak baris 1.5; kapsyen jadual **di atas** jadual (Jadual 5.1, tanpa noktah di hujung), kapsyen rajah **di bawah** rajah (Rajah 5.1); jadual yang bersambung ditanda "Jadual 5.x (sambungan)"; hanya garis mendatar dalam jadual; rujukan gaya APA edisi ke-7.
>
> **Penanda dalam draf ini:**
> - **[MASUKKAN]**: data yang belum dikumpul (ujian penerimaan pengguna, UAT). Jangan isi dengan anggaran.
> - **[RAJAH]**: tangkapan skrin atau gambar rajah yang perlu disediakan.
> - Angka ujian automatik diambil daripada bukti dalam repositori (`docs/psm-evaluation/`, `docs/testing/`) dan larian pada 24 November 2026. Jalankan semula sebelum penyerahan dan kemas kini angka jika berubah.

---

# BAB 5

# HASIL DAN PERBINCANGAN

## 5.1 Pengenalan

Bab ini membentangkan hasil pembangunan Sistem Pengurusan Operasi Keselamatan Berasaskan Kepintaran Buatan (PENJAGA) serta keputusan pengujian yang dijalankan. Perbincangan disusun mengikut tiga objektif projek. Bahagian 5.2 menerangkan persekitaran pembangunan. Bahagian 5.3 membentangkan antara muka dan modul yang telah dibangunkan bagi menjawab objektif pertama dan kedua. Bahagian 5.4 hingga 5.8 membentangkan keputusan pengujian fungsi, prestasi model analisis laporan, keselamatan, prestasi sistem dan kebolehgunaan bagi menjawab objektif ketiga. Bahagian 5.9 membincangkan dapatan berbanding sistem sedia ada yang dikaji dalam Bab 2.

## 5.2 Persekitaran Pembangunan

Sistem dibangunkan sebagai aplikasi web pelanggan-pelayan. Jadual 5.1 menyenaraikan perisian dan peralatan yang digunakan.

Jadual 5.1: Persekitaran pembangunan sistem PENJAGA

| Komponen | Teknologi |
|---|---|
| Lapisan hadapan | React 19, Vite, Tailwind CSS, React Router, Recharts, three.js (@react-three/fiber) |
| Pelayan aplikasi | Node.js 24, Express.js |
| Pangkalan data | PostgreSQL 17 |
| Pengesahan dan keselamatan | JSON Web Token (JWT), bcrypt, Helmet |
| Analisis laporan | Model Multinomial Naive Bayes dan peraturan kontekstual (JavaScript); semakan Gemini secara pilihan |
| Pengujian | Node.js test runner, Playwright |
| Pengehosan | Docker Compose (PostgreSQL, API, Nginx) atau Vercel bagi lapisan hadapan |
| Kawalan versi | Git dan GitHub Actions |

Perkakasan pembangunan ialah komputer riba Windows 11 dengan pemproses Intel Core i7-12650H. Pangkalan data ujian dijalankan sebagai kluster PostgreSQL tempatan yang berasingan daripada pangkalan data operasi supaya data sintetik ujian tidak bercampur dengan rekod sebenar.

## 5.3 Hasil Pembangunan Sistem

Bahagian ini menerangkan modul yang telah dibangunkan. Setiap modul dikawal oleh peranan pengguna: Pengawal Keselamatan, Ketua Pengawal atau Pentadbir Sistem. Kawalan akses dilaksanakan di pelayan pada setiap permintaan, dan bukan hanya pada antara muka.

### 5.3.1 Modul Log Masuk dan Pengurusan Pengguna

Pengguna log masuk menggunakan nama pengguna dan kata laluan. Pelayan mengesahkan kata laluan yang disimpan sebagai cincangan bcrypt, kemudian mengeluarkan token JWT yang sah selama 12 jam. Pada setiap permintaan, sistem menyemak semula status akaun dan peranan semasa dalam pangkalan data. Oleh itu, akaun yang dinyahaktifkan tidak lagi boleh digunakan walaupun tokennya belum tamat. Selepas pengguna menukar kata laluan, semua sesi lama ditolak. Pengguna kemudian dialihkan ke papan pemuka mengikut peranan. Pentadbir Sistem mendaftar pengguna baharu, menetapkan peranan dan mengurus pos kawalan.

**[RAJAH]** Rajah 5.1: Antara muka log masuk
**[RAJAH]** Rajah 5.2: Antara muka pengurusan pengguna

### 5.3.2 Modul Penjadualan dan Kehadiran

Ketua Pengawal dan Pentadbir Sistem membina jadual bertugas mingguan. Kalendar mingguan memaparkan kekurangan pengawal bagi setiap hari berdasarkan keperluan bilangan pengawal setiap pos dan syif. Melalui borang *Isi kekosongan harian*, beberapa pengawal boleh ditugaskan ke beberapa pos dan syif serentak. Sistem menyemak pertindihan masa, termasuk syif malam yang merentasi tengah malam. Jika satu tugasan bertindih, keseluruhan kumpulan tugasan dibatalkan. Hanya pengawal yang aktif boleh ditugaskan, dan hanya ke pos yang aktif. Jadual boleh disalin ke minggu berikutnya selepas pratonton, atau diimport daripada fail CSV. Pengawal melihat syif semasa dalam *Jadual Bertugas Saya* dan merekod daftar masuk serta daftar keluar.

**[RAJAH]** Rajah 5.3: Kalendar jadual mingguan dan kekurangan harian
**[RAJAH]** Rajah 5.4: Paparan jadual pengawal dan daftar masuk

### 5.3.3 Modul Laporan Harian Digital

Pengawal menghantar laporan melalui borang yang mesra peranti mudah alih. Borang merangkumi pos kawalan, syif, tarikh dan masa, naratif laporan, senarai semak rondaan dan sehingga enam lampiran bukti. Setiap lampiran disemak berdasarkan tandatangan fail sebenar, bukan sambungan nama fail. Laporan disimpan bersama satu tugas analisis dalam baris gilir. Dengan cara ini, laporan tidak hilang walaupun analisis gagal atau pelayan dimulakan semula.

**[RAJAH]** Rajah 5.5: Borang laporan harian (paparan telefon)

### 5.3.4 Modul Analisis Laporan (NLP Hibrid)

Pemproses latar belakang menganalisis setiap laporan dalam lima peringkat:

1. Teks dibersihkan, ditukar kepada huruf kecil dan ditokenkan.
2. Model Multinomial Naive Bayes, yang menggunakan unigram dan bigram, mencadangkan kategori insiden.
3. Peraturan kontekstual membezakan insiden yang dilaporkan, disyaki, dinafikan (contohnya "tiada kebakaran"), latihan (*drill*) dan yang tidak jelas. Sumber setiap bukti dikekalkan dalam teks asal.
4. Skor risiko 0–100 dikira dan dipetakan kepada tahap risiko: Rendah (0–30), Sederhana (31–60), Tinggi (61–80) dan Kritikal (81–100).
5. Ringkasan automatik dijana, dan notifikasi dihantar kepada Ketua Pengawal sekiranya risiko Tinggi atau Kritikal.

Model dilatih menggunakan 2,000 contoh laporan sintetik yang seimbang merentasi lapan kategori: Rondaan Biasa, Pencerobohan, Kebakaran, Pergaduhan, Kehilangan Aset, Vandalisme, Keselamatan Fizikal dan Kerosakan Kemudahan. Sebanyak 1,576 contoh digunakan untuk latihan dan 424 contoh diasingkan untuk penilaian.

Selepas Ketua Pengawal mengesahkan kategori secara eksplisit, sistem boleh melatih semula model secara automatik apabila sekurang-kurangnya 20 kumpulan label baharu terkumpul. Model calon hanya diaktifkan selepas lulus semakan regresi. Semakan tambahan oleh model bahasa Gemini adalah pilihan dan bersifat nasihat sahaja: ia tidak boleh mengubah skor risiko, keputusan semakan atau amaran berisiko tinggi.

**[RAJAH]** Rajah 5.6: Ringkasan kategori dan risiko dalam paparan laporan

### 5.3.5 Modul Semakan Laporan dan Tindakan Susulan

Ketua Pengawal menyemak laporan asal bersama cadangan kategori dan risiko. Beliau kemudian meluluskan atau menolak laporan dengan ulasan, mengesahkan atau membetulkan kategori, dan menandakan sama ada tindakan susulan diperlukan. Pentadbir Sistem mencipta tindakan susulan rasmi dan mengemas kini statusnya (Baru, Dalam Tindakan, Selesai). Ketua Pengawal merekod kemajuan tindakan bersama lampiran.

**[RAJAH]** Rajah 5.7: Antara muka semakan laporan
**[RAJAH]** Rajah 5.8: Antara muka tindakan susulan

### 5.3.6 Modul Papan Pemuka, Notifikasi dan Pusat Kawalan 3D

Papan pemuka memaparkan jumlah laporan, laporan berisiko tinggi, laporan belum disemak, status tindakan dan trend mengikut tempoh. Pengguna boleh membandingkan tempoh semasa dengan tempoh sebelumnya serta menapis data mengikut tarikh, pos dan tahap risiko. Pusat Kawalan 3D memaparkan model luaran lapan bangunan dengan 15 pos kawalan rasmi. Apabila sesuatu pos dipilih, jadual, kehadiran, laporan dan tindakan berkaitan dipaparkan. Kedudukan penanda pos ialah anggaran visual. Notifikasi dihantar kepada Ketua Pengawal bagi laporan berisiko tinggi, dan kepada pengawal apabila jadual yang telah diterbitkan berubah.

**[RAJAH]** Rajah 5.9: Papan pemuka analitik
**[RAJAH]** Rajah 5.10: Pusat Kawalan 3D

### 5.3.7 Modul Audit Trail

Aktiviti penting direkod secara automatik, antaranya log masuk berjaya dan gagal, penghantaran dan semakan laporan, perubahan jadual, penukaran kata laluan dan kemas kini tindakan. Pentadbir Sistem boleh menapis rekod audit dan mengeksportnya dalam format CSV. Eksport CSV dilindungi daripada suntikan formula hamparan.

**[RAJAH]** Rajah 5.11: Antara muka audit trail

## 5.4 Pengujian Fungsi

Pengujian fungsi dijalankan secara automatik pada tiga peringkat. Ujian unit menguji logik seperti pengelasan teks, geometri bangunan dan penilaian. Ujian integrasi menggunakan API sebenar dengan pengesahan dan skema pangkalan data PostgreSQL sementara. Ujian pelayar (Playwright) menguji aliran kerja melalui antara muka. Data ujian adalah sintetik sepenuhnya. Jadual 5.2 meringkaskan keputusan.

Jadual 5.2: Ringkasan keputusan pengujian fungsi automatik

| Suite ujian | Skop | Bilangan ujian | Lulus | Gagal |
|---|---|---:|---:|---:|
| Ujian pelayan (backend) | API, peranan, aliran laporan, NLP, penjadualan, pangkalan data, keselamatan | 147 | 147 | 0 |
| Ujian logik bangunan 3D | Model, penanda, unjuran, penempatan pos | 33 | 33 | 0 |
| Ujian pelayar 3D | Paparan model, interaksi, data berkaitan pos | 18 | 18 | 0 |
| Ujian pelayar aliran demo | Log masuk sebenar, pertukaran akaun, sentuhan, fail peribadi | 5 | 5 | 0 |
| Semakan binaan (*lint*, sintaks, binaan produksi) | Kod hadapan dan pelayan | – | Lulus | – |

*Nota: Suite pelayar dan ujian fasa 6–8 perlu dijalankan semula sebelum penyerahan. Isikan angka terkini daripada `npm run test:phase8:browser` dan `npm run test:phase6`.*

Pengujian turut mengesan kecacatan yang kemudiannya dibaiki. Jadual 5.3 menyenaraikan contoh kecacatan utama. Selaras dengan templat AITCS, ujian yang gagal pada mulanya dilaporkan dan tidak disembunyikan.

Jadual 5.3: Contoh kecacatan yang dikesan dan dibaiki melalui pengujian

| ID | Kecacatan | Pembaikan |
|---|---|---|
| FIX-01 | Cache data kekal apabila pengguna lain log masuk pada pelayar yang sama | Cache baharu bagi setiap akaun dan peranan |
| FIX-03 | Papan pemuka mengira semua hasil analisis lama bagi satu laporan | Hanya hasil analisis terkini digunakan |
| FIX-05 | Kebenaran muat turun lampiran berdasarkan padanan sebahagian nama | Padanan rujukan penuh dan jenis fail berdasarkan kandungan |
| FIX-10 | Lampiran kekal tersimpan apabila borang ditolak; ralat saiz fail memberi 500 | Pembersihan fail dan respons 400/413 |
| SEC-1 | Tugasan jadual boleh diberikan kepada akaun bukan pengawal atau pos tidak aktif | Semakan peranan dan status pada semua laluan penjadualan |
| SEC-2 | Token lama kekal sah selepas kata laluan ditukar | Sesi sebelum pertukaran ditolak; token baharu dikeluarkan |

Jadual 5.4 memetakan keperluan fungsian dalam Bab 4 kepada hasil ujian.

Jadual 5.4: Pemetaan keperluan fungsian kepada hasil pengujian

| Keperluan | Kes ujian | Status |
|---|---|---|
| FR01 Pengesahan dan kawalan akses berasaskan peranan | Token tamat, salah tandatangan atau format salah ditolak; peranan disemak pada setiap laluan | Lulus |
| FR02 Laporan harian dan analisis NLP | Laporan dihantar, dikelaskan secara automatik dan disemak melalui API sebenar | Lulus |
| FR03 Semakan dan pengesahan laporan | Ketua Pengawal meluluskan atau menolak; status disemak semula untuk mengelakkan keputusan bertindih | Lulus |
| FR04 Tindakan susulan | Pentadbir mencipta tindakan; Ketua Pengawal merekod kemajuan; peranan lain ditolak | Lulus |
| FR05 Papan pemuka | Perbandingan tempoh, hari tanpa data, penapis pos dan risiko | Lulus |
| FR06 Audit trail | Rekod aktiviti, penapisan dan eksport CSV mengikut julat tarikh | Lulus |
| Penjadualan | Pertindihan syif malam, pembatalan kumpulan, salinan minggu dan kekosongan harian | Lulus |

## 5.5 Penilaian Model Analisis Laporan

Model dinilai menggunakan 424 contoh pembangunan yang tidak digunakan dalam latihan. Variasi daripada keluarga laporan yang sama dikekalkan dalam satu partisi bagi mengelakkan kebocoran data. Sebanyak 40 kes cabaran yang berasingan, termasuk ayat penafian dan latihan, digunakan untuk menilai keseluruhan saluran analisis. Metrik utama ialah skor F1 makro, iaitu purata skor F1 bagi setiap kategori:

F1 = 2 × (Kepersisan × Dapatan semula) / (Kepersisan + Dapatan semula)  (Persamaan 5.1)

Jadual 5.5: Keputusan penilaian model analisis laporan

| Penilaian | Data | Keputusan |
|---|---|---|
| Model Naive Bayes sahaja | 424 contoh pembangunan sintetik | F1 makro 78.2% |
| Model + peraturan kontekstual | 40 kes cabaran sintetik | F1 makro kategori 95.7% (model terdahulu: 95.0%) |
| Kes penafian dan latihan | 8 kes cabaran | Tiada keluaran Tinggi atau Kritikal oleh analisis |
| Subset keluarga tambahan | 276 contoh | 68.6% berbanding 75.2% bagi model terdahulu |

Peraturan kontekstual meningkatkan prestasi dengan ketara berbanding model sahaja, terutamanya bagi ayat yang menafikan insiden atau menerangkan latihan. Walau bagaimanapun, prestasi menurun pada subset keluarga laporan tambahan. Ini menunjukkan bahawa data sintetik tambahan tidak semestinya meningkatkan generalisasi. Semua data penilaian adalah sintetik dan dilabel oleh pembangun, maka keputusan ini ialah bukti pembangunan dan bukan ketepatan operasi sebenar. Skor keyakinan model juga tidak dikalibrasi dan tidak boleh ditafsirkan sebagai kebarangkalian sebenar sesuatu insiden.

## 5.6 Pengujian Keselamatan

Pengujian keselamatan dijalankan secara automatik terhadap API dan antara muka menggunakan data sintetik. Jadual 5.6 meringkaskan kawalan yang disahkan.

Jadual 5.6: Keputusan pengujian keselamatan

| Kawalan | Keputusan |
|---|---|
| Token tamat, salah tandatangan, format salah dan bukan Bearer | Ditolak (401) |
| Pengawal mengakses data atau laluan pengurusan | Ditolak (403); pengawal hanya melihat rekod sendiri |
| Input berbentuk SQL dan parameter tidak sah | Ditolak (400); semua pertanyaan SQL berparameter |
| Muat turun lampiran milik pengguna lain | Ditolak; jenis fail ditentukan daripada kandungan |
| Laluan fail peribadi pada pelayan pembangunan | Ditolak (403) |
| Konfigurasi produksi | Rahsia JWT lemah dan asal (*origin*) yang tidak dibenarkan ditolak |
| Audit kebergantungan (npm audit) | Hadapan: 16 → 0 nasihat; pelayan: 11 → 0 nasihat |

Batasan yang masih wujud:
- Token disimpan dalam *localStorage* pelayar.
- Pengehad kadar permintaan disimpan dalam memori satu proses sahaja.
- Ujian penembusan luaran dan imbasan perisian hasad belum dijalankan.

## 5.7 Pengujian Prestasi

Prestasi diukur pada komputer pembangunan menggunakan pelayar Edge mod tanpa kepala (*headless*) dengan WebGL perisian (SwiftShader), tanpa pengehadan rangkaian. Jadual 5.7 menunjukkan keputusan sebelum dan selepas pengoptimuman Pusat Kawalan 3D.

Jadual 5.7: Keputusan pengujian prestasi

| Metrik | Sebelum | Selepas |
|---|---:|---:|
| Laluan ke model sedia (desktop) | 4,321 ms | 3,471 ms |
| Laluan ke model sedia (emulasi mudah alih) | 2,036 ms | 1,894 ms |
| FPS putaran kamera (desktop) | 9.95 | 13.79 |
| Pemilihan pos ke panel data (emulasi mudah alih) | 1,978 ms | 915 ms |
| Panggilan lukisan setiap bingkai | 384 | 192 |
| Respons API ringkasan 3D (median) | 29.89 ms | 19.59 ms |

Kebanyakan respons API median adalah di bawah 60 ms, sekali gus memenuhi keperluan bukan fungsian bagi respons pantas. Sasaran 30 FPS tidak dicapai dalam persekitaran WebGL perisian. Pengujian pada GPU fizikal dan telefon sebenar belum dijalankan, maka prestasi pada peranti sebenar masih perlu disahkan.

## 5.8 Pengujian Penerimaan Pengguna (UAT)

Pengujian penerimaan pengguna menggunakan soal selidik kebolehgunaan yang dibina khusus untuk projek ini, dengan sembilan item berskala Likert 1–5. Soal selidik ini bukan instrumen SUS. Oleh itu, keputusan dilaporkan sebagai taburan dan median bagi setiap item, bukan sebagai skor SUS.

**[MASUKKAN]** Bilangan responden mengikut peranan (Pengawal Keselamatan, Ketua Pengawal, Pentadbir), tarikh dan lokasi ujian, serta senario tugasan yang diberikan.

Jadual 5.8: Keputusan soal selidik kebolehgunaan

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

**[MASUKKAN]** Masa purata menghantar laporan (objektif 3: "masa pengguna menghantar laporan") dan kadar tugasan berjaya.

**[MASUKKAN]** Ringkasan jawapan soalan terbuka: ciri paling berguna, interaksi paling mengelirukan dan cadangan perubahan.

## 5.9 Perbincangan

**Objektif 1 dan 2.** Sistem telah direka bentuk menggunakan pendekatan berorientasikan objek dan dibangunkan sebagai aplikasi web yang menggabungkan penjadualan, pelaporan harian, analisis laporan, tindakan susulan, papan pemuka dan audit trail dalam satu platform. Analisis laporan berkembang daripada pendekatan berasaskan peraturan sahaja (Bab 1) kepada pendekatan hibrid. Perubahan ini dibuat kerana peraturan kata kunci sahaja tidak dapat membezakan ayat seperti "tiada kebakaran" daripada laporan kebakaran sebenar. Gabungan model dan peraturan kontekstual menghasilkan F1 makro 95.7% pada kes cabaran, berbanding 78.2% bagi model sahaja.

**Objektif 3.** Kesemua 147 ujian pelayan dan suite ujian lain yang dijalankan lulus, dan keperluan fungsian FR01–FR06 disahkan (Jadual 5.4). Penilaian kebolehgunaan bergantung kepada data UAT dalam Bahagian 5.8. **[MASUKKAN]** Rumusan dapatan UAT.

**Perbandingan dengan sistem sedia ada.** Guardhouse dan TrackTik menyediakan penjadualan dan pengurusan tenaga kerja, manakala SafetyCulture menyokong pelaporan insiden digital (Bab 2). Ketiga-tiga sistem tersebut tidak menganalisis kandungan laporan bebas untuk mengenal pasti kategori dan tahap risiko. PENJAGA mengisi jurang ini dengan menggabungkan operasi harian dan analisis laporan. Dalam reka bentuknya, keputusan rasmi kekal di tangan Ketua Pengawal: cadangan model, semakan AI luaran dan latihan semula tidak boleh menggantikan keputusan manusia atau menyekat amaran berisiko tinggi.

## 5.10 Ringkasan Bab

Bab ini telah membentangkan hasil pembangunan modul PENJAGA serta keputusan pengujian fungsi, model analisis laporan, keselamatan, prestasi dan kebolehgunaan. Ujian automatik mengesahkan bahawa keperluan fungsian dipenuhi. Penilaian model menunjukkan prestasi yang baik pada data sintetik, namun ketepatan operasi sebenar masih perlu disahkan. Bab seterusnya merumuskan pencapaian objektif, batasan projek dan cadangan penambahbaikan.

---

# BAB 6

# KESIMPULAN DAN CADANGAN

## 6.1 Pengenalan

Bab ini merumuskan pencapaian objektif projek PENJAGA, sumbangan projek, batasan yang dikenal pasti semasa pembangunan dan pengujian, serta cadangan bagi kerja masa hadapan.

## 6.2 Pencapaian Objektif

Jadual 6.1: Pencapaian objektif projek

| Objektif | Pencapaian | Bukti |
|---|---|---|
| 1. Mereka bentuk sistem pengurusan operasi keselamatan berasaskan web menggunakan pendekatan berorientasikan objek | Dicapai | Rajah UML, ERD dan reka bentuk pangkalan data (Bab 4) |
| 2. Membangunkan sistem yang mengintegrasikan analisis laporan harian menggunakan NLP | Dicapai | Modul dalam Bahagian 5.3; analisis hibrid Naive Bayes dan peraturan kontekstual |
| 3. Menguji dan menilai sistem dari segi fungsi, kebolehgunaan dan keupayaan mengenal pasti maklumat kritikal | Fungsi dan keupayaan analisis: dicapai. Kebolehgunaan: **[MASUKKAN selepas UAT]** | Jadual 5.2–5.8 |

## 6.3 Sumbangan Projek

1. Satu platform berpusat yang menggabungkan penjadualan, kehadiran, pelaporan harian, tindakan susulan dan audit trail bagi operasi keselamatan.
2. Pendekatan analisis laporan hibrid yang membezakan insiden sebenar daripada ayat penafian, latihan dan insiden yang disyaki. Pendekatan ini mengurangkan amaran palsu berbanding padanan kata kunci semata-mata.
3. Mekanisme pembelajaran berterusan yang hanya menggunakan kategori yang disahkan secara eksplisit oleh manusia, dengan semakan regresi sebelum model baharu diaktifkan.
4. Reka bentuk di mana keputusan rasmi kekal di tangan Ketua Pengawal dan Pentadbir Sistem, manakala cadangan AI bersifat nasihat.

## 6.4 Batasan Projek

1. **Data latihan sintetik.** Model dilatih dan dinilai menggunakan data sintetik yang dilabel oleh pembangun. Ketepatan pada laporan operasi sebenar belum diukur.
2. **Penilaian kebolehgunaan.** **[Kemas kini]** UAT melibatkan bilangan responden yang terhad. *(Jika UAT belum dijalankan, nyatakan bahawa penilaian kebolehgunaan dengan pengguna sebenar belum dilaksanakan.)*
3. **Prestasi pada peranti sebenar.** Ujian prestasi dijalankan menggunakan WebGL perisian. Sasaran 30 FPS bagi Pusat Kawalan 3D belum disahkan pada GPU fizikal dan telefon pintar.
4. **Lokasi dan integrasi fizikal.** Kedudukan pos dalam model 3D ialah anggaran visual. Sistem tidak berintegrasi dengan CCTV, sensor IoT, kawalan akses pintu atau GPS, dan rekod kehadiran tidak membuktikan kedudukan fizikal pengawal.
5. **Keselamatan.** Ujian penembusan luaran, imbasan perisian hasad dan latihan pemulihan sandaran belum dijalankan. Pengehad kadar permintaan disimpan dalam memori satu proses.
6. **Fungsi yang belum dibangunkan.** Eskalasi automatik tindakan yang tamat tempoh, eksport audit dalam format PDF, dan rekod alamat IP serta peranti dalam audit trail.

## 6.5 Cadangan Penambahbaikan

1. Mengumpul laporan operasi sebenar yang telah dianonimkan dan dilabel oleh pakar domain, kemudian menilai semula model dan mengkalibrasi skor keyakinan.
2. Menjalankan UAT dengan bilangan pengawal dan penyelia yang lebih besar di premis sebenar, termasuk pengujian pada telefon pintar pengawal.
3. Membangunkan eskalasi automatik bagi tindakan susulan yang melepasi tempoh, serta notifikasi melalui e-mel atau aplikasi pesanan.
4. Merekod alamat IP dan peranti dalam audit trail, serta menyediakan eksport audit dalam format PDF.
5. Memindahkan pengehad kadar permintaan ke storan kongsi seperti Redis dan menyimpan sesi dalam kuki *HttpOnly* bagi persekitaran berbilang pelayan.
6. Mengesahkan koordinat pos dalam bangunan dan menambah pelan aras dalaman pada Pusat Kawalan 3D.
7. Meneroka integrasi dengan CCTV atau sistem kawalan akses bagi mengesahkan laporan dengan data sensor.

## 6.6 Kesimpulan

PENJAGA telah dibangunkan sebagai sistem pengurusan operasi keselamatan berasaskan web yang mengintegrasikan penjadualan, pelaporan harian digital, analisis laporan hibrid, tindakan susulan, papan pemuka analitik dan audit trail. Pengujian automatik mengesahkan bahawa keperluan fungsian dipenuhi dan kawalan akses berasaskan peranan dikuatkuasakan di pelayan. Analisis hibrid mampu mengenal pasti kategori insiden dan membezakan insiden sebenar daripada ayat penafian dan latihan pada data penilaian sintetik. Secara keseluruhan, projek ini menunjukkan bahawa laporan harian dalam bentuk teks bebas boleh ditukar kepada maklumat operasi yang berstruktur, tanpa mengetepikan peranan manusia dalam membuat keputusan. Pengesahan dengan data dan pengguna sebenar merupakan langkah seterusnya sebelum sistem digunakan secara operasi.

---

## Rujukan tambahan bagi Bab 5–6 (gaya APA)

- McCallum, A., & Nigam, K. (1998). A comparison of event models for naive Bayes text classification. In *AAAI-98 Workshop on Learning for Text Categorization* (pp. 41–48).
- Manning, C. D., Raghavan, P., & Schütze, H. (2008). *Introduction to information retrieval*. Cambridge University Press.

*(Sahkan butiran rujukan sebelum dimasukkan ke dalam senarai rujukan.)*
