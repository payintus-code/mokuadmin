create extension if not exists pg_trgm;

create index if not exists idx_customers_active_created_at
  on public.customers (created_at desc)
  where is_active = true;

create index if not exists idx_pets_active_created_at
  on public.pets (created_at desc)
  where is_active = true;

create index if not exists idx_customers_full_name_trgm
  on public.customers using gin (full_name gin_trgm_ops)
  where is_active = true;

create index if not exists idx_customers_phone_trgm
  on public.customers using gin (phone gin_trgm_ops)
  where is_active = true;

create index if not exists idx_customers_facebook_name_trgm
  on public.customers using gin (facebook_name gin_trgm_ops)
  where is_active = true and facebook_name is not null;

create index if not exists idx_pets_name_trgm
  on public.pets using gin (name gin_trgm_ops)
  where is_active = true;

create index if not exists idx_pets_species_trgm
  on public.pets using gin (species gin_trgm_ops)
  where is_active = true;

create index if not exists idx_pets_breed_trgm
  on public.pets using gin (breed gin_trgm_ops)
  where is_active = true and breed is not null;
