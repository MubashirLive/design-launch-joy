
create type public.app_role as enum ('super_admin', 'admin');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "view own roles" on public.user_roles for select to authenticated
using (auth.uid() = user_id or public.has_role(auth.uid(), 'super_admin'));
create policy "sa manage roles" on public.user_roles for all to authenticated
using (public.has_role(auth.uid(), 'super_admin'))
with check (public.has_role(auth.uid(), 'super_admin'));

create table public.admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  admin_id text not null unique,
  full_name text not null,
  email text not null,
  is_active boolean not null default true,
  forms_filled_count integer not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
alter table public.admins enable row level security;

create policy "view own admin" on public.admins for select to authenticated
using (auth.uid() = user_id or public.has_role(auth.uid(), 'super_admin'));
create policy "sa manage admins" on public.admins for all to authenticated
using (public.has_role(auth.uid(), 'super_admin'))
with check (public.has_role(auth.uid(), 'super_admin'));

create table public.counters (
  name text primary key,
  value integer not null default 0
);
insert into public.counters(name, value) values ('global_registration', 0), ('receipt', 0)
on conflict do nothing;

create or replace function public.next_counter(_name text)
returns integer language plpgsql security definer set search_path = public as $$
declare v integer;
begin
  update public.counters set value = value + 1 where name = _name returning value into v;
  if v is null then
    insert into public.counters(name, value) values (_name, 1) returning value into v;
  end if;
  return v;
end $$;

create or replace function public.next_admin_id(_first_name text)
returns text language plpgsql security definer set search_path = public as $$
declare prefix text; n integer;
begin
  prefix := upper(rpad(left(regexp_replace(_first_name, '[^A-Za-z]', '', 'g'), 3), 3, 'X'));
  select coalesce(max(substring(admin_id from 4)::int), 0) + 1 into n
    from public.admins where admin_id like prefix || '%';
  return prefix || lpad(n::text, 3, '0');
end $$;

create type public.shift_type as enum ('MORNING', 'EVENING');
create type public.payment_mode as enum ('CASH', 'ONLINE');

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  receipt_number text unique,
  registration_number integer unique,
  registration_id text unique,
  is_draft boolean not null default false,
  shift shift_type not null,
  student_name text not null,
  date_of_birth date not null,
  age integer not null,
  gender text not null,
  class text not null,
  school_name text not null,
  email text not null,
  father_name text not null,
  father_contact text not null,
  mother_name text,
  mother_contact text,
  emergency_contact text not null,
  address text not null,
  city text not null,
  activities jsonb not null default '[]'::jsonb,
  mess_opted boolean not null default false,
  mess_fee integer not null default 0,
  transport_opted boolean not null default false,
  transport_address text,
  transport_fee integer not null default 0,
  combo_applied boolean not null default false,
  combo_discount integer not null default 0,
  total_amount integer not null default 0,
  payment_mode payment_mode not null,
  allergies_medications text,
  photo_url text,
  marksheet_url text,
  remarks text,
  enrolled_by uuid references auth.users(id) not null,
  enrolled_at timestamptz not null default now(),
  last_edited_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.enrollments enable row level security;

create policy "view enrollments" on public.enrollments for select to authenticated
using (enrolled_by = auth.uid() or public.has_role(auth.uid(), 'super_admin'));

create policy "insert enrollments" on public.enrollments for insert to authenticated
with check (enrolled_by = auth.uid()
  and (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'super_admin')));

create policy "sa update enrollments" on public.enrollments for update to authenticated
using (public.has_role(auth.uid(), 'super_admin'))
with check (public.has_role(auth.uid(), 'super_admin'));

create policy "admin update own draft" on public.enrollments for update to authenticated
using (enrolled_by = auth.uid() and is_draft = true)
with check (enrolled_by = auth.uid());

create policy "sa delete enrollments" on public.enrollments for delete to authenticated
using (public.has_role(auth.uid(), 'super_admin'));

create or replace function public.increment_forms_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_draft = false and (tg_op = 'INSERT' or (tg_op = 'UPDATE' and old.is_draft = true)) then
    update public.admins set forms_filled_count = forms_filled_count + 1
      where user_id = new.enrolled_by;
  end if;
  return new;
end $$;

create trigger enrollment_forms_count
after insert or update on public.enrollments
for each row execute function public.increment_forms_count();
