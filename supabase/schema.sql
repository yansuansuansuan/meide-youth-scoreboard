-- 美德少年积分在线录入：最小可运营数据模型
-- 在独立 Supabase 项目的 SQL Editor 中执行；不包含任何孩子或测试积分。
-- 使用单独的公开积分表，避免公开加分原因和操作人信息。

create table if not exists public.meide_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.meide_children (
  id text primary key,
  name text not null check (length(btrim(name)) between 1 and 40),
  avatar text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.meide_activities (
  id text primary key,
  title text not null check (length(btrim(title)) between 1 and 120),
  date date not null,
  status text not null default 'ongoing' check (status in ('upcoming','ongoing','finished')),
  created_at timestamptz not null default now()
);

create table if not exists public.meide_ledger (
  id text primary key,
  child_id text not null references public.meide_children(id) on delete restrict,
  activity_id text not null references public.meide_activities(id) on delete restrict,
  points integer not null check (points <> 0 and points between -10000 and 10000),
  reason text not null check (length(btrim(reason)) between 1 and 300),
  operator text not null check (length(btrim(operator)) between 1 and 80),
  date date not null,
  created_at timestamptz not null default now()
);

create index if not exists meide_ledger_child_idx on public.meide_ledger(child_id, date desc);
create index if not exists meide_ledger_activity_idx on public.meide_ledger(activity_id, date desc);

-- 公开榜单只存可公开的积分字段，不包含 reason / operator。
create table if not exists public.meide_public_scores (
  id text primary key references public.meide_ledger(id) on delete cascade,
  child_id text not null,
  activity_id text not null,
  points integer not null,
  date date not null
);
create index if not exists meide_public_scores_child_idx on public.meide_public_scores(child_id);

create or replace function public.meide_sync_public_score()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.meide_public_scores where id = old.id;
    return old;
  end if;
  insert into public.meide_public_scores(id,child_id,activity_id,points,date)
  values (new.id,new.child_id,new.activity_id,new.points,new.date)
  on conflict (id) do update set
    child_id = excluded.child_id,
    activity_id = excluded.activity_id,
    points = excluded.points,
    date = excluded.date;
  return new;
end
$$;

drop trigger if exists meide_ledger_score_sync on public.meide_ledger;
create trigger meide_ledger_score_sync
after insert or update or delete on public.meide_ledger
for each row execute function public.meide_sync_public_score();

-- 若有旧数据，在启用前一次性同步，之后由触发器自动同步。
insert into public.meide_public_scores(id,child_id,activity_id,points,date)
select id,child_id,activity_id,points,date from public.meide_ledger
on conflict (id) do update set
child_id=excluded.child_id, activity_id=excluded.activity_id,
points=excluded.points, date=excluded.date;

alter table public.meide_admins enable row level security;
alter table public.meide_children enable row level security;
alter table public.meide_activities enable row level security;
alter table public.meide_ledger enable row level security;
alter table public.meide_public_scores enable row level security;

drop policy if exists meide_admin_self on public.meide_admins;
create policy meide_admin_self on public.meide_admins for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists meide_children_public_read on public.meide_children;
create policy meide_children_public_read on public.meide_children for select to anon using (true);
drop policy if exists meide_children_admin_all on public.meide_children;
create policy meide_children_admin_all on public.meide_children for all to authenticated
using (exists (select 1 from public.meide_admins where user_id = (select auth.uid())))
with check (exists (select 1 from public.meide_admins where user_id = (select auth.uid())));

drop policy if exists meide_activities_public_read on public.meide_activities;
create policy meide_activities_public_read on public.meide_activities for select to anon using (true);
drop policy if exists meide_activities_admin_all on public.meide_activities;
create policy meide_activities_admin_all on public.meide_activities for all to authenticated
using (exists (select 1 from public.meide_admins where user_id = (select auth.uid())))
with check (exists (select 1 from public.meide_admins where user_id = (select auth.uid())));

drop policy if exists meide_ledger_admin_all on public.meide_ledger;
create policy meide_ledger_admin_all on public.meide_ledger for all to authenticated
using (exists (select 1 from public.meide_admins where user_id = (select auth.uid())))
with check (exists (select 1 from public.meide_admins where user_id = (select auth.uid())));

drop policy if exists meide_scores_public_read on public.meide_public_scores;
create policy meide_scores_public_read on public.meide_public_scores for select to anon using (true);
drop policy if exists meide_scores_admin_read on public.meide_public_scores;
create policy meide_scores_admin_read on public.meide_public_scores for select to authenticated
using (exists (select 1 from public.meide_admins where user_id = (select auth.uid())));

-- 不允许浏览器用户自行变更管理员名单或公开榜单。
revoke all on table public.meide_admins, public.meide_children, public.meide_activities, public.meide_ledger, public.meide_public_scores from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.meide_children, public.meide_activities, public.meide_public_scores to anon;
grant select, insert, update, delete on public.meide_children, public.meide_activities, public.meide_ledger to authenticated;
grant select on public.meide_admins, public.meide_public_scores to authenticated;
revoke all on function public.meide_sync_public_score() from public, anon, authenticated;

-- 在 Supabase Authentication -> Users 创建管理员账号之后：
-- insert into public.meide_admins(user_id) values ('替换为管理员用户 UUID')
-- on conflict (user_id) do nothing;
