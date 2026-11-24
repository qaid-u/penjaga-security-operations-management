# Carta Gantt dan Aktiviti Mingguan PSM 2 — PENJAGA
**Tempoh:** 21 September 2026 – 31 Disember 2026 (15 minggu)

> Sesuaikan minggu penghantaran dan pembentangan dengan takwim rasmi FSKTM/PSM 2 sebelum dimasukkan ke dalam Lampiran A. Aktiviti Minggu 1–10 mengikut susunan modul yang dibangunkan dan perlu disemak dengan rekod kerja sebenar; Minggu 11–15 ialah perancangan.

## Minggu

| Minggu | Tarikh |
|---|---|
| M1 | 21/09 – 27/09 |
| M2 | 28/09 – 04/10 |
| M3 | 05/10 – 11/10 |
| M4 | 12/10 – 18/10 |
| M5 | 19/10 – 25/10 |
| M6 | 26/10 – 01/11 |
| M7 | 02/11 – 08/11 |
| M8 | 09/11 – 15/11 |
| M9 | 16/11 – 22/11 |
| M10 | 23/11 – 29/11 |
| M11 | 30/11 – 06/12 |
| M12 | 07/12 – 13/12 |
| M13 | 14/12 – 20/12 |
| M14 | 21/12 – 27/12 |
| M15 | 28/12 – 31/12 |

## Carta Gantt

Jadual A.1: Carta Gantt pembangunan sistem PENJAGA (PSM 2)

| Aktiviti | M1 | M2 | M3 | M4 | M5 | M6 | M7 | M8 | M9 | M10 | M11 | M12 | M13 | M14 | M15 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **1. Perancangan semula** | | | | | | | | | | | | | | | |
| Semakan maklum balas PSM 1 dan kemas kini skop | ■ | | | | | | | | | | | | | | |
| Kemas kini product backlog dan pelan sprint | ■ | ■ | | | | | | | | | | | | | |
| **2. Pembangunan (Sprint)** | | | | | | | | | | | | | | | |
| Sprint A: Log masuk, peranan, pengguna dan pos | ■ | ■ | | | | | | | | | | | | | |
| Sprint B: Laporan harian, senarai semak dan lampiran | | ■ | ■ | | | | | | | | | | | | |
| Sprint C: Analisis NLP hibrid dan notifikasi risiko | | | ■ | ■ | ■ | | | | | | | | | | |
| Sprint D: Semakan laporan dan tindakan susulan | | | | ■ | ■ | | | | | | | | | | |
| Sprint E: Penjadualan, kehadiran dan import CSV | | | | | ■ | ■ | ■ | | | | | | | | |
| Sprint F: Papan pemuka, audit trail dan Pusat Kawalan 3D | | | | | ■ | ■ | ■ | | | | | | | | |
| Pembelajaran automatik dan pengesahan kategori | | | | | | | ■ | ■ | | | | | | | |
| **3. Pengujian** | | | | | | | | | | | | | | | |
| Ujian unit dan integrasi | | | ■ | ■ | ■ | ■ | ■ | ■ | ■ | ■ | | | | | |
| Ujian pelayar (Playwright) dan prestasi | | | | | ■ | ■ | ■ | ■ | | | | | | | |
| Ujian keselamatan dan pembaikan | | | | | ■ | | | ■ | ■ | ■ | | | | | |
| Penilaian model NLP | | | | | ■ | ■ | | | | | | | | | |
| Pengujian penerimaan pengguna (UAT) | | | | | | | | | | | ■ | ■ | | | |
| **4. Penyediaan untuk pengehosan** | | | | | | | | ■ | ■ | | | | | | |
| **5. Dokumentasi** | | | | | | | | | | | | | | | |
| Pembetulan Bab 1–4 | | | | | | | | | | ■ | ■ | | | | |
| Penulisan Bab 5 dan Bab 6 | | | | | | | | | | ■ | ■ | ■ | | | |
| Manual pengguna dan dokumen teknikal | | | | | | | | | ■ | | | ■ | | | |
| Penyediaan artikel AITCS | | | | | | | | | | | | ■ | ■ | | |
| **6. Penilaian akhir** | | | | | | | | | | | | | | | |
| Persediaan pembentangan dan demonstrasi | | | | | | | | | | | | ■ | ■ | | |
| Pembentangan PSM 2 | | | | | | | | | | | | | ■ | | |
| Pembetulan dan penghantaran laporan akhir | | | | | | | | | | | | | | ■ | ■ |

## Aktiviti Mingguan

Jadual A.2: Aktiviti mingguan PSM 2

| Minggu | Tarikh | Aktiviti | Hasil |
|---|---|---|---|
| M1 | 21/09 – 27/09 | Semak maklum balas penyelia PSM 1; kemas kini skop dan backlog; sediakan persekitaran pembangunan (React, Express, PostgreSQL); bangunkan log masuk JWT dan kawalan peranan | Backlog dikemas kini; modul log masuk |
| M2 | 28/09 – 04/10 | Bangunkan pengurusan pengguna dan pos kawalan; borang laporan harian dengan senarai semak dan lampiran | Modul pengguna, pos dan laporan harian |
| M3 | 05/10 – 11/10 | Bangunkan analisis NLP: pembersihan teks, kata kunci, skor dan tahap risiko; mula ujian unit | Analisis berasaskan peraturan berfungsi |
| M4 | 12/10 – 18/10 | Latih model Multinomial Naive Bayes; peraturan kontekstual (penafian, latihan, disyaki); semakan laporan oleh Ketua Pengawal | Analisis hibrid; modul semakan |
| M5 | 19/10 – 25/10 | Tindakan susulan; papan pemuka; Pusat Kawalan 3D; ujian prestasi dan keselamatan; penilaian model | Modul tindakan dan papan pemuka; laporan ujian |
| M6 | 26/10 – 01/11 | Penjadualan mingguan dan semakan pertindihan syif; audit trail dan eksport CSV; soalan penjelasan laporan | Modul penjadualan dan audit |
| M7 | 02/11 – 08/11 | Kehadiran (daftar masuk/keluar); isi kekosongan harian dan salin jadual; notifikasi dan pembelajaran automatik | Aliran operasi lengkap |
| M8 | 09/11 – 15/11 | Paparan mudah alih; integriti pangkalan data (migrasi); ujian pelayar; persediaan Docker dan Vercel | Sistem sedia untuk dihoskan |
| M9 | 16/11 – 22/11 | Pengesahan kategori oleh Ketua Pengawal; baiki aliran penjadualan; dokumen gambaran keseluruhan sistem | Ciri pengesahan; dokumentasi teknikal |
| M10 | 23/11 – 29/11 | Analisis kod; pembaikan keselamatan (penjadualan, sesi selepas tukar kata laluan, rahsia JWT); semakan Bab 1–4 berbanding sistem; draf Bab 5–6 | 147 ujian pelayan lulus; draf pembetulan dan Bab 5–6 |
| M11 | 30/11 – 06/12 | Jalankan UAT dengan pengawal, ketua pengawal dan pentadbir; kumpul soal selidik; kemas kini Bab 1–4 | Data UAT; Bab 1–4 dikemas kini |
| M12 | 07/12 – 13/12 | Analisis data UAT; lengkapkan Bab 5–6 dan tangkapan skrin; manual pengguna; mula artikel AITCS | Draf penuh laporan |
| M13 | 14/12 – 20/12 | Hantar draf kepada penyelia; persediaan slaid dan demonstrasi; pembentangan PSM 2 | Pembentangan selesai |
| M14 | 21/12 – 27/12 | Buat pembetulan berdasarkan ulasan panel dan penyelia | Laporan dibetulkan |
| M15 | 28/12 – 31/12 | Semakan akhir format, rujukan dan lampiran; penghantaran laporan akhir, artikel dan kod sumber | Penghantaran akhir |
