-- Additive: no historical report or analysis is rewritten and no external calls are made.
alter table tbl_hasil_nlp add column if not exists metadata jsonb not null default '{}'::jsonb;
-- Original narrative remains untouched; optional user clarification is stored separately.
alter table tbl_laporan_harian add column if not exists nlp_context jsonb not null default '{}'::jsonb;

create table if not exists tbl_job_nlp (
  id_job bigserial primary key,
  id_laporan integer not null references tbl_laporan_harian(id_laporan) on delete cascade,
  input_hash varchar(64) not null,
  pipeline_version varchar(80) not null,
  status varchar(20) not null default 'pending' check (status in ('pending','processing','completed','failed')),
  attempts integer not null default 0 check (attempts between 0 and 10),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  lease_token uuid,
  last_error varchar(80),
  id_nlp integer references tbl_hasil_nlp(id_nlp) on delete set null,
  requested_by integer references tbl_pengguna(id_pengguna) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(id_laporan,input_hash,pipeline_version)
);
create index if not exists idx_job_nlp_pending on tbl_job_nlp(available_at,id_job) where status='pending';
alter table tbl_job_nlp add column if not exists lease_token uuid;
create index if not exists idx_job_nlp_report on tbl_job_nlp(id_laporan,id_job desc);

create table if not exists tbl_maklum_balas_nlp (
  id_feedback bigserial primary key,
  id_nlp integer not null references tbl_hasil_nlp(id_nlp) on delete cascade,
  id_pengguna integer not null references tbl_pengguna(id_pengguna),
  decision varchar(30) not null check (decision in ('helpful','needs_correction')),
  comment varchar(1000) not null default '',
  created_at timestamptz not null default now(),
  unique(id_nlp,id_pengguna)
);

-- A report's conservative alert is emitted once, even if a job is retried/reanalysed.
create table if not exists tbl_amaran_nlp (
  id_laporan integer primary key references tbl_laporan_harian(id_laporan) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists idx_nlp_metadata_review on tbl_hasil_nlp((metadata->'review'->>'status'));
