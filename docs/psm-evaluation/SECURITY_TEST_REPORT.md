# Security assessment — 24 October 2026

Scope: current application, bounded local API/browser tests, isolated synthetic data and dependency advisories. This is not a claim of comprehensive penetration testing or production certification.

Verified controls:

- Missing, expired, wrongly signed, malformed-subject and non-Bearer tokens are rejected. HS256 is explicitly allowed; account activity and current database role are checked per request.
- Guards cannot read management 3D endpoints, audit/users/posts or change mappings. Chiefs can read 3D data and review reports but cannot change administrator-only mappings/action status. Administrators cannot invoke chief-only report approval/progress. Guard report reads are scoped to their own records.
- Date/ID/zone/risk/status/category/page bounds reject invalid inputs and SQL-shaped identifiers; unexpected 3D query keys and malformed JSON return controlled 400 responses. Missing locations return 404. Parameterized SQL remains in use.
- Evidence authorization now compares the complete stored path, including JSON-array and legacy scalar references. Prefix collisions fail. Other guards cannot retrieve an owner's file. MIME comes from bytes, preventing `.html` names from becoming HTML Blob previews; download/no-store/nosniff headers remain. Multipart content mismatch, oversized files and failed-form cleanup are tested.
- Operational query caches have an account/role lifetime. Corrupt saved identity returns login safely. Authentication remains enforced by backend middleware regardless of client-side storage.
- Private backend, operational environment, evaluation data and local demo-credential paths are denied by Vite. The original approved exterior GLB remains intentionally public; no operational data is bundled into it. Runtime credentials and real participant data are Git-ignored.
- Production-mode local checks confirm allowlisted origin headers, denied origins (403) and security headers. Production startup requires a non-placeholder JWT secret and explicit frontend origins. Forwarded IPs are trusted only with `TRUST_PROXY=1`; Compose enables this behind its internal single reverse proxy. Other topologies require operator review.
- Database connections have a five-second acquisition bound. Configured TLS verifies certificates; `sslmode` is normalized so the connection-string parser cannot silently override that policy. Custom CA material uses `PGSSL_CA`. A live remote TLS certificate chain remains untested.
- Central parsing errors expose fixed messages; controller diagnostics record error codes/names rather than query/connection details. Simulated storage failures return controlled responses without private DSN content.

Dependency evidence:

| Tree | Before | After |
| --- | --- | --- |
| Frontend | 16 advisories: 10 high, 5 moderate, 1 low | 0 known advisories |
| Backend | 11 advisories: 2 critical, 5 high, 4 moderate | 0 known advisories |

Raw npm audit JSON is retained under `evidence/`. Fixes include patched Vite/Axios/router/transitive dependencies, bcrypt 6, multer 2 and a patched `qs` override. Lucide was updated for React 19 compatibility. Unused Sequelize and SQLite dependencies were removed after checking runtime imports. Router remains in its existing declarative mode; relevant navigation regressions passed. Audit results describe the registry state at execution time, not a permanent guarantee.

Remaining boundaries: JWTs still use browser localStorage and a 12-hour lifetime; logout removes client credentials but does not revoke already stolen tokens. The login limiter is single-process/in-memory. File signature checks are not malware scanning or deep media validation. TLS termination, gateway limits, account provisioning, backup/restore, logging retention, distributed abuse controls and hosting isolation require deployment-specific work. No confidential operational records were used as presentation fixtures, and no production service was deployed.
