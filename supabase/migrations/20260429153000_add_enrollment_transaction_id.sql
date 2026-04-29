alter table public.enrollments
add column if not exists transaction_id text;
