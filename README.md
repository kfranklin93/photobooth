# Princess Butterflies Photo Booth

A kiosk-mode DIY photo booth for a baby shower. A guest taps the screen on a
tablet, takes a photo, and enters their email. The app drops that photo into a
Canva brand template, exports the finished design as a JPG, and emails it to
them.

Built with Next.js (App Router), TypeScript, and Tailwind CSS.

## How it works

```
Tablet camera
   │  multipart/form-data (photo + email)
   ▼
POST /api/process-photo
   │
   ├─ 1. POST /v1/asset-uploads      → poll → asset_id
   ├─ 2. POST /v1/autofills          → poll → design_id
   ├─ 3. POST /v1/exports            → poll → download URL
   ├─ 4. download the exported JPG
   └─ 5. Resend → email with the JPG attached
```

All three Canva steps are asynchronous jobs: the POST returns a job id, and the
job is re-read until its status becomes `success` or `failed`.

## Project layout

| Path | What it does |
| --- | --- |
| `app/page.tsx` | Server entry point; reads `EVENT_NAME` and renders the booth |
| `components/PhotoBooth.tsx` | Client state machine: idle → capture → processing → success |
| `components/screens/*` | The four kiosk screens |
| `components/ButterflyIcon.tsx` | Butterfly SVG motif |
| `components/ButterflyBackdrop.tsx` | Drifting butterflies and gold sparkles |
| `app/api/process-photo/route.ts` | The full backend workflow |
| `app/api/canva/auth`, `app/api/canva/callback` | One-time OAuth setup (operator only) |
| `app/api/canva/template` | Lists your template's field names (operator only) |
| `lib/canva/token.ts`, `token-store.ts` | OAuth access/refresh token handling |
| `lib/canva/client.ts` | `fetch` wrapper plus the job polling helper |
| `lib/canva/pipeline.ts` | upload → autofill → export |
| `lib/email.ts` | Resend delivery |
| `app/globals.css` | Purple + gold theme tokens and animations |

## Setup

### 1. Install

```bash
npm install
cp .env.local.example .env.local
```

### 2. Create a Canva integration

The Connect API has **no static API key**. It uses OAuth 2.0 with PKCE, and
every call needs an access token that acts on behalf of a Canva user. Access
tokens last about 4 hours, so the booth holds a refresh token and trades it in
as needed.

You need MFA enabled on your Canva account. Canva merged Integrations into Apps
on 21 September 2026, so you now create an **App** and switch on REST API
capabilities — the old "Your integrations" flow is gone. The Connect API itself
is unchanged.

1. Open [Your apps](https://www.canva.com/developers/) in the Developer Portal
   and click **Create an app**.
2. In the modal:
   - **App name** — 18 characters or fewer. `Butterfly Booth` fits.
   - **Who can use your app?** — choose **Public**. This can't be changed later.
     See the plan note below.
   - Accept the Developer Terms, then **Create app**.
3. Go to **Outside Canva** and click **Start integrating**. Easy step to miss:
   until you click it, there is no Configuration or Redirect URLs page to visit.
4. On **Outside Canva → Configuration**, under **Integration methods**, turn
   **Canva REST APIs** on and leave **Canva MCP** off. Scopes and the API version
   live inside that section, so they only appear once REST APIs is on.

   An app can expose three surfaces. This booth only uses one:

   | Surface | What it means | Used here |
   | --- | --- | --- |
   | Inside Canva | Apps SDK panel running in the Canva editor | no |
   | Outside Canva → Canva REST APIs | Your server calls the Connect API | **yes** |
   | Outside Canva → Canva MCP | AI assistants drive Canva | no |

   Leave the **Inside Canva** section untouched. The booth is a web app that
   calls Canva from its own server, so it never runs inside the Canva editor.
5. Under **Credentials**, copy the **Client ID**, then **Generate secret**. The
   secret is shown once. Put both in `.env.local`.
6. Under **Scopes**, enable all six of these. Authorization is refused if you
   request a scope that isn't enabled here:

   | Scope | Why |
   | --- | --- |
   | `asset:write` | Upload the guest's photo |
   | `design:content:write` | Autofill the template |
   | `design:content:read` | Export the finished design |
   | `design:meta:read` | Read design metadata from the autofill result |
   | `brandtemplate:meta:read` | List brand templates |
   | `brandtemplate:content:read` | Read the template's field names |

7. On **Outside Canva → Redirect URLs**, add:
   - `http://127.0.0.1:3000/api/canva/callback` for local development
   - `https://your-domain.example/api/canva/callback` for production

> **Canva Pro is enough. You do not need Enterprise.**
>
> Two separate things get confused here:
>
> - **Autofill and brand templates** need Pro, Teams, or Enterprise. Canva
>   [gated autofill to Enterprise in May 2026, then reopened it to Pro and above
>   on 23 September 2026](https://community.canva.dev/t/autofill-api-now-gated-to-enterprise-with-a-limited-trial-for-integrations-under-development/8709).
>   Tutorials describing an Enterprise-only restriction or a development trial
>   quota are out of date. Canva notes usage limits may return later.
> - **Private apps** are Enterprise-only, but "private" is just a distribution
>   mode for sharing inside an Enterprise team. It is not an API capability.
>   Choose **Public** and leave the app in draft: per Canva, public apps work in
>   draft state for individual use and testing, and review is only needed to
>   list in the Apps Marketplace. A one-tablet booth never needs review.

### 3. Authorise the booth once

Set `APP_URL` in `.env.local`, then start the dev server and visit
`/api/canva/auth`, signed in as the account that owns the brand template.

```bash
npm run dev
open http://127.0.0.1:3000/api/canva/auth
```

Approve the request. The callback page prints a refresh token; paste it into
`.env.local` as `CANVA_REFRESH_TOKEN` and restart the server.

These two routes are operator-only. They are blocked in production unless you
set `CANVA_SETUP_SECRET` and append `?secret=<value>` to the URL.

### 4. Point at your template

Design your butterfly frame in Canva, add an image **frame** where the guest's
photo goes, then name that frame as a data field: **Apps → Data autofill →**
name the field. A frame only becomes autofillable once it has a name.

Then pick one of two sources.

**Option A — brand template (the documented path).** Publish the design as a
brand template, then copy the ID from the brand template URL:

```
https://www.canva.com/brand/brand-templates/AEN3TrQftXo
                                            ^^^^^^^^^^^  → CANVA_TEMPLATE_ID
```

Note this is **not** the design ID. A `/design/DAFxxxx/edit` URL gives you a
design ID, which the brand template endpoints will reject with `not_found`.

**Option B — plain design.** If publishing a brand template isn't available to
you, set `CANVA_SOURCE_DESIGN_ID` to the design ID from its edit URL and leave
`CANVA_TEMPLATE_ID` blank. The app then autofills with `create_from_design`,
which Canva supports as an equivalent source.

**Then verify the field name.** This is the one setup mistake that fails
silently: Canva ignores data for field names it doesn't recognise, so a typo
gives the guest an empty frame instead of an error. Check it with:

```bash
curl http://127.0.0.1:3000/api/canva/template
```

That returns every field in your template, its type, and whether
`CANVA_IMAGE_FIELD_NAME` matches one of them.

### 5. Configure Resend

1. Create an API key at [resend.com/api-keys](https://resend.com/api-keys) and
   set `RESEND_API_KEY`.
2. Verify your sending domain, then set `EMAIL_FROM` to an address on it. The
   default `onboarding@resend.dev` works for testing but only delivers to the
   email on your own Resend account.

### 6. Run it

```bash
npm run dev
```

Open the app on the iPad, then use **Share → Add to Home Screen** and launch it
from there. That drops the Safari chrome and gives you a real full-screen kiosk.
The app also requests a screen wake lock so the tablet does not sleep between
guests.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `CANVA_CLIENT_ID` | yes | Integration client ID |
| `CANVA_CLIENT_SECRET` | yes | Integration client secret |
| `CANVA_REFRESH_TOKEN` | yes | Seed refresh token from the setup flow |
| `CANVA_TEMPLATE_ID` | one of | Brand template to autofill |
| `CANVA_SOURCE_DESIGN_ID` | one of | Source design to autofill instead |
| `CANVA_IMAGE_FIELD_NAME` | no | Image field name; defaults to `image_frame_name` |
| `CANVA_EXPORT_QUALITY` | no | JPEG quality 1–100; defaults to `90` |
| `CANVA_SETUP_SECRET` | prod | Gate for the two setup routes |
| `RESEND_API_KEY` | yes | Resend API key |
| `EMAIL_FROM` | no | Verified sender address |
| `EVENT_NAME` | no | Copy on the landing screen and subject line |
| `APP_URL` | no | Public origin, used for the OAuth redirect URI |
| `UPSTASH_REDIS_REST_URL` | serverless | Durable token storage |
| `UPSTASH_REDIS_REST_TOKEN` | serverless | Durable token storage |
| `CANVA_TOKEN_FILE` | no | Override the local token file path |

## Deploying

Two things need attention before this runs well on a serverless host.

**Function duration.** The full Canva round trip usually takes 20–60 seconds.
`app/api/process-photo/route.ts` sets `maxDuration = 300`, but your host caps
it: Vercel Hobby allows 60s, Vercel Pro 300s. If requests time out, move to a
plan with a longer limit or run the app as a plain Node process
(`npm run build && npm run start`) on a host like Railway, Render, or Fly.

**Refresh token rotation.** Canva invalidates a refresh token the moment you use
it and returns a new one. On Vercel or Netlify the filesystem is ephemeral and
consecutive requests may hit different instances, so the rotated token needs a
durable home. Without one the booth falls back to the seed
`CANVA_REFRESH_TOKEN` after every cold start, and that value stops working once
it has been redeemed.

`lib/canva/token-store.ts` picks a backend automatically, first match wins:

| Priority | Backend | Trigger |
| --- | --- | --- |
| 1 | Postgres | `DATABASE_URL` / `POSTGRES_URL` (Neon, Supabase, any Postgres) |
| 2 | Upstash Redis | `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` |
| 3 | JSON file | `.canva-token.json` — local dev, or a long-running Node process |
| 4 | Memory | nothing configured; lost on restart |

If you attach a Neon database through Vercel's integration, `DATABASE_URL` is
set for you and nothing else is needed — a `canva_tokens` table is created on
first write. Verify which backend is live with `GET /api/health`.

Running the booth from one long-running Node process on the event's local
network avoids both issues: tokens persist to `.canva-token.json` and there is
no function timeout.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| No Configuration page under Outside Canva | You haven't clicked **Start integrating** yet. |
| `invalid_grant` on the first request | The refresh token was already redeemed. Re-run `/api/canva/auth`. |
| `invalid_scope` during authorization | A scope isn't enabled in the Developer Portal. Enable all six. |
| Photo arrives but the frame is empty | `CANVA_IMAGE_FIELD_NAME` doesn't match. Run `/api/canva/template`. |
| `not_found` for the brand template | You used a design ID. Brand template IDs come from `/brand/brand-templates/<ID>`. |
| `permission_denied` on autofill | The Canva plan lacks autofill, or the account can't see that template. |
| `quota_exceeded` / `trial_quota_exceeded` | Autofill usage limit hit. Not expected on Pro as of Sept 2026. |
| `license_required` on export | The template uses unpurchased premium elements. |
| Email never arrives | `EMAIL_FROM` is on an unverified domain, or you're on `onboarding@resend.dev` sending to someone else. |
| Request times out at ~60s | Host function limit. See Deploying. |

Errors are logged server-side with full detail. The kiosk only ever shows guests
a short, friendly message.
