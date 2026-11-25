<!-- Sumber artikel AITCS PSM 2. Dijana ke .docx menggunakan templat AITCS (Bahasa Melayu). -->
TAJUK: Sistem Pengurusan Operasi Keselamatan Berasaskan Kepintaran Buatan (PENJAGA) dengan Analisis Laporan Hibrid
TITLE: An Artificial Intelligence-Based Security Operations Management System (PENJAGA) with Hybrid Report Analysis

ABSTRAK: Pengurusan operasi keselamatan yang bergantung kepada buku log dan laporan teks bebas menyebabkan insiden penting sukar dikenal pasti dan tindakan susulan menjadi lewat. Kajian ini membangunkan Sistem Pengurusan Operasi Keselamatan Berasaskan Kepintaran Buatan (PENJAGA), iaitu aplikasi web yang menggabungkan penjadualan pengawal, laporan harian digital, analisis laporan, semakan, tindakan susulan, papan pemuka dan audit trail dalam satu platform. Sistem dibangunkan menggunakan metodologi Agile dengan React, Express dan PostgreSQL. Analisis laporan menggunakan pendekatan hibrid, iaitu model Multinomial Naive Bayes yang dilatih dengan 2,000 contoh sintetik bersama peraturan kontekstual yang mengenal pasti ayat penafian, latihan dan insiden disyaki. Saluran hibrid mencapai F1 makro 95.7% pada set cabaran sintetik berbanding 61.5% bagi padanan kata kunci, dan kesemua 147 ujian pelayan lulus. Penilaian dengan data operasi dan pengguna sebenar diperlukan sebelum sistem digunakan secara operasi.

ABSTRACT: Security operations that rely on logbooks and free-text reports make important incidents difficult to identify and delay follow-up actions. This study develops PENJAGA, an artificial intelligence-based security operations management system that combines guard scheduling, digital daily reporting, report analysis, review, follow-up actions, dashboards and an audit trail in a single web platform. The system was developed using the Agile methodology with React, Express and PostgreSQL. Report analysis uses a hybrid approach in which a Multinomial Naive Bayes model trained on 2,000 synthetic examples is combined with contextual rules that recognise negated, drill and suspected events. The hybrid pipeline achieved a macro F1 of 95.7% on a synthetic challenge set compared with 61.5% for keyword matching, and all 147 backend tests passed. Evaluation with operational data and real users is required before operational use.

KATAKUNCI: Pengurusan operasi keselamatan; Pemprosesan Bahasa Semula Jadi; Naive Bayes; Analisis laporan insiden; Aplikasi web; Agile
KEYWORDS: Security operations management; Natural Language Processing; Naive Bayes; Incident report analysis; Web application; Agile

# Pendahuluan

Pengurusan operasi keselamatan melibatkan perancangan jadual pengawal, rekod kehadiran, pelaporan harian dan tindakan susulan bagi setiap insiden. Dalam kebanyakan organisasi berskala kecil dan sederhana, aktiviti ini masih direkod menggunakan buku log, fail rekod atau helaian hamparan. Laporan harian pula ditulis dalam bentuk teks bebas, maka penyelia perlu membaca setiap laporan satu per satu untuk mengenal pasti insiden yang penting.

Kaedah ini menimbulkan tiga masalah utama. Pertama, laporan tidak mempunyai format standard, maka maklumat kritikal mudah terlepas pandang. Kedua, tiada mekanisme automatik untuk mengelaskan insiden dan menilai tahap risikonya, maka tindakan susulan bergantung sepenuhnya kepada penilaian manual. Ketiga, ketiadaan sistem berpusat menyukarkan pencarian semula rekod, pemantauan trend dan pengesanan aktiviti pengguna. Padanan kata kunci yang mudah juga tidak mencukupi, kerana ayat seperti "tiada kebakaran" atau "latihan kebakaran" akan dikelaskan sebagai insiden kebakaran sebenar.

Objektif kajian ini ialah (i) mereka bentuk sistem pengurusan operasi keselamatan berasaskan web, (ii) membangunkan sistem yang mengintegrasikan analisis laporan harian menggunakan Pemprosesan Bahasa Semula Jadi (NLP), dan (iii) menguji serta menilai sistem dari segi fungsi, kebolehgunaan dan keupayaan mengenal pasti maklumat kritikal. Skop sistem merangkumi tiga peranan pengguna, iaitu Pengawal Keselamatan, Ketua Pengawal dan Pentadbir Sistem. Sistem tidak berintegrasi dengan CCTV, sensor atau GPS.

Bahagian 2 membincangkan kajian literatur. Bahagian 3 menerangkan metodologi serta analisis dan reka bentuk sistem. Bahagian 4 membentangkan hasil pembangunan dan pengujian, dan Bahagian 5 merumuskan kajian ini.

# Kajian Literatur

## Sistem Berasaskan Web

Sistem berasaskan web membolehkan aplikasi diakses melalui pelayar tanpa pemasangan perisian khusus. Seni bina pelanggan-pelayan memisahkan antara muka pengguna, logik aplikasi dan pangkalan data, maka setiap lapisan boleh dibangunkan dan diuji secara berasingan. Aplikasi web yang mengendalikan data operasi juga perlu mematuhi amalan keselamatan seperti pengesahan, kawalan akses dan pengesahan input [7].

## Pemprosesan Bahasa Semula Jadi dan Pengelasan Teks

NLP membolehkan komputer memproses bahasa manusia untuk tujuan pengelasan teks dan pengekstrakan maklumat [2], [4]. Model Multinomial Naive Bayes merupakan pengelas teks yang ringan dan mudah dijelaskan, kerana ia mengira kebarangkalian sesuatu kategori berdasarkan kekerapan perkataan dalam dokumen [5], [6]. Walau bagaimanapun, model berasaskan kekerapan perkataan tidak memahami konteks. Ayat yang menafikan sesuatu peristiwa atau menerangkan latihan mengandungi perkataan yang sama seperti laporan insiden sebenar. Oleh itu, kajian ini menggabungkan model terlatih dengan peraturan kontekstual.

## Kajian Sistem Sedia Ada

Tiga sistem sedia ada telah dikaji. Guardhouse menyokong penjadualan dan pengurusan tenaga kerja syarikat keselamatan [3]. SafetyCulture menyokong pemeriksaan, audit dan pelaporan insiden digital [8]. TrackTik menyediakan pengurusan tenaga kerja, rondaan dan pelaporan bagi operasi keselamatan [10]. Jadual 1 membandingkan sistem tersebut dengan PENJAGA.

Jadual 1 Perbandingan sistem sedia ada dengan PENJAGA

| Ciri utama | SafetyCulture [8] | TrackTik [10] | Guardhouse [3] | PENJAGA |
|---|---|---|---|---|
| Pelaporan insiden digital | Ya | Ya | Ya | Ya |
| Audit / pemeriksaan keselamatan | Ya | Tidak | Tidak | Ya |
| Pemantauan operasi masa nyata | Tidak | Ya | Ya | Ya |
| Pengurusan pengawal | Tidak | Ya | Ya | Ya |
| Analisis kandungan laporan menggunakan NLP | Tidak | Tidak | Tidak | Ya |
| Pengecaman tahap risiko automatik | Tidak | Tidak | Tidak | Ya |
| Penyimpanan data berpusat | Ya | Ya | Ya | Ya |
| Dashboard analitik | Ya | Ya | Ya | Ya |
| Integrasi pelaporan, analisis dan audit trail | Tidak | Terhad | Terhad | Ya |

Berdasarkan Jadual 1, ketiga-tiga sistem tidak menganalisis kandungan laporan teks bebas untuk mengenal pasti kategori dan tahap risiko insiden. PENJAGA dibangunkan untuk mengisi jurang ini.

# Metodologi Kerangka Kajian

Kajian ini menggunakan metodologi Agile, iaitu pembangunan secara berulang dalam beberapa sprint [1]. Setiap sprint menghasilkan modul yang boleh diuji, dan maklum balas penyelia digunakan untuk memperbaiki sprint seterusnya. Jadual 2 meringkaskan fasa pembangunan.

Jadual 2 Fasa pembangunan sistem PENJAGA

| Fasa | Aktiviti utama | Hasil |
|---|---|---|
| Perancangan | Mengenal pasti masalah, objektif, skop dan jadual projek | Cadangan projek dan carta Gantt |
| Analisis | Mengenal pasti keperluan fungsian, bukan fungsian dan pengguna | Spesifikasi keperluan |
| Reka bentuk | Rajah konteks, DFD, ERD, seni bina dan antara muka | Dokumen reka bentuk |
| Pelaksanaan | Enam sprint: pengguna, laporan, analisis NLP, semakan, penjadualan, papan pemuka dan audit | Sistem PENJAGA |
| Pengujian | Ujian unit, integrasi, pelayar, keselamatan, prestasi dan UAT | Laporan pengujian |

## Analisis Keperluan dan Aliran Data

Sistem mempunyai enam modul utama seperti dalam Jadual 3.

Jadual 3 Modul utama dan pengguna sistem PENJAGA

| Modul | Fungsi utama | Pengguna |
|---|---|---|
| Pengurusan pengguna | Pendaftaran, log masuk dan kawalan peranan | Semua pengguna |
| Laporan harian digital | Borang laporan, senarai semak rondaan dan lampiran bukti | Pengawal Keselamatan |
| Analisis laporan NLP | Kategori insiden, status peristiwa dan tahap risiko | Sistem (automatik) |
| Pengurusan insiden | Semakan laporan, pengesahan kategori dan tindakan susulan | Ketua Pengawal, Pentadbir Sistem |
| Papan pemuka dan notifikasi | Statistik operasi, trend dan amaran risiko tinggi | Ketua Pengawal, Pentadbir Sistem |
| Audit trail | Rekod aktiviti, penapisan dan eksport CSV | Pentadbir Sistem |

Rajah 1 menunjukkan rajah konteks sistem dengan tiga entiti luaran. Rajah 2 menunjukkan DFD Tahap 0 yang menghubungkan enam proses utama dengan lapan stor data.

![Rajah 1 Rajah konteks sistem PENJAGA](context)

![Rajah 2 DFD Tahap 0 sistem PENJAGA](dfd0)

## Seni Bina dan Pangkalan Data

PENJAGA menggunakan seni bina tiga lapisan. Lapisan hadapan dibina menggunakan React, pelayan aplikasi menggunakan Express.js, dan data disimpan dalam pangkalan data PostgreSQL. Setiap permintaan disahkan menggunakan token JWT, dan peranan pengguna disemak semula daripada pangkalan data pada setiap permintaan. Rajah 3 menunjukkan seni bina sistem dan Rajah 4 menunjukkan gambarajah hubungan entiti.

![Rajah 3 Seni bina sistem PENJAGA](arch)

![Rajah 4 Gambarajah hubungan entiti sistem PENJAGA](erd)

## Reka Bentuk Analisis Laporan Hibrid

Setiap laporan disimpan bersama satu tugas analisis dalam satu transaksi pangkalan data, maka laporan tidak hilang walaupun analisis gagal. Pemproses latar belakang kemudian menganalisis laporan dalam lima peringkat:

- Prapemprosesan: teks dibersihkan, ditukar kepada huruf kecil dan ditokenkan.
- Pengelasan topik: model Multinomial Naive Bayes mencadangkan satu daripada lapan kategori insiden.
- Analisis konteks: peraturan kontekstual menentukan sama ada setiap peristiwa dilaporkan, disyaki, dinafikan, latihan atau tidak jelas.
- Penilaian risiko: skor 0 hingga 100 dipetakan kepada Rendah (0-30), Sederhana (31-60), Tinggi (61-80) dan Kritikal (81-100).
- Amaran: notifikasi dihantar kepada Ketua Pengawal bagi laporan berisiko Tinggi atau Kritikal.

Model Naive Bayes memilih kategori c yang memaksimumkan kebarangkalian posterior berdasarkan kiraan perkataan w dalam laporan d, seperti dalam Persamaan (1) [6]:

EQ: ĉ = argmax_c [ log P(c) + Σ_w n(w,d) · log P(w | c) ] | (1)

Model dilatih menggunakan 2,000 contoh laporan sintetik yang seimbang merentasi lapan kategori: Rondaan Biasa, Pencerobohan, Kebakaran, Pergaduhan, Kehilangan Aset, Vandalisme, Keselamatan Fizikal dan Kerosakan Kemudahan. Sebanyak 1,576 contoh digunakan untuk latihan dan 424 contoh untuk penilaian. Variasi daripada senario yang sama dikekalkan dalam satu partisi bagi mengelakkan kebocoran data. Keputusan rasmi kekal di tangan Ketua Pengawal, dan kategori yang disahkan secara eksplisit boleh digunakan untuk melatih semula model selepas lulus semakan regresi.

## Kaedah Pengujian

Pengujian dijalankan pada tiga peringkat: ujian unit, ujian integrasi terhadap API sebenar dan pangkalan data PostgreSQL sementara, serta ujian pelayar menggunakan Playwright. Model analisis dinilai menggunakan skor F1 makro, iaitu purata skor F1 bagi setiap kategori [9]:

EQ: F1 = 2 × (Kepersisan × Dapatan semula) / (Kepersisan + Dapatan semula) | (2)

Pengujian penerimaan pengguna (UAT) menggunakan soal selidik sembilan item berskala Likert 1-5 bersama senario tugasan bagi setiap peranan.

# Hasil Dapatan Kajian

## Modul yang Dibangunkan

Kesemua enam modul telah dibangunkan, bersama modul penjadualan dan kehadiran serta Pusat Kawalan 3D yang memaparkan lapan bangunan dengan 15 pos kawalan. Pengawal menghantar laporan melalui borang mesra telefon dengan sehingga enam lampiran. Ketua Pengawal menyemak laporan bersama cadangan kategori dan tahap risiko, kemudian meluluskan atau menolak laporan. Pentadbir Sistem mencipta tindakan susulan dan memantau audit trail.

FIG_PLACEHOLDER: Rajah 5 Antara muka semakan laporan bersama hasil analisis

## Pengujian Fungsi

Jadual 4 meringkaskan keputusan pengujian fungsi automatik. Kesemua ujian yang dijalankan lulus. Pengujian turut mengesan 15 kecacatan, termasuk kebenaran muat turun lampiran berdasarkan padanan sebahagian nama dan token lama yang kekal sah selepas kata laluan ditukar. Semua kecacatan dibaiki dan disertakan ujian regresi.

Jadual 4 Keputusan pengujian fungsi automatik

| Suite ujian | Skop | Ujian | Lulus |
|---|---|---|---|
| Ujian pelayan | API, peranan, aliran laporan, NLP, penjadualan, keselamatan | 147 | 147 |
| Ujian logik bangunan 3D | Model, penanda dan penempatan pos | 33 | 33 |
| Ujian pelayar 3D | Paparan model, interaksi dan emulasi mudah alih | 18 | 18 |
| Ujian pelayar aliran demo | Log masuk sebenar, pertukaran akaun dan fail peribadi | 5 | 5 |

## Penilaian Model Analisis Laporan

Model Naive Bayes sahaja mencapai F1 makro 78.2% pada 424 contoh pembangunan. Jadual 5 menunjukkan prestasi bagi setiap kategori. Kategori Kebakaran, Vandalisme dan Kerosakan Kemudahan mencapai F1 melebihi 89%, manakala Keselamatan Fizikal dan Pencerobohan paling rendah kerana kedua-duanya berkongsi kosa kata seperti pintu, pagar dan akses.

Jadual 5 Prestasi model Naive Bayes mengikut kategori (n = 424)

| Kategori | Kepersisan (%) | Dapatan semula (%) | F1 (%) |
|---|---|---|---|
| Kebakaran | 81.0 | 100.0 | 89.5 |
| Kehilangan Aset | 85.7 | 80.0 | 82.8 |
| Kerosakan Kemudahan | 97.9 | 85.2 | 91.1 |
| Keselamatan Fizikal | 70.7 | 55.8 | 62.4 |
| Pencerobohan | 57.4 | 72.9 | 64.2 |
| Pergaduhan | 70.4 | 76.0 | 73.1 |
| Rondaan Biasa | 70.7 | 71.9 | 71.3 |
| Vandalisme | 100.0 | 84.6 | 91.7 |
| Purata makro | | | 78.2 |

Jadual 6 membandingkan saluran hibrid dengan padanan kata kunci pada set cabaran sintetik yang tidak digunakan dalam latihan.

Jadual 6 Perbandingan saluran hibrid dengan padanan kata kunci

| Penilaian | Sampel | Kata kunci | Hibrid |
|---|---|---|---|
| F1 makro kategori | 26 | 61.5% | 95.7% |
| Ketepatan status peristiwa | 40 | - | 90.0% |
| Risiko Tinggi/Kritikal pada kes penafian dan latihan | 8 | - | 0 daripada 8 |

Saluran hibrid mengenal pasti kesemua ayat penafian dan latihan dengan betul. Median masa analisis bagi satu laporan ialah 1.54 ms. Walau bagaimanapun, polisi notifikasi sengaja mengekalkan perlindungan kata kunci, maka amaran masih dihantar bagi lima daripada lapan kes tersebut supaya insiden sebenar tidak terlepas.

## Pengujian Keselamatan dan Prestasi

Pengujian keselamatan dijalankan secara automatik terhadap API dan antara muka menggunakan data sintetik. Jadual 7 meringkaskan kawalan yang disahkan.

Jadual 7 Keputusan pengujian keselamatan

| Kawalan | Keputusan |
|---|---|
| Token tamat, salah tandatangan atau berformat salah | Ditolak (401) |
| Pengawal mengakses data atau laluan pengurusan | Ditolak (403) |
| Input berbentuk SQL dan parameter tidak sah | Ditolak (400); pertanyaan SQL berparameter |
| Muat turun lampiran milik pengguna lain | Ditolak; jenis fail ditentukan daripada kandungan |
| Token sebelum pertukaran kata laluan | Ditolak (401) |
| Audit kebergantungan (npm audit) | Hadapan 16 kepada 0; pelayan 11 kepada 0 nasihat |

Selepas pengoptimuman, panggilan lukisan Pusat Kawalan 3D berkurang daripada 384 kepada 192 setiap bingkai, dan masa model sedia pada desktop berkurang daripada 4,321 ms kepada 3,471 ms. Kesemua respons API median adalah di bawah 60 ms. Ujian prestasi dijalankan menggunakan WebGL perisian, maka prestasi pada peranti sebenar masih perlu disahkan.

FIG_PLACEHOLDER: Rajah 6 Papan pemuka analitik

FIG_PLACEHOLDER: Rajah 7 Pusat Kawalan 3D dan panel data pos

## Pengujian Penerimaan Pengguna

[MASUKKAN] Bilangan responden mengikut peranan, tarikh ujian, kadar tugasan berjaya, masa purata menghantar laporan dan median bagi setiap item soal selidik.

Jadual 8 Keputusan soal selidik kebolehgunaan

| Item | n | Median |
|---|---|---|
| Saya boleh menavigasi antara muka dengan mudah | [MASUKKAN] | |
| Maklumat operasi yang dipaparkan jelas | | |
| Antara muka bertindak balas cukup pantas | | |
| Secara keseluruhan, saya berpuas hati dengan antara muka ini | | |

## Perbincangan

Gabungan model terlatih dan peraturan kontekstual terbukti lebih berkesan daripada padanan kata kunci, kerana model mengenal pasti topik manakala peraturan menentukan sama ada peristiwa itu benar-benar berlaku. Reka bentuk sistem mengekalkan keputusan rasmi di tangan manusia: cadangan model tidak meluluskan laporan atau mencipta tindakan secara automatik. Walau bagaimanapun, semua data penilaian adalah sintetik dan dilabel oleh pembangun, maka keputusan ini ialah bukti pembangunan dan bukan ketepatan operasi sebenar.

# Kesimpulan

Kajian ini telah membangunkan PENJAGA, iaitu sistem pengurusan operasi keselamatan berasaskan web yang mengintegrasikan penjadualan, pelaporan harian digital, analisis laporan hibrid, tindakan susulan, papan pemuka dan audit trail. Pengujian automatik mengesahkan bahawa keperluan fungsian dipenuhi dan kawalan akses dikuatkuasakan di pelayan. Saluran analisis hibrid mencapai F1 makro 95.7% pada set cabaran sintetik dan mengenal pasti kesemua ayat penafian dan latihan. Batasan utama kajian ialah penggunaan data sintetik dan penilaian kebolehgunaan yang terhad. Kerja masa hadapan termasuk menilai model dengan laporan operasi sebenar yang dilabel oleh pakar, mentakrif semula kategori yang bertindih, dan menjalankan UAT dengan lebih ramai pengguna di premis sebenar.

# Penghargaan

Penulis ingin mengucapkan terima kasih kepada Fakulti Sains Komputer dan Teknologi Maklumat, Universiti Tun Hussein Onn Malaysia atas sokongan dan dorongan sepanjang kajian ini dijalankan.

# Konflik Kepentingan

Penulis mengisytiharkan bahawa tiada konflik kepentingan berkaitan dengan penerbitan artikel ini.

# Sumbangan Penulis

Penulis mengesahkan sumbangan kepada artikel ini seperti berikut: konsepsi dan reka bentuk kajian: Muhammad Qaid Uqail Bin Khairul Anuar, Suziyanti Binti Marjudi; pembangunan sistem dan pengumpulan data: Muhammad Qaid Uqail Bin Khairul Anuar; analisis dan interpretasi hasil: Muhammad Qaid Uqail Bin Khairul Anuar, Suziyanti Binti Marjudi; penyediaan draf manuskrip: Muhammad Qaid Uqail Bin Khairul Anuar. Semua penulis telah menyemak hasil dan meluluskan versi akhir manuskrip.

# Rujukan

REF: [1] Beck, K., Beedle, M., van Bennekum, A., Cockburn, A., Cunningham, W., Fowler, M., Grenning, J., Highsmith, J., Hunt, A., Jeffries, R., Kern, J., Marick, B., Martin, R. C., Mellor, S., Schwaber, K., Sutherland, J., & Thomas, D. (2001). Manifesto for Agile software development. https://agilemanifesto.org/
REF: [2] Bird, S., Klein, E., & Loper, E. (2009). Natural language processing with Python. O'Reilly Media.
REF: [3] Guardhouse. (n.d.). Streamline your security business. Guardhouse. https://www.guardhousehq.com/
REF: [4] Jurafsky, D., & Martin, J. H. (2025). Speech and language processing (3rd ed. draft). Stanford University. https://web.stanford.edu/~jurafsky/slp3/
REF: [5] Manning, C. D., Raghavan, P., & Schütze, H. (2008). Introduction to information retrieval. Cambridge University Press.
REF: [6] McCallum, A., & Nigam, K. (1998). A comparison of event models for naive Bayes text classification. In AAAI-98 Workshop on Learning for Text Categorization (pp. 41-48).
REF: [7] OWASP Foundation. (n.d.). OWASP Foundation, the open-source foundation for application security. OWASP. https://owasp.org/
REF: [8] SafetyCulture. (n.d.). Incident management software & solution. SafetyCulture. https://safetyculture.com/
REF: [9] Sokolova, M., & Lapalme, G. (2009). A systematic analysis of performance measures for classification tasks. Information Processing & Management, 45(4), 427-437.
REF: [10] TrackTik. (n.d.). Security workforce management across the globe. TrackTik. https://www.tracktik.com/
