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

`001_lifecircle_schema.sql` is already applied on the hosted project. Apply `supabase/migrations/002_professional_verified.sql` in the SQL editor before using the verified badge against Supabase. It adds `professionals.is_verified` and `professionals.verified_at`.

Authenticated users can read those columns. They cannot set them: column privileges omit them from insert and update, and a trigger restores the previous values unless the session is `service_role`, `postgres`, or `supabase_admin`. To mark someone verified, run this with the SQL editor or the service role:

```sql
update public.professionals
set is_verified = true
where name = 'Example Name';
```

`verified_at` is filled in when `is_verified` becomes true.

Auth redirects to allow: `lifecircle://reset-password` and `lifecircle://**`. Invite links look like `lifecircle://join/<token>`.

More detail is in `docs/setup-needed.md`.

## Scripts

```bash
npm install
npx expo start
npx tsc --noEmit
npx expo lint
```
