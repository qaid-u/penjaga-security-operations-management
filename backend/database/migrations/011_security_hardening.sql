-- Tokens revoked by sign-out. Rows are removed once the token has expired.
create table if not exists tbl_token_dibatalkan (
  jti varchar(64) primary key,
  tamat timestamptz not null
);
create index if not exists idx_token_dibatalkan_tamat on tbl_token_dibatalkan(tamat);

create index if not exists idx_audit_activity_time on tbl_audit_trail(jenis_aktiviti, tarikh_masa_aktiviti desc);

-- The audit trail is append-only: application bugs and injected statements cannot rewrite history.
-- This does not restrain the table owner or a superuser, who can drop the trigger.
create or replace function penjaga_audit_append_only() returns trigger language plpgsql as $$
begin
  raise exception 'tbl_audit_trail hanya boleh ditambah' using errcode = '42501';
end
$$;

drop trigger if exists trg_audit_append_only on tbl_audit_trail;
create trigger trg_audit_append_only
  before update or delete or truncate on tbl_audit_trail
  for each statement execute function penjaga_audit_append_only();
