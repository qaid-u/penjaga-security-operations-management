-- Existing labels were explicitly supplied through the training confirmation flow.
alter table tbl_model_labels add column training_allowed boolean not null default true;
alter table tbl_model_labels alter column training_allowed set default false;
