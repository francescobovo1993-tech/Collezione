# Turning on sync (Google sign-in + Supabase)

Without this setup the app works as before: marks are saved in each browser only.
After it, **Impostazioni → Accedi con Google** saves your marks to your account, so they follow you
to every device. Pomo signs in with his own Google account and gets his own, separate marks.

It takes about 20–30 minutes, once. You need: a Google account and a free Supabase account.
Keep two browser tabs open, Supabase and Google Cloud, because you copy values between them.

Your site address is used below: `https://francescobovo1993-tech.github.io/Collezione/`

---

## 1. Create the Supabase project

1. Go to <https://supabase.com>, sign up (signing up with GitHub is fine) and click **New project**.
2. Name it e.g. `buste-wr`, choose a database password (save it somewhere; the app doesn't need it),
   region **Europe (Frankfurt)** or similar, plan **Free**. Create it and wait a minute.
3. Open **SQL Editor → New query**, paste the whole content of [`supabase/schema.sql`](supabase/schema.sql),
   press **Run**. It should say *Success. No rows returned*.
   This creates the table and the rule that each person can only read and change their own row.
4. Note your **Project URL**: shown on the project home page (or **Project Settings → Data API**).
   It looks like `https://abcdefghijkl.supabase.co`. The part before `.supabase.co` is your *project ref*.

## 2. Create the Google login key

1. Go to <https://console.cloud.google.com>, create a project (top bar → project picker → **New project**,
   name e.g. `Buste WR`), and select it.
2. Open **APIs & Services → OAuth consent screen** (also called **Google Auth Platform**) → **Get started**:
   - App name `Buste WR`, support email: yours. Audience: **External**. Contact email: yours. Create.
3. **Audience** page: leave it in **Testing** and under **Test users** add your Gmail address and Pomo's.
   Only those accounts will be able to sign in, which keeps strangers out.
4. **Clients → Create client**:
   - Application type: **Web application**, name `Buste WR`.
   - **Authorized JavaScript origins**: `https://francescobovo1993-tech.github.io`
   - **Authorized redirect URIs**: `https://<project-ref>.supabase.co/auth/v1/callback`
     (copy the exact URL from Supabase in step 3.1 below, it's shown there too).
   - Create. Copy the **Client ID** and **Client secret**.

## 3. Connect Google to Supabase

1. In Supabase: **Authentication → Sign In / Providers → Google** → enable it, paste the
   **Client ID** and **Client secret**, save. (The *Callback URL* shown here is the one for step 2.4.)
2. **Authentication → URL Configuration**:
   - **Site URL**: `https://francescobovo1993-tech.github.io/Collezione/`
   - **Redirect URLs** → add `https://francescobovo1993-tech.github.io/Collezione/`
     and, for running the app on your computer, `http://localhost:5173/`
3. **Project Settings → API Keys**: copy the **publishable** key (starts with `sb_publishable_`).
   On older projects it's the **anon public** key. Both work.
   Never use the *secret* / *service_role* key in the app.

## 4. Give the keys to the site

The Project URL and publishable key are designed to be public (the database rules do the protecting),
so they go in plain repository *variables*, not secrets.

1. On GitHub: repo **Settings → Secrets and variables → Actions → Variables** tab → **New repository variable**:
   - `SUPABASE_URL` = your Project URL
   - `SUPABASE_ANON_KEY` = the publishable key
2. **Actions** tab → **Deploy to GitHub Pages** → **Run workflow**.

## 5. Try it

1. Open the site → **Impostazioni** → **Accedi o crea un account** → **Continua con Google** → pick your account.
2. Back in the app, the bottom-left says *Spunte sincronizzate sul tuo account.* (a green dot appears on
   Impostazioni).
   - First time: the marks already in that browser are uploaded to your account.
   - On another device, after signing in, your account's marks replace that browser's ones
     (the old copy is kept in the browser under `wrbuste.state.v1.backup`, just in case).
3. Changes are saved online about half a second after you make them. Switching back to the tab
   re-reads your account, so edits from your other devices show up.
4. Pomo: open the site and sign in with his Google account (or email + password).

## 6. Email + password (optional, already on)

The login window (**Impostazioni → Accedi o crea un account**) also offers email + password.
Supabase has it on by default: check **Authentication → Sign In / Providers → Email** is enabled and
**Confirm email** is on. No other setup.

One person = one account, however they sign in. Supabase links them by email:
- **Google first:** signed in with Google → Impostazioni → **Imposta password**. From then on you can
  also sign in with that Gmail address and the password.
- **Password first:** create the account, confirm it from the email, and later use
  **Continua con Google** with the same Gmail: Supabase joins the two automatically.
- **Forgot the password:** *Password dimenticata?* sends a link; opening it asks for a new password.

Notes:
- Supabase's built-in email sender only sends a few emails per hour. Fine for two people.
  Emails may land in spam the first time.
- Unlike Google (limited to your test users), anyone with the link could create an email account.
  They'd only ever see their own empty row, never your marks. To block that once you and Pomo have
  accounts: **Authentication → Sign In / Providers → Allow new users to sign up** → off.

## 7. Shared Volumi notes (edit from the app)

1. Open [`supabase/volumi.sql`](supabase/volumi.sql). At the bottom, replace `POMO-EMAIL@gmail.com`
   with the email Pomo signs in with (and check yours is right).
2. Supabase → **SQL Editor → New query** → paste the whole file → **Run**.
3. In the app, sign in, open a format → Volumi → **Modifica**.

To add or remove an editor later: Supabase → **Table Editor → editors** → add/delete a row with the email.

## Good to know

- **Free plan pause:** Supabase pauses free projects after a period without use (about a week).
  The app keeps working from the browser copy; to wake the project, open the Supabase dashboard and
  click **Restore**. Your data is kept.
- **Adding someone:** add their Gmail to Google's **Test users** list (step 2.3).
- **Running locally with sync:** create `.env.local` in the repo with
  `VITE_SUPABASE_URL=...` and `VITE_SUPABASE_ANON_KEY=...`, then `npm run dev`.
- **Turning it off:** delete the two GitHub variables and redeploy. Everyone goes back to browser-only
  storage (each browser keeps its last copy).
