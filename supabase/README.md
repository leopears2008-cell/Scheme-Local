# Supabase setup

1. Create a project at supabase.com. Note the URL, anon key, service-role key.
2. Auth → Providers → **Phone**: enable it and connect an SMS provider (Supabase requires one for phone OTP; pick
   Twilio, Vonage or MessageBird under the provider settings). Set OTP expiry to 5 minutes and enable rate limits.
3. Auth → Settings: turn on **Confirm phone** (phone is the login identifier). Keep email signup off unless you need it.
4. SQL Editor → run `migrations/0001_init.sql`. Then `migrations/0002_*` etc. in order.
5. Make yourself a super admin: sign in once with your phone, then run in the SQL editor:
   `insert into public.user_roles(user_id, role) select id, 'super_admin' from auth.users where phone = '+91XXXXXXXXXX';`
   (Or set `SUPER_ADMIN_PHONES` on the backend, which bootstraps the role on first login.)
6. Seed schemes from your machine: `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... python backend/tools/seed_supabase.py`
7. Backups: enable Point-in-time recovery (paid tier) or schedule `pg_dump` from a secure machine. Test a restore.
8. Never place the service-role key in Vercel, the browser, or a git repository.
