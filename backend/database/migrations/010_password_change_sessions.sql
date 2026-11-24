-- Tokens issued before the most recent password change are rejected by the auth middleware.
-- Null means the password has not changed since this column was introduced.
alter table tbl_pengguna add column if not exists kata_laluan_ditukar timestamptz;
