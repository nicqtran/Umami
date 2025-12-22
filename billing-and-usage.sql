-- =====================================================
-- BILLING + USAGE RAILS FOR AI SCANS
-- Run this in Supabase SQL editor before shipping the
-- monetization changes. This creates the access tables,
-- guardrail functions, and trial handling.
-- =====================================================

-- Table: billing_profiles
-- Tracks subscription/trial metadata per user. The actual
-- entitlement is derived from trusted timestamps stored here.
create table if not exists billing_profiles (
  user_id uuid primary key references auth.users on delete cascade,
  pro_status text not null default 'expired' check (pro_status in ('active', 'grace', 'canceled', 'expired', 'trialing')),
  pro_renews_at timestamptz,
  pro_cancel_at_period_end boolean default false,
  trial_started_at timestamptz,
  trial_expires_at timestamptz,
  trial_used boolean not null default false,
  timezone text not null default 'UTC',
  last_status_sync timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Table: usage_counters
-- Holds per-day scan counts. Day rollover is calculated
-- server-side using the stored user timezone.
create table if not exists usage_counters (
  user_id uuid references auth.users on delete cascade,
  day_id date not null,
  scans integer not null default 0,
  last_scan_at timestamptz default now(),
  primary key (user_id, day_id)
);

alter table billing_profiles enable row level security;
alter table usage_counters enable row level security;


-- Helper: validate and normalize timezone
create or replace function private_validate_timezone(p_timezone text)
returns text
language plpgsql
stable
as $$
begin
  if p_timezone is null then
    return null;
  end if;

  if exists (select 1 from pg_timezone_names where name = p_timezone) then
    return p_timezone;
  end if;

  return null;
end;
$$;

-- Core guard: compute access state and optionally increment usage atomically.
create or replace function get_access_status(
  p_user_id uuid,
  p_timezone text default null,
  p_increment boolean default false
) returns jsonb
language plpgsql
as $$
declare
  v_now timestamptz := now();
  v_profile billing_profiles%rowtype;
  v_tz text;
  v_day_id date;
  v_trial_active boolean;
  v_pro_active boolean;
  v_daily_limit int;
  v_used_today int := 0;
  v_remaining int;
  v_trial_days_left int := null;
  v_state text;
  v_reason text := null;
  v_can_start_trial boolean;
begin
  -- Only server-side callers may use this helper
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required';
  end if;

  select * into v_profile
  from billing_profiles
  where user_id = p_user_id
  for update;

  -- Bootstrap profile if missing
  if not found then
    v_tz := coalesce(private_validate_timezone(p_timezone), 'UTC');
    insert into billing_profiles (user_id, pro_status, timezone, created_at, updated_at)
    values (p_user_id, 'expired', v_tz, v_now, v_now)
    returning * into v_profile;
  end if;

  -- Lock timezone to the first valid value we see
  v_profile.timezone := coalesce(private_validate_timezone(v_profile.timezone), 'UTC');
  if v_profile.timezone is null then
    v_profile.timezone := 'UTC';
  end if;

  if p_timezone is not null then
    v_tz := private_validate_timezone(p_timezone);
    if v_tz is not null and (v_profile.timezone is null or v_profile.timezone = 'UTC') then
      update billing_profiles
      set timezone = v_tz,
          updated_at = v_now
      where user_id = p_user_id;
      v_profile.timezone := v_tz;
    end if;
  end if;

  v_tz := v_profile.timezone;
  v_day_id := (v_now at time zone v_tz)::date;

  v_trial_active := v_profile.trial_expires_at is not null and v_profile.trial_expires_at > v_now;
  v_pro_active := v_profile.pro_status in ('active', 'grace') and (v_profile.pro_renews_at is null or v_profile.pro_renews_at > v_now);
  v_daily_limit := case when v_pro_active or v_trial_active then 10 else 2 end;
  v_can_start_trial := not v_profile.trial_used;

  select scans
  into v_used_today
  from usage_counters
  where user_id = p_user_id
    and day_id = v_day_id;
  v_used_today := coalesce(v_used_today, 0);

  if v_trial_active then
    v_trial_days_left := greatest(0, ((v_profile.trial_expires_at at time zone v_tz)::date - v_day_id));
  end if;

  v_state := case
    when v_pro_active then 'PRO_USER'
    when v_profile.pro_status in ('active', 'grace', 'canceled') then 'PRO_EXPIRED'
    when v_trial_active then 'TRIAL_USER'
    when v_profile.trial_used then 'TRIAL_EXPIRED'
    else 'FREE_USER'
  end;

  if v_used_today >= v_daily_limit then
    v_reason := 'daily_limit_reached';
    if v_state = 'PRO_USER' or v_state = 'TRIAL_USER' then
      v_state := v_state || '_LIMIT';
    else
      v_state := 'FREE_LIMIT';
    end if;
  end if;

  if p_increment and v_reason is null then
    with upsert as (
      insert into usage_counters (user_id, day_id, scans, last_scan_at)
      values (p_user_id, v_day_id, 1, v_now)
      on conflict (user_id, day_id) do update
        set scans = usage_counters.scans + 1,
            last_scan_at = v_now
        where usage_counters.scans < v_daily_limit
      returning scans
    )
    select scans into v_used_today from upsert;

    -- If the update was skipped because we were at the cap, return the current count.
    if v_used_today is null then
      select scans
      into v_used_today
      from usage_counters
      where user_id = p_user_id
        and day_id = v_day_id;
      v_reason := 'daily_limit_reached';
    end if;
  end if;

  v_remaining := greatest(v_daily_limit - v_used_today, 0);

  return jsonb_build_object(
    'state', v_state,
    'reason', v_reason,
    'dailyLimit', v_daily_limit,
    'usedToday', v_used_today,
    'remainingToday', v_remaining,
    'trialEndsAt', v_profile.trial_expires_at,
    'trialDaysLeft', v_trial_days_left,
    'proRenewsAt', v_profile.pro_renews_at,
    'canStartTrial', v_can_start_trial,
    'timezone', v_profile.timezone,
    'trialUsed', v_profile.trial_used,
    'proStatus', v_profile.pro_status
  );
end;
$$;

-- Start a 14-day trial (single use per user). Calculates expiry using a trusted clock and the stored timezone.
create or replace function start_trial_for_user(
  p_user_id uuid,
  p_timezone text default null
) returns jsonb
language plpgsql
as $$
declare
  v_now timestamptz := now();
  v_profile billing_profiles%rowtype;
  v_tz text;
  v_local_start timestamptz;
  v_local_end timestamptz;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required';
  end if;

  select * into v_profile
  from billing_profiles
  where user_id = p_user_id
  for update;

  if not found then
    v_tz := coalesce(private_validate_timezone(p_timezone), 'UTC');
    insert into billing_profiles (user_id, pro_status, timezone, created_at, updated_at)
    values (p_user_id, 'expired', v_tz, v_now, v_now)
    returning * into v_profile;
  end if;

  if v_profile.trial_used then
    return get_access_status(p_user_id, v_profile.timezone, false) || jsonb_build_object('reason', 'trial_already_used');
  end if;

  v_tz := coalesce(private_validate_timezone(p_timezone), v_profile.timezone, 'UTC');
  v_local_start := (v_now at time zone v_tz);
  v_local_end := v_local_start + interval '14 days';

  update billing_profiles
  set trial_started_at = timezone('UTC', v_local_start),
      trial_expires_at = timezone('UTC', v_local_end),
      trial_used = true,
      pro_status = 'trialing',
      updated_at = v_now,
      timezone = v_tz
  where user_id = p_user_id;

  return get_access_status(p_user_id, v_tz, false);
end;
$$;

-- Refund a scan credit (decrement usage counter). Used when analysis fails after incrementing.
create or replace function refund_scan_usage(
  p_user_id uuid,
  p_timezone text default null
) returns jsonb
language plpgsql
as $$
declare
  v_now timestamptz := now();
  v_profile billing_profiles%rowtype;
  v_tz text;
  v_day_id date;
  v_updated_scans int;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required';
  end if;

  select * into v_profile
  from billing_profiles
  where user_id = p_user_id;

  if not found then
    return jsonb_build_object('success', false, 'reason', 'no_profile');
  end if;

  v_tz := coalesce(private_validate_timezone(p_timezone), v_profile.timezone, 'UTC');
  v_day_id := (v_now at time zone v_tz)::date;

  update usage_counters
  set scans = greatest(scans - 1, 0)
  where user_id = p_user_id
    and day_id = v_day_id
  returning scans into v_updated_scans;

  if v_updated_scans is null then
    return jsonb_build_object('success', false, 'reason', 'no_usage_record');
  end if;

  return jsonb_build_object('success', true, 'scansAfterRefund', v_updated_scans);
end;
$$;
