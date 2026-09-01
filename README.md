# Martin Family Hub — start here

You have not deployed anything yet. Follow these parts **in order**. Do not skip ahead.

**When you are done, the site will be:** https://fam.jascmartin.com  
Family members sign in with Google. Only these accounts work:

| Google email | Name in the app |
|---|---|
| sacredholyhis@gmail.com | Jason |
| mmj060504@gmail.com | Melanie |
| sethmartin142@gmail.com | Seth |
| P.w.martin2007@gmail.com | Peyton |
| queenstaciegrace@gmail.com | Stacie |

---

## What you need on your computer

1. A Cloudflare account that already has **jascmartin.com** on it (orange-cloud DNS). If the domain is at GoDaddy/Namecheap only, stop and move DNS to Cloudflare first.
2. A free [GitHub](https://github.com) account.
3. A free [Google Cloud](https://console.cloud.google.com/) project (any of the family Gmail accounts can own this).
4. On your PC: [Node.js LTS](https://nodejs.org/) (includes `npm`).
5. The `fam-app` folder from this project.

You do **not** need to run the app locally first. Production is the goal.

---

## Part A — Put the code on GitHub

Cloudflare Pages builds from Git. That is the easiest path.

1. On your computer, put the `fam-app` folder somewhere you will keep it (Documents is fine).
2. Open a terminal **inside** `fam-app`.
3. Run:

```bash
git init
git add .
git commit -m "Martin family hub"
```

4. In the browser, go to https://github.com/new
   - Repository name: `fam-app` (or anything you like)
   - Private
   - Do **not** add a README (you already have files)
   - Create repository
5. GitHub will show commands “push an existing repository.” Run the two it gives you. They look like:

```bash
git remote add origin https://github.com/YOURUSER/fam-app.git
git branch -M main
git push -u origin main
```

Leave this tab. The code is now on GitHub.

---

## Part B — Create the database (D1)

1. In the same terminal, still inside `fam-app`:

```bash
npm install
npx wrangler login
```

2. A browser window opens. Approve Wrangler for your Cloudflare account.
3. Create the database:

```bash
npx wrangler d1 create fam-db
```

4. Wrangler prints something like:

```
database_id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
```

5. Open `wrangler.toml` in a text editor. Replace **both** `REPLACE_WITH_D1_DATABASE_ID` values with that id. Save.
6. Create the tables and family members:

```bash
npx wrangler d1 execute fam-db --remote --file=migrations/0001_init.sql
```

7. Commit the id so Pages can use the file later:

```bash
git add wrangler.toml
git commit -m "Add D1 database id"
git push
```

---

## Part C — Create the Pages site

1. Open https://dash.cloudflare.com
2. Left sidebar: **Workers & Pages**
3. **Create** → **Pages** → **Connect to Git**
4. Authorize GitHub if asked. Pick the `fam-app` repo.
5. Build settings (type these exactly):

   | Field | Value |
   |---|---|
   | Project name | `fam` (this becomes `fam.pages.dev` until the custom domain is on) |
   | Production branch | `main` |
   | Framework preset | Vite |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory | leave empty |

6. Click **Save and Deploy**. Wait until it says success. You will get a URL like `https://fam.pages.dev`. It will look broken for data until Part D.

---

## Part D — Attach the database to the site

1. Still in the Pages project: **Settings** → **Bindings**
2. **Add** → **D1 database**
   - Variable name: `DB`  ← must be exactly `DB`
   - Database: `fam-db`
3. Save.
4. Go to **Deployments** → latest deployment → **Retry deployment** (or push a tiny commit). The binding only applies on a new deploy.

---

## Part E — Point fam.jascmartin.com at the site

1. In the same Pages project: **Custom domains** → **Set up a domain**
2. Type `fam.jascmartin.com` → Continue
3. If `jascmartin.com` is already a zone on this account, Cloudflare adds the CNAME for you. Confirm it.
4. Wait until the domain status is **Active**. SSL is automatic.

Do not create a second CNAME by hand unless the dashboard tells you to.

---

## Part F — Google login (Cloudflare Access)

This is the lock on the door. Google is the key. Only the five emails get in.

### F1. Create a Zero Trust team

1. Dashboard → **Zero Trust**
2. If it asks you to create a team, do that. Team name can be `martinfamily` or similar. Free plan is enough.

### F2. Create a Google OAuth client

1. Open https://console.cloud.google.com/
2. Top bar: project dropdown → **New project** → name it `Martin Family Hub` → Create
3. Menu → **APIs & Services** → **OAuth consent screen**
   - Get started
   - App name: `Martin Family`
   - User support email: your Gmail
   - Audience: **External**
   - Contact email: your Gmail
   - Finish / Create
4. Audience / test users: add all five family Gmail addresses. While the app is in “Testing,” only test users can sign in. You can publish the app later if Google asks.
5. Menu → **APIs & Services** → **Credentials** → **Create credentials** → **OAuth client ID**
   - Application type: **Web application**
   - Name: `Cloudflare Access`
6. Leave this tab open. You still need the callback URL from the next step.

### F3. Add Google as a login method in Cloudflare

1. Zero Trust → **Settings** → **Authentication** (or **Integrations → Identity providers**)
2. **Add new** → **Google**
3. Cloudflare shows a **Callback URL** like:

   `https://YOURTEAM.cloudflareaccess.com/cdn-cgi/access/callback`

4. Back in Google Cloud → your OAuth client:
   - Authorized JavaScript origins: `https://YOURTEAM.cloudflareaccess.com`
   - Authorized redirect URIs: paste that callback URL
   - Save
5. Copy the **Client ID** and **Client secret** into the Cloudflare Google form. Save.

### F4. Protect fam.jascmartin.com

1. Zero Trust → **Access** → **Applications** → **Add an application** → **Self-hosted**
2. Fill in:
   - Application name: `Martin Family Hub`
   - Session duration: `7 days`
   - Public hostname: `fam.jascmartin.com`
   - Identity providers: check **Google** only
3. Next → create a policy:
   - Policy name: `Family only`
   - Action: **Allow**
   - Include rule: **Emails**
   - Add each address, one per line:
     - sacredholyhis@gmail.com
     - mmj060504@gmail.com
     - sethmartin142@gmail.com
     - P.w.martin2007@gmail.com
     - queenstaciegrace@gmail.com
4. Save the application.

### F5. Optional — put the house graphic on the Google wall

1. Open `public/brand/family-mark-square.png` from the `fam-app` folder.
2. Access application → look for **Application logo** / Experience settings.
3. Upload that PNG.

---

## Part G — Prove it works

1. Open a private/incognito window.
2. Go to https://fam.jascmartin.com
3. You should see Cloudflare’s login → **Sign in with Google**.
4. Sign in as `sacredholyhis@gmail.com`.
5. You should land on the calendar. The header should say **Jason**.
6. Add a test event. Switch to Menu / Groceries / Lists and add one item each.
7. Sign out (or another incognito window) and try a Gmail that is **not** on the list. It must be refused.

If the page loads but calendar data fails, the D1 binding is missing or you skipped the SQL file. Repeat Part D and Part B step 6.

---

## If something breaks

| What you see | Likely cause |
|---|---|
| Site opens with no Google screen | Access application hostname is not exactly `fam.jascmartin.com`, or DNS is not proxied |
| Google sign-in error `redirect_uri_mismatch` | Callback URL in Google Cloud does not match Cloudflare’s callback |
| “App is in testing” / blocked | That Gmail is not on the OAuth consent **test users** list |
| Login works, app says unauthorized | Typo in the API allowlist or Access email vs the five addresses |
| Login works, empty / 500 on data | D1 not bound as `DB`, or `0001_init.sql` never ran |
| Custom domain pending | Wait 5–30 minutes; check DNS CNAME for `fam` |

---

## You do not need this yet

Local development is optional. Skip it until the live site works.

```bash
npm install
npx wrangler d1 execute fam-db --local --file=migrations/0001_init.sql
npm run build
npx wrangler pages dev dist --d1=DB=fam-db
```

Locally there is no Access header. Requests will be unauthorized unless you send header `X-Dev-Email: sacredholyhis@gmail.com`.
