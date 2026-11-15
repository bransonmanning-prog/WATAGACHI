-- WATAGACHI class-project starter schema (illustrative; review before use).
-- Paste into a new Supabase project's SQL Editor after reviewing IDs and policy needs.

create extension if not exists pgcrypto;

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  item_type text not null check (item_type in ('parent','component')),
  size_oz numeric,
  colors text[] not null default '{}',
  retail_price numeric(12,2),
  unit_cost numeric(12,4),
  lead_time_days integer not null default 0 check (lead_time_days >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.bom_lines (
  id uuid primary key default gen_random_uuid(),
  parent_item_id uuid not null references public.items(id) on delete cascade,
  component_item_id uuid not null references public.items(id),
  quantity_per numeric(12,4) not null check (quantity_per > 0),
  unique(parent_item_id, component_item_id),
  check (parent_item_id <> component_item_id)
);

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null
);

create table if not exists public.inventory_balances (
  item_id uuid not null references public.items(id),
  location_id uuid not null references public.locations(id),
  quantity_on_hand numeric(12,3) not null default 0,
  average_unit_cost numeric(12,4) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (item_id, location_id)
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  quoted_lead_time_days integer not null default 0,
  payment_terms text,
  created_at timestamptz not null default now()
);

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_number text not null unique,
  supplier_id uuid references public.suppliers(id),
  status text not null check (status in ('draft','sent','partially_received','received','closed','cancelled')),
  ordered_at date,
  expected_at date,
  received_at date,
  created_at timestamptz not null default now()
);

create table if not exists public.purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  item_id uuid not null references public.items(id),
  quantity_ordered numeric(12,3) not null check (quantity_ordered > 0),
  quantity_received numeric(12,3) not null default 0 check (quantity_received >= 0),
  unit_cost numeric(12,4) not null default 0
);

create table if not exists public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_name text not null,
  required_at date not null,
  status text not null check (status in ('draft','confirmed','fulfilled','closed','cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.sales_order_lines (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null references public.sales_orders(id) on delete cascade,
  item_id uuid not null references public.items(id),
  quantity numeric(12,3) not null check (quantity > 0),
  unit_price numeric(12,2) not null default 0
);

create table if not exists public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  source_type text not null check (source_type in ('sale','return','receipt','adjustment','expense')),
  source_id uuid,
  account_code text not null,
  debit numeric(12,2) not null default 0,
  credit numeric(12,2) not null default 0,
  item_id uuid references public.items(id),
  location_id uuid references public.locations(id),
  note text
);

create index if not exists sales_orders_status_required_idx on public.sales_orders(status, required_at);
create index if not exists purchase_orders_status_expected_idx on public.purchase_orders(status, expected_at);
create index if not exists financial_transactions_occurred_idx on public.financial_transactions(occurred_at);

-- For a class demo, configure Supabase Auth and explicit RLS policies before sharing.
-- The schema intentionally does not enable broad public write access.

-- WATAGACHI additions for the integrated class-project preview.
-- The browser app can share its complete editable state through erp_state.
-- The normalized tables below are available for migration from the snapshot
-- once the team settles the final entities and RPCs.

alter table public.items add column if not exists barcode text unique;
alter table public.suppliers add column if not exists contact_name text;
alter table public.suppliers add column if not exists email text;
alter table public.suppliers add column if not exists payment_terms_days integer not null default 30;
alter table public.inventory_balances add column if not exists quantity_reserved numeric(12,3) not null default 0;
alter table public.purchase_orders add column if not exists invoice_date date;
alter table public.purchase_orders add column if not exists payment_status text not null default 'not_due';
alter table public.purchase_orders add column if not exists amount_paid numeric(12,2) not null default 0;
alter table public.sales_orders add column if not exists location_id uuid references public.locations(id);
alter table public.sales_orders add column if not exists fulfilled_at timestamptz;

create table if not exists public.production_orders (
  id uuid primary key default gen_random_uuid(),
  work_order_number text not null unique,
  parent_item_id uuid not null references public.items(id),
  location_id uuid not null references public.locations(id),
  quantity_started numeric(12,3) not null check (quantity_started > 0),
  quantity_good numeric(12,3) not null default 0,
  quantity_scrapped numeric(12,3) not null default 0,
  quantity_reworked numeric(12,3) not null default 0,
  quality_reason text,
  status text not null check (status in ('draft','issued','completed','cancelled')),
  started_at timestamptz,
  finished_at timestamptz,
  rolled_unit_cost numeric(12,4) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.customer_returns (
  id uuid primary key default gen_random_uuid(),
  return_number text not null unique,
  sales_order_id uuid references public.sales_orders(id),
  item_id uuid not null references public.items(id),
  location_id uuid not null references public.locations(id),
  quantity numeric(12,3) not null check (quantity > 0),
  reason_code text not null,
  disposition text not null check (disposition in ('restock','scrap','rework')),
  exchange_item_id uuid references public.items(id),
  revenue_reversal numeric(12,2) not null default 0,
  cost_reversal numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_adjustments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id),
  location_id uuid not null references public.locations(id),
  quantity_delta numeric(12,3) not null,
  reason_code text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_transfers (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id),
  from_location_id uuid not null references public.locations(id),
  to_location_id uuid not null references public.locations(id),
  quantity numeric(12,3) not null check (quantity > 0),
  reason text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (from_location_id <> to_location_id)
);

create table if not exists public.supplier_payment_events (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id),
  amount numeric(12,2) not null check (amount >= 0),
  paid_at date,
  due_at date not null,
  payment_status text not null check (payment_status in ('unpaid','partial','paid')),
  reference text
);

create table if not exists public.inventory_ordering_settings (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null unique references public.items(id),
  ordering_cost numeric(12,2) not null default 0,
  annual_holding_rate numeric(8,5) not null default .22,
  review_period_days integer not null default 7,
  safety_stock_days integer not null default 5,
  last_reviewed_at date
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'staff' check (role in ('admin','manager','staff','customer')),
  created_at timestamptz not null default now()
);

-- One shared WATAGACHI snapshot lets the static preview sync edits in real time.
-- Only signed-in Supabase users can read or write it; never enable anon writes.
create table if not exists public.erp_state (
  id text primary key check (id = 'watagachi'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
create or replace function public.touch_erp_state_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists erp_state_touch_updated_at on public.erp_state;
create trigger erp_state_touch_updated_at before update on public.erp_state
for each row execute function public.touch_erp_state_updated_at();

alter table public.erp_state enable row level security;
drop policy if exists "team members can read WATAGACHI state" on public.erp_state;
drop policy if exists "team members can write WATAGACHI state" on public.erp_state;
create policy "team members can read WATAGACHI state" on public.erp_state
  for select to authenticated using (true);
create policy "team members can write WATAGACHI state" on public.erp_state
  for all to authenticated using (true) with check (true);
grant select, insert, update on public.erp_state to authenticated;

alter table public.profiles enable row level security;
drop policy if exists "users read own profile" on public.profiles;
drop policy if exists "users create own profile" on public.profiles;
create policy "users read own profile" on public.profiles
  for select to authenticated using (user_id = auth.uid());
create policy "users create own profile" on public.profiles
  for insert to authenticated with check (user_id = auth.uid() and role in ('staff','customer'));
grant select, insert on public.profiles to authenticated;

-- Enable row-level protection for future relational reads/writes. The prototype
-- currently writes only erp_state; use authenticated-only policies when you
-- migrate the app to direct table operations.
alter table public.production_orders enable row level security;
alter table public.customer_returns enable row level security;
alter table public.inventory_adjustments enable row level security;
alter table public.inventory_transfers enable row level security;
alter table public.supplier_payment_events enable row level security;
alter table public.inventory_ordering_settings enable row level security;

-- Realtime publication enables other signed-in tabs/devices to receive updates.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'erp_state') then
    alter publication supabase_realtime add table public.erp_state;
  end if;
end $$;

-- Match the app's explicit order lifecycle while retaining the original draft state.
alter table public.sales_orders drop constraint if exists sales_orders_status_check;
alter table public.sales_orders add constraint sales_orders_status_check
  check (status in ('draft','order_placed','confirmed','fulfilled','closed','cancelled'));

-- New sign-ups are customer-only until an administrator grants team access.
create or replace function public.handle_new_wat_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, display_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)), 'customer')
  on conflict (user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_wat_user_created on auth.users;
create trigger on_wat_user_created after insert on auth.users
for each row execute function public.handle_new_wat_user();

create or replace function public.is_wat_team_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role in ('admin','manager','staff')
  );
$$;
grant execute on function public.is_wat_team_member() to authenticated;
drop policy if exists "team members can read WATAGACHI state" on public.erp_state;
drop policy if exists "team members can write WATAGACHI state" on public.erp_state;
create policy "team members can read WATAGACHI state" on public.erp_state
  for select to authenticated using (public.is_wat_team_member());
create policy "team members can write WATAGACHI state" on public.erp_state
  for all to authenticated using (public.is_wat_team_member()) with check (public.is_wat_team_member());

drop policy if exists "users create own profile" on public.profiles;
revoke insert, update, delete on public.profiles from authenticated;
grant select on public.profiles to authenticated;
