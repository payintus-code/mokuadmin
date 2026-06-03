alter table public.shop_settings
  add column if not exists bank_code text,
  add column if not exists bank_name text,
  add column if not exists bank_account_no text,
  add column if not exists bank_account_name text;

