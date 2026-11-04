-- No historical approvals are treated as training labels. Confirmation is explicit and prospective.
create table if not exists tbl_model_labels (
  id_laporan integer primary key references tbl_laporan_harian(id_laporan) on delete cascade,
  reviewer_id integer not null references tbl_pengguna(id_pengguna),
  category varchar(100) not null,
  source_hash char(64) not null,
  family_hash char(64) not null,
  partition varchar(12) not null check(partition in ('train','validation')),
  confirmed_at timestamptz not null default now()
);
create index if not exists idx_model_labels_confirmed on tbl_model_labels(confirmed_at,id_laporan);
create table if not exists tbl_model_training_runs (
  id_run bigserial primary key,
  source_digest char(64) not null unique,
  label_count integer not null check(label_count>=0),
  label_keys jsonb not null default '[]'::jsonb,
  attempts integer not null default 1 check(attempts between 1 and 3),
  status varchar(20) not null check(status in ('training','promoted','rejected','failed')),
  model_version varchar(80),
  artifact jsonb,
  metrics jsonb not null default '{}'::jsonb,
  active boolean not null default false,
  reason varchar(80),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check(not active or (status='promoted' and artifact is not null and model_version is not null))
);
create unique index if not exists uq_active_classification_model on tbl_model_training_runs(active) where active;
