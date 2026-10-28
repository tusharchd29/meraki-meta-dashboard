# Customer Portal Access Setup

This feature adds a Master Admin panel to the Meraki Meta Dashboard and a separate customer portal at `/portal`.

## What it provides

- The internal dashboard's existing password gate protects the Master Admin controls.
- Admins select an existing customer workspace, invite an individual email login, choose a role, and assign only the tracked Meta/Google Ads accounts that customer may see.
- CRM-qualified lead reporting is disabled by default and is stored per customer login.
- Customer sign-in uses one-time email links through Supabase Auth. The application never stores customer passwords.
- Account assignments and permission changes are written to `meraki_client_access_audit_logs`.
- Customer portal API routes verify the Supabase Auth user and require an active membership before returning workspace data.
- The customer portal only returns assigned account metadata, not the internal dashboard's global data.

## Required setup

1. In the Supabase SQL Editor for the project used by this dashboard, run:
   `supabase/migrations/20261028_customer_portal_access.sql`.
2. In Vercel project `meraki-meta-internal-dashboard`, configure `SUPABASE_ANON_KEY` for Production and Preview. Use the project's anon/public key, never its service-role key.
3. In Supabase Auth URL Configuration, add the deployed portal URL (for example `https://meraki-meta-internal-dashboard.vercel.app/portal`) to the allowed redirect URLs. Also allow the stable custom domain if the dashboard uses one.
4. Ensure Supabase Auth email delivery is configured for invitations and magic links. For reliable client delivery, use a verified SMTP provider and appropriate email sender domain.
5. Deploy the branch and test with a real internal client workspace and an email address you control. Do not use the placeholder `marketing@example.com` as a production invitation address.
6. In the dashboard, open **Customer Access**, select a customer, enter the actual customer email, choose the tracked accounts, leave CRM access off unless approved, and select **Save & send invitation**.
7. The invited user opens the email link, then signs in later from `/portal` using the same email address.

## Access model and limitations

- `/api/admin/customer-access` remains protected by the existing internal dashboard session gate.
- `/api/portal/*` routes are excluded from that global gate because they implement their own Supabase Auth checks. Do not add a new customer data endpoint under this prefix without verifying the user token, active membership, and assigned account IDs server-side.
- Account visibility is scoped at the customer workspace level. CRM visibility is scoped per membership.
- The current customer portal confirms identity and lists assigned accounts. The full campaign/creative reporting views still need to be wired to a scoped data API before customer users should receive access to campaign-level metrics.
- The existing master-admin gate is still a single internal password. A future enhancement can migrate agency administrators to named Supabase Auth identities and per-admin roles.
- Customer roles are stored as `client_admin` and `viewer`. The current release is read-only for customers; customer-admin self-service user management is not enabled.
- The invitation flow depends on Supabase Auth redirect configuration and email delivery. If the migration or anon key is missing, the admin UI or customer sign-in will show a setup error rather than falling back to public access.

## Security checks before production

- Confirm the migration ran successfully.
- Confirm `SUPABASE_SERVICE_ROLE_KEY` is only configured as a server-side environment variable.
- Confirm `SUPABASE_ANON_KEY` is the public/anon key and contains no privileged service-role secret.
- Test a customer login and verify that its portal response includes only the selected workspace and assigned accounts.
- Test an email without a membership; it must not receive customer data.
- Suspend a membership and confirm its next portal request is denied.
- Verify account assignment changes create audit entries.
