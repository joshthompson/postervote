# Poster Vote

Two posters fly out, you pick your favourite, and then you see how everyone else voted on that pair. The votes feed a rating for each poster (Bradley–Terry, or Elo: see `RATING_SYSTEM` in `convex/shared.ts`), and `/results` shows the rankings.

- **Frontend:** SvelteKit (Svelte 5), static build for GitHub Pages
- **Backend:** Convex (`convex/`)

## Setup

```sh
pnpm install
pnpm dev            # first run: log in and create a Convex project; fills in .env.local
pnpm posters:sync   # optimise ./posters images and register them in Convex (run in a second terminal)
```

Then open the URL Vite prints.

## Credentials

| File              | Used by                        | Contents                                                        |
| ----------------- | ------------------------------ | --------------------------------------------------------------- |
| `.env.local`      | `pnpm dev`, `pnpm posters:sync` | `CONVEX_DEPLOYMENT`, `PUBLIC_CONVEX_URL` (dev deployment)      |
| `.env.production` | `deploy:*`, `ship`, `posters:sync:prod` | `CONVEX_DEPLOY_KEY` (prod), `BASE_PATH` (GitHub Pages path) |

See `.env.example`. Both files are gitignored.

## Collections and posters

Posters are voted on within a collection. One collection is live at a time. `/collections` lists them all: the live one first, marked as live, then the closed ones, each with its top three as a preview. `/collections/<slug>` shows a collection's results, and `/results` is the live one's (old `/results/<slug>` links redirect to `/collections/<slug>`).

Each poster has its own page at `/poster/<slug>/<name>`, where the name comes from its title (`Dungen – Vidrig Vår (Album)` becomes `dungen-vidrig-var-album`), so changing a title changes its link. On the rankings, clicking a poster opens the same detail in a modal and puts that link in the address bar.

Link previews of a poster's page show that poster. Crawlers don't run the app, so the build prerenders a page for every poster, in Convex (`posters.all`) or in an archive, and `src/hooks.server.ts` puts the poster's title and image into the preview tags from `app.html` (see `src/lib/server/previews.ts`). A poster synced after the build still opens, through the `404.html` fallback, but its link previews as the site until the next deploy. `pnpm ship` builds before it syncs, so after adding posters, deploy again or push to `main`. If the build can't reach Convex, it warns and carries on without the poster pages that are in Convex.

`posters/` holds the live collection. `posters/collection.json` names it:

```json
{ "slug": "stockholm-2026-09", "title": "Stockholm - September 2026" }
```

Put images (JPEG, PNG, WebP, or HEIC on macOS) in `posters/`, then run `pnpm posters:sync`. The script:

1. converts and resizes each image into `static/posters/<slug>/` using macOS `sips`
2. upserts each poster in the live collection, keyed by filename; posters whose files have been removed are deactivated, and their votes are kept (to delete their votes too, see `posters:remove` below)

`posters:sync` updates the live collection or a draft. Any other slug is refused, so a typo can't start a new collection.

Each visitor sees the pairs in their own fixed order. Taking a poster out leaves gaps in it rather than reshuffling it, so nobody is shown pairs they've already voted on. Adding a poster does reshuffle it. Until a visitor has seen every poster, a progress bar fills as they go, and pairs of posters they've already seen are skipped, so it takes about half as many pairs as there are posters.

### Drafting, publishing and archiving a collection

`pnpm collections` (`scripts/collections.mjs`) does it all. Add `--prod` for production; with no command, it lists the collections in Convex (drafts too) and in `archives/`.

1. **Draft the next one.** Give `collection.json` a new slug and title, replace the images and `titles.json`, and run `pnpm collections draft`. The new collection is in Convex but not live: visitors don't see it, and it can't be voted on. Run it again after changing images or titles. To draft from a folder prepared elsewhere, leaving `posters/` as it is, add `--dir <folder>` (it needs its own `collection.json` and `titles.json`), and pass the slug to `publish`. To get rid of a draft, run `pnpm collections discard <slug>`.
2. **Look it over.** Run `setDevMode(true)` in the browser console (`setDevMode(false)` turns it off). Dev mode is remembered on that device, and while it's on, drafts show on `/collections` and at `/collections/<slug>`, labelled as drafts. It only hides drafts; it doesn't protect them. Anyone who knows a draft's slug can ask Convex for its posters, though nothing in the built site gives one away.
3. **Deploy its images.** Commit `static/posters/<slug>/` and deploy.
4. **Publish it.** Run `pnpm collections publish`, which publishes the draft named in `collection.json`, or pass a slug. In one go, it:
   - makes the draft the live collection
   - closes voting on the one before
   - waits for the tally to count that collection's last votes
   - archives it to `archives/<old slug>/`

   Before changing anything, it checks it can read what the archive needs. With `--prod`, it also checks that the draft's images are on the live site (`--force` skips that). It asks you to type the slug first (`--yes` skips that).
5. **Commit `archives/<old slug>/` and deploy.**
6. **Clear the old one from Convex.** Run `pnpm collections clear <old slug>`. It deletes the collection's votes, posters and tallies from Convex, a batch at a time. It asks you to type the slug first (`--yes` skips that). With `--prod`, it first checks that `https://postervote.com/collections/<slug>` is live, which is true once a build with the archive is deployed.

An archive is three files:
- `summary.json`: what `/collections` shows
- `results.json`: everything the collection's pages show (rankings for each voter group, head-to-heads, biggest fans and the admin stats), loaded only when the collection is opened
- `votes.json.gz`: every vote, as a backup. Voters are numbered in the order they first voted, not by their browser's id, because the repo is public.

The site is built with these files (`src/lib/features/collections/archives.svelte.ts`) and reads an archived collection from them, never from Convex. To archive a collection by itself, run `pnpm collections archive <slug>`. To end voting with no new collection, archive the live one with `--close`.

Archiving reads through Convex's internal functions, so with `--prod` the deploy key in `.env.production` needs permission to run them.

An archived slug can't be published again. Archives from the dev deployment are marked as such, and `archive --prod` won't overwrite them without `--force`. Don't commit a dev archive.

Titles default to the filename (`001.jpg` becomes "No. 1"). To set your own, add them to `posters/titles.json`:

```json
{ "001.jpg": "Bo Kaspers Orkester" }
```

`posters/` holds the originals and is gitignored, apart from `collection.json` and `titles.json`. Commit `static/posters/`, which holds the optimised copies.

## Pixel letters

The hand-drawn lettering is a web font, Remi Pop, built from one PNG per character in `src/lib/assets/chars/<set>/` (`latin`, `cyrillic`, `numbers`, `punctuation`, `ligatures`). Dark, opaque pixels are ink; transparent or light ones are background. Each letter stands on the bottom edge of its image, and the image's width sets the letter's width. A letter with a descender (g, j, p…) marks its baseline with one red pixel: the bottom of that pixel's row is the baseline, the rows below hang under the line, and the red pixel isn't drawn.

To add or change a letter, save its PNG named after the character (`ж.png`, `7.png`), then run `pnpm font`. A letter's drawing covers both cases. To draw them separately, name them `upper_<letter>.png` and `lower_<letter>.png`, as in `latin/` (filenames can't tell `a` from `A`). A capital drawn alone covers the lowercase too, but a lowercase needs its capital. The site shows capitals only, so its font (the woff2) leaves the lowercase drawings out; the .ttf has them all. Characters that can't go in a filename use a name instead, such as `question.png` for `?` (see `NAMED` in `scripts/build-font.mjs`). A ligature is drawn as a character, and `LIGATURES` in the same script lists what typing shows it: `not_equals.png` draws `≠`, which typing `!=` also shows.

The script writes `src/lib/assets/fonts/remi-pop.woff2`, `remi-pop.ttf` (the same font, to install on a computer, e.g. for Figma; the site uses the woff2) and `remi-pop.json` (each letter's width and height, which `PixelText` uses for layout). It also keeps `remi-pop.version.json`: whenever the font draws anything differently, the version goes up (1.001, 1.002…), so Font Book offers to replace an installed copy instead of adding a duplicate. The copyright and licence (CC BY-NC 4.0, commercial use by arrangement) are set at the top of the script and show in Font Book. Commit them all with the drawings. `pnpm build` and the deploy workflow rebuild them too, so a drawing committed without running `pnpm font` still ships. The same drawings always produce the same files, so rebuilding doesn't create a diff.

Use the lettering through `PixelText` (or `Logo` for the drifting header logo). Characters without a drawing fall back to the site font.

## Scripts

| Script                   | What it does                                                                  |
| ------------------------ | ----------------------------------------------------------------------------- |
| `pnpm dev`               | Convex dev and Vite dev server together                                        |
| `pnpm build`             | Rebuild the pixel font, optimise posters and build the static site into `build/` |
| `pnpm preview`           | Serve the production build locally                                             |
| `pnpm check`             | Typecheck                                                                      |
| `pnpm font`              | Rebuild the pixel font from the letter drawings                                |
| `pnpm video [slug]`      | Render a collection's winner video (the active one by default) to `videos/<slug>.mp4`: 1080 × 1920, 30 fps, H.264 with the music. Needs `pnpm dev` running and Google Chrome installed. `--name '…'` changes the name in the question, `--fps 60` the frame rate, `--out` the file, `--url` the site it renders from |
| `pnpm map`               | Rebuild the world map on `/admin/stats` (`src/lib/features/stats/world.json`) from Natural Earth's shapes |
| `pnpm posters:sync`      | Sync posters to the dev deployment                                             |
| `pnpm posters:sync:prod` | Sync posters to the prod deployment                                            |
| `pnpm deploy:convex`     | Deploy Convex functions to prod                                                |
| `pnpm deploy:web`        | Deploy Convex, build against the prod URL, and push `build/` to the `gh-pages` branch |
| `pnpm ship`              | `deploy:web` and then `posters:sync:prod`                                       |

Note: `pnpm deploy` is a built-in pnpm command, so the full release script is called `ship`.

## How the rankings are counted

Casting a vote only records it (`votes.cast`) and bumps a small live counter. A background job, `tally.run` in `convex/tally.ts`, then processes each vote once. It updates the standings (wins, losses and an Elo rating), head-to-heads, voters, places and hourly counts, and rebuilds one compact snapshot per voter group, rating the posters with `RATING_SYSTEM`: Elo's running rating, or a Bradley–Terry fit to every head-to-head (`convex/bradleyTerry.ts`). It runs a minute after the first vote following a quiet spell, and then at most every 15 minutes while votes keep coming, so the rankings are never more than 15 minutes behind. The rankings page reads those snapshots and the live counter, never the votes themselves, so its cost stays flat as votes pile up. Pages keep the poster list in localStorage with a version stamp, and the server only sends it again when a sync changes it. This keeps the app well inside Convex's free tier.

After a normal deploy nothing needs running: the first vote, or the hourly check in `convex/crons.ts`, starts the tally. For maintenance (add `--prod` for production):

| Command                                                       | What it does                                                                 |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `npx convex run migrations:rebuild`                           | Recount every collection from its votes (the old rankings show until done)  |
| `npx convex run posters:merge '{"collection":"<slug>","keepKey":"060.jpg","dropKey":"061.jpg"}'` | Fold a duplicate poster into another, then recount                      |
| `npx convex run posters:remove '{"collection":"<slug>","keys":["069.jpg"]}'` | Take posters out and delete every vote they were in, then recount. Delete their files from `posters/` too, or the next sync brings them back |
| `npx convex run migrations:refreshSnapshots`                 | Rebuild every collection's rankings without recounting, e.g. after changing `RATING_SYSTEM` |
| `npx convex run migrations:tallyAll`                          | Start the tally for collections that have never had one                      |
| `npx convex run migrations:cleanupLegacy`                     | Remove scores stored the old way (on posters and in `pairs`)                 |
| `npx convex run migrations:collections`                       | One-off: move competitions over to collections (see below)                   |

### Renaming competitions to collections

Competitions became collections. Convex can't rename a table or a field, so the data is moved over by a migration, in this order:

1. Deploy as usual: push to `main` (or `pnpm deploy:web`). Until the next step has started, the live site finds no live collection, so start it as soon as the deploy is done.
2. `npx dotenv -e .env.production -- npx convex run migrations:collections --prod`. That loads the production deploy key, as `posters:sync:prod` does: plain `--prod` doesn't reach production. Within seconds, `/collections` shows the live collection again. The recount carries on in the background for a minute or so; the Convex dashboard's `competitions` table is empty once it's finished.
3. Deploy again (`gh workflow run deploy.yml`, or `pnpm deploy:web`). The first build ran before there were any collections, so its poster pages have no link previews.

Voting carries on throughout, apart from the moment between steps 1 and 2. The migration runs itself step by step:

1. Copies each competition into `collections`, keeping its old id as `formerId`, so visitors keep their place in the vote order (their browsers kept it under that id).
2. Moves each poster and vote from `competitionId` over to `collectionId`. Poster ids don't change.
3. Deletes the tallies and recounts them from the votes. The rankings keep showing their snapshot until the recount is done.

Once it's done, a later deploy can drop the `competitions` table and every `competitionId` field from `convex/schema.ts`, and make `collectionId` required. `formerId` can go once returning visitors have had time to come back.

## Code layout

Routes in `src/routes/` are thin: each page composes components from `src/lib/`.

| Folder                    | What goes there                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------- |
| `lib/components/ui/`      | Small reusable pieces with no app knowledge: buttons, pills, cards, meters, loader  |
| `lib/components/pixel/`   | The hand-drawn pixel lettering (`PixelText`, `Logo`) and the letters' sizes         |
| `lib/components/layout/`  | The site frame: header, menu, polka-dot background, page container                  |
| `lib/features/<feature>/` | Everything for one part of the site (`vote`, `results`, `collections`, `settings`, `designer`): its components, logic and types, side by side |
| `lib/services/`           | Browser-facing services: `storage` (all localStorage access), voter id, sound, `analytics` (Mixpanel) |
| `lib/state/`              | Shared app state, as rune classes                                                   |
| `lib/i18n/`               | The current language, and one file of UI text per language in `locales/`            |
| `lib/utils/`              | Small pure helpers                                                                  |
| `lib/styles/`             | Global CSS: design tokens, element defaults, the `.legible` utility, shared keyframes |

Import Convex's generated code through the `$convex` alias, e.g. `import { api } from '$convex/api'`, and the constants shared with the Convex functions through `$shared` (`convex/shared.ts`).

## Analytics

Usage is counted with Mixpanel, from the browser, through `src/lib/services/analytics.ts`. It stores nothing on the device (no cookie, no localStorage, not the voter id), so there's no consent banner, but every page load counts as a new anonymous visitor. Only the live site sends events; `pnpm dev` and `pnpm preview` log them to the console as `[analytics]`. The events, their properties and the conventions they follow are in [AGENTS.md](AGENTS.md#analytics--mixpanel).

## Admin pages

Three "hidden" pages are just for us: nothing links to them, search engines are asked to skip them, their visits aren't tracked, and they have no sign-in.

- `/admin/share` makes links and QR codes tagged with where they're handed out (see AGENTS.md).
- `/admin/video` previews a collection's winner video for Instagram: the logo, "What was the best poster of …?", most of its posters flying in and piling up, "The votes are in!", then third, second and the winner, and the site's address, all on the beat of the site's music (`src/lib/features/video/`, timings in `timeline.ts`). Its end clears to the bare stage it starts on, so it loops seamlessly, as Instagram plays it. Space replays, M mutes, Esc closes. It shows the `pnpm video` command that makes the file.
- `/admin/stats` shows a collection's votes per day and by hour of the day (designers and non-designers stacked), a map of the countries they come from, how many votes each voter casts, and the tally's state. Like the rankings, it reads the tallies (`stats.overview` in `convex/stats.ts`), never the votes, so it's up to 15 minutes behind. For an archived collection, both read the archive.

## Deploying to GitHub Pages

1. Create the GitHub repo and push: `git remote add origin … && git push -u origin main`
2. In `.env.production`, set `CONVEX_DEPLOY_KEY` (Convex dashboard → Settings → Deploy keys) and `BASE_PATH=/<repo-name>`. Leave `BASE_PATH` empty for a custom domain or a `<user>.github.io` repo.
3. Run `pnpm ship`
4. In the repo settings, go to Pages and set the source to "Deploy from a branch", branch **`gh-pages`**, folder `/ (root)`.

`404.html` is the SPA fallback, so deep links like `/results` work on GitHub Pages.
