-- Customer portal access: workspace memberships, account assignments and audit trail.
-- No public/anon policies are created. All writes are server-side using the service role;
-- customer-facing endpoints must verify the authenticated Supabase user and membership.

create table if not exists meraki_client_portal_memberships (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references meraki_clients(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  email text not null,
  role text not null default 'viewer' check (role in ('client_admin', 'viewer')),
  crm_access boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended')),
  invited_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, email)
);
create index if not exists idx_client_portal_memberships_auth_user on meraki_client_portal_memberships(auth_user_id);
create index if not exists idx_client_portal_memberships_client on meraki_client_portal_memberships(client_id, status);

create table if not exists meraki_client_ad_account_access (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references meraki_clients(id) on delete cascade,
  platform text not null check (platform in ('meta', 'google_ads')),
  account_id text not null,
  created_by text,
  created_at timestamptz not null default now(),
  unique (client_id, platform, account_id)
);
create index if not exists idx_client_ad_account_access_client on meraki_client_ad_account_access(client_id, platform);

create table if not exists meraki_client_access_audit_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references meraki_clients(id) on delete set null,
  actor text not null default 'master_admin',
  action text not null,
  target_email text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_client_access_audit_client_date on meraki_client_access_audit_logs(client_id, created_at desc);

alter table meraki_client_portal_memberships enable row level security;
alter table meraki_client_ad_account_access enable row level security;
alter table meraki_client_access_audit_logs enable row level security;

comment on table meraki_client_portal_memberships is 'Portal user membership per client workspace. Passwords are managed only by Supabase Auth.';
comment on table meraki_client_ad_account_access is 'Advertising accounts explicitly visible to a client workspace in the customer portal.';
comment on table meraki_client_access_audit_logs is 'Audit trail for portal invites, account assignments and permission changes.';
