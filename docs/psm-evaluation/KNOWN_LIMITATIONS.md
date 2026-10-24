# Known limitations and unperformed work

- The operational database's architectural anchors remain unlinked until an administrator verifies and saves real relationships. Demo mappings are fictional and confined to a separate database.
- Exterior model only: no verified interior floors, room positions, CCTV, access-control data, patrol routes, GPS tracking or incident coordinates. Floor navigation and continuous geographic heatmaps are unsupported.
- Stored NLP classifications are prototype outputs, not predictions or calibrated safety scores. Attendance records do not prove physical position. Report counts include review states unless explicitly filtered.
- Conventional report pages filter the currently loaded page; their existing server API does not implement the full 3D filter set. The 3D explorer performs its own server-side filtering and pagination. Report navigation currently opens the authorized general module, not an invented report-ID route.
- Software-rendered FPS remains below the provisional target. Physical desktop/phone GPUs, alternate browser engines, assistive screen-reader sessions, long-duration soak, GPU memory, throttled networks and production-size load tests are Not Run. Touch/pinch and responsive behavior were emulated.
- Query snapshots are periodic HTTP reads; independent panels can differ briefly as records change. No continuous streaming claim is made.
- Production hosting, real HTTPS/TLS certificate validation, backup restoration, real account provisioning, malware scanning and external penetration testing remain pending. See deployment checklist and security report for authentication/limiter boundaries.
- Human UAT/questionnaire responses are Pending Data Collection. Automated tests do not establish usability superiority. Empty templates and descriptive analysis must be populated with actual consenting participants before drawing research conclusions.
- Existing large frontend chunk advisories and one AuthContext Fast Refresh warning remain. No assertion of universal browser/device support or production readiness is made.
