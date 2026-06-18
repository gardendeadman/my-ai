-- 크레딧 테이블
create table if not exists user_credits (
  user_id uuid references auth.users on delete cascade primary key,
  credits integer not null default 0,
  updated_at timestamptz default now()
);

alter table user_credits enable row level security;

create policy "본인만 조회" on user_credits
  for select using (auth.uid() = user_id);

create policy "본인만 수정" on user_credits
  for all using (auth.uid() = user_id);

-- 출석체크 테이블
create table if not exists daily_checkins (
  user_id uuid references auth.users on delete cascade primary key,
  last_checkin date not null
);

alter table daily_checkins enable row level security;

create policy "본인만 조회" on daily_checkins
  for select using (auth.uid() = user_id);

create policy "본인만 수정" on daily_checkins
  for all using (auth.uid() = user_id);

-- 결제 내역 테이블
create table if not exists payment_orders (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  order_id text unique not null,
  payment_key text,
  amount integer not null,
  credits integer not null,
  status text not null default 'pending', -- pending | done | failed
  created_at timestamptz default now()
);

alter table payment_orders enable row level security;

create policy "본인만 조회" on payment_orders
  for select using (auth.uid() = user_id);

-- 서버에서만 insert/update 가능하도록 (service_role key 사용)
