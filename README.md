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

## Competitions and posters

Posters are voted on within a competition. One competition is active at a time. Past competitions are archived: their results stay at `/results/<slug>`, which is linked from the burger menu.

Each poster has its own page at `/poster/<slug>/<name>`, where the name comes from its title (`Dungen – Vidrig Vår (Album)` becomes `dungen-vidrig-var-album`), so changing a title changes its link. On the rankings, clicking a poster opens the same detail in a modal and puts that link in the address bar.

Link previews of a poster's page show that poster. Crawlers don't run the app, so the build asks Convex (`posters.all`) for every poster and prerenders a page for each one, and `src/hooks.server.ts` puts the poster's title and image into the preview tags from `app.html` (see `src/lib/server/previews.ts`). A poster synced after the build still opens, through the `404.html` fallback, but its link previews as the site until the next deploy. `pnpm ship` builds before it syncs, so after adding posters, deploy again or push to `main`. If the build can't reach Convex, it warns and carries on without the poster pages.

`posters/` holds the active competition. `posters/competition.json` names it:

```json
{ "slug": "stockholm-2026-09", "title": "Stockholm - September 2026" }
```

Put images (JPEG, PNG, WebP, or HEIC on macOS) in `posters/`, then run `pnpm posters:sync`. The script:

1. converts and resizes each image into `static/posters/<slug>/` using macOS `sips`
2. makes that competition the active one and archives any other
3. upserts each poster in the competition, keyed by filename; posters whose files have been removed are deactivated, and their votes are kept (to delete their votes too, see `posters:remove` below)

Each visitor sees the pairs in their own fixed order. Taking a poster out leaves gaps in it rather than reshuffling it, so nobody is shown pairs they've already voted on. Adding a poster does reshuffle it. Until a visitor has seen every poster, a progress bar fills as they go, and pairs of posters they've already seen are skipped, so it takes about half as many pairs as there are posters.

To start a new competition, give `competition.json` a new slug and title, replace the images and `titles.json`, and sync. The old competition's images stay in `static/posters/<old slug>/` for its archive.

Titles default to the filename (`001.jpg` becomes "No. 1"). To set your own, add them to `posters/titles.json`:

```json
{ "001.jpg": "Bo Kaspers Orkester" }
```

`posters/` holds the originals and is gitignored, apart from `competition.json` and `titles.json`. Commit `static/posters/`, which holds the optimised copies.

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
| `npx convex run migrations:rebuild`                           | Recount every competition from its votes (the old rankings show until done)  |
| `npx convex run posters:merge '{"competition":"<slug>","keepKey":"060.jpg","dropKey":"061.jpg"}'` | Fold a duplicate poster into another, then recount                      |
| `npx convex run posters:remove '{"competition":"<slug>","keys":["069.jpg"]}'` | Take posters out and delete every vote they were in, then recount. Delete their files from `posters/` too, or the next sync brings them back |
| `npx convex run migrations:refreshSnapshots`                 | Rebuild every competition's rankings without recounting, e.g. after changing `RATING_SYSTEM` |
| `npx convex run migrations:tallyAll`                          | Start the tally for competitions that have never had one (e.g. old archives) |
| `npx convex run migrations:cleanupLegacy`                     | Remove scores stored the old way (on posters and in `pairs`)                 |

## Code layout

Routes in `src/routes/` are thin: each page composes components from `src/lib/`.

| Folder                    | What goes there                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------- |
| `lib/components/ui/`      | Small reusable pieces with no app knowledge: buttons, pills, cards, meters, loader  |
| `lib/components/pixel/`   | The hand-drawn pixel lettering (`PixelText`, `Logo`) and the letters' sizes         |
| `lib/components/layout/`  | The site frame: header, menu, polka-dot background, page container                  |
| `lib/features/<feature>/` | Everything for one part of the site (`vote`, `results`, `settings`, `designer`): its components, logic and types, side by side |
| `lib/services/`           | Browser-facing services: `storage` (all localStorage access), voter id, sound, `analytics` (Mixpanel) |
| `lib/state/`              | Shared app state, as rune classes                                                   |
| `lib/i18n/`               | The current language, and one file of UI text per language in `locales/`            |
| `lib/utils/`              | Small pure helpers                                                                  |
| `lib/styles/`             | Global CSS: design tokens, element defaults, the `.legible` utility, shared keyframes |

Import Convex's generated code through the `$convex` alias, e.g. `import { api } from '$convex/api'`, and the constants shared with the Convex functions through `$shared` (`convex/shared.ts`).

## Analytics

Usage is counted with Mixpanel, from the browser, through `src/lib/services/analytics.ts`. It stores nothing on the device (no cookie, no localStorage, not the voter id), so there's no consent banner, but every page load counts as a new anonymous visitor. Only the live site sends events; `pnpm dev` and `pnpm preview` log them to the console as `[analytics]`. The events, their properties and the conventions they follow are in [AGENTS.md](AGENTS.md#analytics--mixpanel).

## Admin pages

Two hidden pages are just for us: nothing links to them, search engines are asked to skip them, their visits aren't tracked, and they have no sign-in.

- `/admin/share` makes links and QR codes tagged with where they're handed out (see AGENTS.md).
- `/admin/stats` shows a competition's votes per day and by hour of the day (designers and non-designers stacked), how many votes each voter casts, and the tally's state. Like the rankings, it reads the tallies (`stats.overview` in `convex/stats.ts`), never the votes, so it's up to 15 minutes behind.

## Deploying to GitHub Pages

1. Create the GitHub repo and push: `git remote add origin … && git push -u origin main`
2. In `.env.production`, set `CONVEX_DEPLOY_KEY` (Convex dashboard → Settings → Deploy keys) and `BASE_PATH=/<repo-name>`. Leave `BASE_PATH` empty for a custom domain or a `<user>.github.io` repo.
3. Run `pnpm ship`
4. In the repo settings, go to Pages and set the source to "Deploy from a branch", branch **`gh-pages`**, folder `/ (root)`.

`404.html` is the SPA fallback, so deep links like `/results` work on GitHub Pages.
