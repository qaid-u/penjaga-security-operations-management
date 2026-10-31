# PostgreSQL upgrade validation — 31 October 2026

The application uses standard PostgreSQL through Express and `pg`. No platform SDK was installed; provider-specific hostname handling and deployment instructions were removed. Private connection settings were retained and not committed.

## Implemented changes

- Ordered SQL migrations with a SHA-256 ledger, advisory locks, atomic rollback and read-only status inspection. Existing migration entry points delegate to the shared runner.
- Twenty validated checks covering core states, shifts, staffing counts, confidence and date/time order. Overnight assignments remain supported.
- Unique review/report and checklist/report indexes, plus date, notification, assignment and audit query indexes.
- Unknown risk as the default for new reports awaiting classification; historical risk fields are retained.
- Malaysian session timezone defaults without rewriting historical timestamp columns.
- One consistent snapshot for dashboard totals, classifications, comparisons and backlogs.
- Custom-format PostgreSQL backup, uploaded-evidence copy and completion manifest. Private backups are ignored by Git.
- Compose migration startup for both fresh and existing volumes, with no demo report/account seeds.

## Local upgrade results

The first upgrade attempt rejected the historical action status `Dalam Proses` and rolled back. Migration 007 was then made explicitly compatible with that known alias, converting it to `Dalam Tindakan` and auditing each conversion. Unknown invalid values still cause rollback.

Before the successful upgrade, application writers were stopped and a new database/evidence backup was taken. The backup was restored into a temporary database on a separate local test cluster; all 23 pre-upgrade tables matched record counts and full-row checksums. The temporary restore database was removed afterward. Backups and their private verification manifests remain outside Git.

The upgrade applied migrations 003–007, validated all 20 new checks, retained all 103 reports, preserved action IDs/content/operational dates and audited the five recognized status-label conversions. All other operational table checksums were unchanged. The resulting schema has 24 tables including the migration ledger. The local API was restarted afterward.

Tests exercise fresh initialization, repeated/concurrent upgrades, checksum mismatch rejection, transactional DDL/ledger rollback, unknown legacy values, audited alias normalization, duplicate reviews/answers and invalid direct writes. Authenticated workflow tests also run against migration 007. Archive readability and a local restore do not replace a production backup schedule, encrypted off-host storage or production recovery objectives. Docker image execution and a hosted deployment were not performed in this work.

Final verification: 129 backend tests passed; all four dashboard analytics/browser checks passed; lint and production build passed with the existing Fast Refresh and bundle-size warnings. Compose configuration parsed successfully using placeholder settings. The restarted local API returned 200 for health, database readiness and authenticated dashboard, action and unread-notification reads.
