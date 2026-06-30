-- Run this in Supabase Dashboard → SQL Editor

create table if not exists recipes (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  servings     int,
  tags         text[]  not null default '{}',
  ingredients  jsonb   not null default '[]',
  steps        jsonb   not null default '[]',
  created_at   timestamptz default now()
);

create table if not exists meal_plan (
  id         uuid primary key default gen_random_uuid(),
  date       date not null unique,
  recipe_id  uuid references recipes(id) on delete set null,
  created_at timestamptz default now()
);

-- Allow public read/write (no auth)
alter table recipes  enable row level security;
alter table meal_plan enable row level security;

create policy "public all" on recipes  for all using (true) with check (true);
create policy "public all" on meal_plan for all using (true) with check (true);
