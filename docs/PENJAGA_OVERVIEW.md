# PENJAGA application overview

PENJAGA, or **Sistem Pengurusan Operasi Keselamatan Berasaskan Kepintaran Buatan**, brings guard scheduling, attendance, incident reporting, and follow-up into one application. It is designed around three roles: security guard, chief guard, and system administrator.

## Roles and responsibilities

| Role | Main responsibilities |
| --- | --- |
| **Pengawal Keselamatan** (security guard) | View the current or next shift, check in and out, submit daily reports and supporting evidence, and view personal report history and notifications. |
| **Ketua Pengawal** (chief guard) | Plan assignments, fill daily staffing gaps, review submitted reports, confirm incident categories, and flag reports that need follow-up. |
| **Pentadbir Sistem** (system administrator) | Manage user accounts and security posts, confirm or lock schedules, manage incident follow-up, review the audit trail, and monitor operations across posts. |

Express checks roles on protected API routes. The frontend presents the controls appropriate to each role, and the backend enforces the underlying permissions.

## Core workflows

### Duty scheduling and attendance

The weekly calendar shows daily staffing gaps. Selecting a day opens its roster, where shifts are grouped by security post. The **Isi kekosongan harian** form lets a scheduler select guards across several posts and shifts, then save the selections together. The backend checks for overlaps, including overnight assignments, and rolls back the batch if any assignment conflicts.

Schedulers can also preview and copy selected assignments into the following week's draft. Guards see their current or next shift in **Jadual Bertugas Saya**, with draft assignments identified as such. Changes to published assignments can notify the affected guards.

### Reports and follow-up

A guard submits a narrative, a completed checklist, and optional evidence. PENJAGA records the submission and queues local classification. The chief guard reviews the original report alongside the category and risk suggestions, decides whether to approve it, and records whether follow-up is needed. Administrators manage the subsequent actions and review their progress.

Reports and audit records support filtered CSV exports for authorized users. Report lists show the fields needed for triage. Opening an individual report loads the full narrative and associated records.

### Dashboards and Pusat Kawalan 3D

The dashboard presents operational counts and trends for the selected period. The 3D command centre connects selected security posts to available schedules, attendance records, reports, and follow-up actions. The building markers are visual estimates, and the operational information comes from database records. On phones and tablets, **Maklumat Lokasi** opens below the model. Labels, icons, and colors distinguish the types of records.

## Architecture

| Layer | Responsibility |
| --- | --- |
| **React and Vite** | Role-specific screens, navigation, dashboards, and the interactive building viewer. |
| **Node.js and Express** | Authentication, role and record access checks, scheduling rules, reporting, notifications, exports, and background jobs. |
| **PostgreSQL** | Accounts, posts, schedules, attendance, reports, reviews, follow-up, audit events, and model history. |
| **Persistent evidence storage** | Uploaded attachments. The Compose deployment uses a persistent volume and serves downloads through authenticated API routes. |
| **Docker Compose and Nginx** | The repository's full-stack deployment option, with a frontend proxy, Express service, and PostgreSQL on one host. |

For local use, `npm run dev:system` starts or reuses the frontend and API against an initialized PostgreSQL database. See the [deployment guide](../DEPLOYMENT.md) for hosting and first-admin setup.

## AI features and human review

- **Local classification.** A Multinomial Naive Bayes model and contextual rules suggest a category and risk level. The rules consider wording such as negation and drills. Suggestions are visible to reviewers alongside the source report.
- **Human validation and training.** A chief guard can accept or correct a category separately from report approval. Validation is kept in the report record. Training requires a separate opt-in and starts after at least 20 eligible new examples accumulate. Demo examples are excluded, and a candidate must pass regression checks before activation.
- **Optional external review.** Gemini review requires explicit opt-in. Report text is handled as untrusted input, the request gives the model no tools, and the response must match a validated schema and cite text from the report. The chief guard retains authority over review decisions.

See the [classification notes](testing/AUTOMATIC_CLASSIFICATION.md) and [automatic learning notes](testing/AUTOMATIC_LEARNING.md) for the training data, evaluation criteria, and activation process.

## Security and verification

- The development server blocks access to private runtime directories, backup files, and configuration paths. The local API binds to loopback by default.
- Private API responses use `no-store`. Guard accounts receive their own report data, and routine metadata requests from guards omit the staff roster.
- Request limits apply by IP and authenticated account, with separate limits for CSV exports, evidence downloads, report submissions, and selected analysis requests.
- Uploads have limits for file size, file count, and multipart fields. The API checks supported file signatures and record permissions before serving evidence.
- External AI requests reject redirects and cap the response size before parsing. Model output is advisory.

The local security pass verified the runtime-file fix with a synthetic canary and passed **145 backend tests**, **8 browser tests**, and the production build. Both production dependency audits reported zero known vulnerabilities at the time of the check.

Rate limits slow automated collection. Users can still copy data they are authorized to view, and published exterior model files remain public assets. Verify the hosted build and API separately before using the system with operational records.
