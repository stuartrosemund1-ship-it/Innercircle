# Supabase setup

LifeCircle uses on-device demo data until both `EXPO_PUBLIC_SUPABASE_URL` and a public client key are set. The client key may be `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

## 1. Create or link a project

Create a project at https://supabase.com/dashboard, or from this app:

```bash
npx eas-cli@latest integrations:supabase:connect
```

That command needs a browser sign-in. It installs nothing extra if the SDK is already present, and it writes the URL and publishable key into `.env.local`.

To do it by hand, copy the Project URL and the publishable (anon) key from Project Settings → API into `.env.local` using `.env.example`.

## 2. Apply the schema

The hosted project is `zfgrlqheihcvmjfkpjet` (`https://zfgrlqheihcvmjfkpjet.supabase.co`). `001_lifecircle_schema.sql` is already applied there. Apply `002_professional_verified.sql` and `003_professional_application.sql` in the SQL editor when you are ready. Do not expect 003 to already be on the hosted database. Only `service_role`, `postgres`, or `supabase_admin` can approve an application or set `is_verified`.

For a new project, run the three files in order in the Supabase SQL editor.

Or, with the CLI and Docker:

```bash
npx supabase init   # creates config.toml if you do not have one yet
npx supabase start
npx supabase db reset
npx supabase status # API URL and publishable key for .env.local
```

The migration creates profiles (from Auth signups), connections, professionals, private contact details, recommendations, personal trust, introductions, messages, invitations, and notifications. Row level security is on for every table. The app must use the publishable key, never the secret key.

## 3. Auth

- Enable the Email provider.
- Add redirect URLs `lifecircle://reset-password` and `lifecircle://**`.
- New projects confirm email before `signUp` returns a session. For local development, turn off Confirm email so registration signs the person in immediately. Otherwise the app asks them to confirm, then sign in.
- Invite links use `lifecircle://join/<token>`. The token is shown once and only its hash is stored.

## 4. Run the app

Restart Expo after saving `.env.local`. The development banner disappears when the URL and key are set. Sample network and demo reset stay on the device and never write to Supabase.
