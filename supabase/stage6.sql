-- VisionCraft AI · Stage 6
-- 永久图片存储、服务端权限、访客隔离和每日生图额度

begin;

create extension if not exists pgcrypto;

-- 1. 升级作品表
alter table public.artworks
  add column if not exists storage_path text,
  add column if not exists negative_prompt text,
  add column if not exists owner_hash text;

create index if not exists artworks_owner_created_idx
  on public.artworks (owner_hash, created_at desc);

-- 2. 移除开发阶段的公开 RLS 策略
alter table public.artworks enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'artworks'
  loop
    execute format(
      'drop policy if exists %I on public.artworks',
      policy_record.policyname
    );
  end loop;
end $$;

-- 浏览器 publishable/anon key 不再直接读写 artworks。
revoke all on table public.artworks from anon, authenticated;
grant all on table public.artworks to service_role;

-- 3. 创建公开读取、仅服务端写入的 Storage Bucket
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'artworks',
  'artworks',
  true,
  15728640,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 不创建匿名上传/删除策略；服务端 Secret Key 会绕过 RLS。

-- 4. 每日生图额度表
create table if not exists public.generation_usage (
  scope text not null,
  usage_date date not null default current_date,
  count integer not null default 0 check (count >= 0),
  updated_at timestamptz not null default now(),
  primary key (scope, usage_date)
);

alter table public.generation_usage enable row level security;
revoke all on table public.generation_usage from anon, authenticated;
grant all on table public.generation_usage to service_role;

-- 5. 原子检查并消耗“单 IP + 全站”额度
create or replace function public.consume_generation_quota(
  p_ip_scope text,
  p_ip_limit integer,
  p_global_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ip_count integer := 0;
  v_global_count integer := 0;
begin
  if p_ip_scope is null or length(p_ip_scope) < 4 then
    raise exception 'invalid ip scope';
  end if;

  if p_ip_limit <= 0 or p_global_limit <= 0 then
    raise exception 'quota limit must be greater than zero';
  end if;

  -- 同一天的生成请求串行检查，避免并发绕过额度。
  perform pg_advisory_xact_lock(
    hashtext('visioncraft-generation-' || current_date::text)
  );

  select count into v_ip_count
  from public.generation_usage
  where scope = p_ip_scope and usage_date = current_date;
  v_ip_count := coalesce(v_ip_count, 0);

  select count into v_global_count
  from public.generation_usage
  where scope = 'global' and usage_date = current_date;
  v_global_count := coalesce(v_global_count, 0);

  if v_ip_count >= p_ip_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'ip',
      'ip_count', v_ip_count,
      'global_count', v_global_count,
      'ip_remaining', 0,
      'global_remaining', greatest(p_global_limit - v_global_count, 0)
    );
  end if;

  if v_global_count >= p_global_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'global',
      'ip_count', v_ip_count,
      'global_count', v_global_count,
      'ip_remaining', greatest(p_ip_limit - v_ip_count, 0),
      'global_remaining', 0
    );
  end if;

  insert into public.generation_usage (scope, usage_date, count, updated_at)
  values (p_ip_scope, current_date, 1, now())
  on conflict (scope, usage_date)
  do update set
    count = public.generation_usage.count + 1,
    updated_at = now()
  returning count into v_ip_count;

  insert into public.generation_usage (scope, usage_date, count, updated_at)
  values ('global', current_date, 1, now())
  on conflict (scope, usage_date)
  do update set
    count = public.generation_usage.count + 1,
    updated_at = now()
  returning count into v_global_count;

  return jsonb_build_object(
    'allowed', true,
    'ip_count', v_ip_count,
    'global_count', v_global_count,
    'ip_remaining', greatest(p_ip_limit - v_ip_count, 0),
    'global_remaining', greatest(p_global_limit - v_global_count, 0)
  );
end;
$$;

-- 模型请求失败时退回一次额度。
create or replace function public.refund_generation_quota(p_ip_scope text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform pg_advisory_xact_lock(
    hashtext('visioncraft-generation-' || current_date::text)
  );

  update public.generation_usage
  set count = greatest(count - 1, 0), updated_at = now()
  where usage_date = current_date
    and scope in (p_ip_scope, 'global');
end;
$$;

revoke all on function public.consume_generation_quota(text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.refund_generation_quota(text)
  from public, anon, authenticated;

grant execute on function public.consume_generation_quota(text, integer, integer)
  to service_role;
grant execute on function public.refund_generation_quota(text)
  to service_role;

commit;
