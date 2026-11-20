# Mobile-first update

## Implemented

- In-flow mobile game heading and module selector; decorative card pandas hidden
  on small screens. Desktop overflow navigation hidden.
- Smaller catalog action and sidebar language badge without nested flag styling.
- Six individually drawn achievement trophies and a responsive trophy grid.
- Restyled fortune wheel; its result no longer reveals the translation before
  the learner answers.
- Hash-route 404 screen and panda favicon.
- Non-modal, bounded-height tutor panel, survey with stars/options/free text,
  account mailing opt-ins and owner frequency settings.
- `/api/engagement`: authenticated PostgreSQL persistence, owner-only schedule
  updates, server-derived daily tutor quota (3 free / 20 PRO), bonus questions
  for a new verified referred account. Bonus rewards are capped at 30; referrals
  can be claimed only once per invitee within a day of registration.
- AI uses `APP_GEMINI_API_KEY` on the server, has a 500-request global daily cap,
  limited input/output, and refunds reservations when a provider call fails.
  The global cap includes pending requests. Daily limits use database dates.

## Runtime requirements and remaining work

This repository runs only Vite in Make. The existing Vercel backend, PostgreSQL
schema and account services are required for `/api/engagement`, just as they are
for existing sign-in and activity APIs. A frontend build does not verify them.
Deploy the API to Vercel and configure `APP_GEMINI_API_KEY` there as well as in
any sandbox that runs the server. Never expose it to browser code.

Crystal spending is not implemented: current client reward counts are not a
safe authoritative wallet. Add a transaction-backed wallet and migrate rewards
before charging users. Referral rewards currently give questions, not crystals.

Mail consent and frequency are stored, but scheduled delivery is not implemented.
The UI explicitly labels the sender as not connected. A delivery worker must
honor consent, frequency, unsubscribe, retries, and delivery deduplication.

The repository has no existing interface-language selector or translations;
only the learning-language selector was made smaller.

## Verification

- `pnpm exec tsc --noEmit`: passed.
- `pnpm run build`: passed, existing bundle-size warning.
- Chromium: 8 routes at 360, 390, 768 and 1280 px, no horizontal overflow or
  Vite error overlay detected; one initial catalog sample was still loading.
- Full playthroughs of every game/test and authenticated server integration
  (database, concurrency, referral and provider behavior) remain unverified.
- A separate 390px check confirmed the mobile “More” control is displayed and
  the panda is statically positioned. The subsequent tutor interaction check
  stalled in the headless browser and was cancelled; tutor interactions are
  not claimed as browser-verified.
