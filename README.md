# LifeCircle

Expo app for a private trust network. People connect, recommend professionals, and request introductions. Trust is never copied automatically.

Without Supabase credentials the app runs in a labelled on-device demo. Sample data, including a verified professional (Alex Rivera), stays on the device.

The public demo (no Supabase keys) is at https://stuartrosemund1-ship-it.github.io/Innercircle/. It is built from `main` by `.github/workflows/pages.yml` (Pages source: GitHub Actions).

## Supabase

The hosted project is `zfgrlqheihcvmjfkpjet`.

```bash
cp .env.example .env.local
```

Set these in `.env.local` (this file is gitignored):

```bash
EXPO_PUBLIC_SUPABASE_URL=https://zfgrlqheihcvmjfkpjet.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

The publishable key is the public client key in Supabase → Project Settings → API Keys. `EXPO_PUBLIC_SUPABASE_ANON_KEY` is also accepted. Restart Expo after saving. If either value is missing, the app stays in demo mode.

Do not put the service role or secret key in the app or in git. That key bypasses row level security.

### Database

`001_lifecircle_schema.sql` is already applied on the hosted project. Apply `supabase/migrations/002_professional_verified.sql` and then `supabase/migrations/003_professional_application.sql` in the SQL editor before using applications or the verified badge against Supabase. Migration 003 is committed only. It has not been applied to the hosted database.

003 adds the application (`draft`, `pending`, `approved`, `rejected`), licence and document paths, reference requests, and a required price range (`price_min`, `price_max`, `currency`, `pricing_unit`). Applicants can submit a draft as pending. They cannot approve or reject themselves, and they cannot set `is_verified`. Only `service_role`, `postgres`, or `supabase_admin` can do that. Approval also requires a price range and confirmed references, and a verified badge is cleared unless the application is approved.

Authenticated users can read those columns. They cannot set them: column privileges omit them from insert and update, and a trigger restores the previous values unless the session is `service_role`, `postgres`, or `supabase_admin`. To mark someone verified, run this with the SQL editor or the service role:

```sql
update public.professionals
set application_status = 'approved'
where name = 'Example Name';

update public.professionals
set is_verified = true
where name = 'Example Name'
  and application_status = 'approved';
```

`verified_at` is filled in when `is_verified` becomes true. Reject an application with `application_status = 'rejected'` and `application_rejection_reason`.

Auth redirects to allow: `lifecircle://reset-password` and `lifecircle://**`. Invite links look like `lifecircle://join/<token>`.

More detail is in `docs/setup-needed.md`.

## Scripts

```bash
npm install
npx expo start
npx tsc --noEmit
npx expo lint
```
