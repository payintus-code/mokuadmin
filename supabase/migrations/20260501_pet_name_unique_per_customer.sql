alter table public.pets
  drop constraint if exists pets_name_key;

drop index if exists public.pets_name_key;
drop index if exists public.idx_pets_name_unique;
drop index if exists public.idx_pets_customer_name_unique;

create unique index if not exists idx_pets_customer_active_name_unique
  on public.pets (customer_id, name)
  where is_active = true;
