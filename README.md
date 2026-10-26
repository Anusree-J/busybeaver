# Busy Beaver

A static personal website hosted by GitHub Pages at https://busybeaver.life/.

The forest-and-flowers visual brief is recorded in [DESIGN.md](DESIGN.md).

## Local preview and checks

Use Node 24 or newer. No build is required for publication.

```sh
npm ci
npm run check
npm test
npm audit --audit-level=high
python3 -m http.server 8000
```

Open http://localhost:8000/. The tests use jsdom as a development-only dependency to load the actual HTML, CSS and JavaScript through a local HTTP server. They cover the index, both articles, navigation, loading, empty results, failed responses and retry recovery. The website itself has no npm runtime dependencies and all images and fonts are served locally.

## Add a post

Create a Markdown file under `posts/` with the same frontmatter fields as the existing posts, then add its filename to `posts/posts.json`. Posts are sorted by date. Post filenames must contain only lowercase letters, digits and hyphens before `.md`. Only trusted repository authors should edit post Markdown; the lightweight renderer permits authored HTML.

## Deployment and rollback

Changes go through a branch and PR. The Site checks workflow runs syntax checks, integration tests and dependency audit. After green checks and review, merge to `main`; GitHub Pages publishes the repository root. Keep `CNAME` and `.nojekyll` intact.

To prepare a rollback, branch from the latest main and run `git revert --no-edit <change-commit-sha>` (or `git revert -m 1 --no-edit <merge-commit-sha>` for a merge commit). Send the revert through the same checked PR process. This preserves history and republishes the prior files without a force push.

Forest photo attribution is in `photo-credits.html`. Existing botanical photos, legacy article URLs, and their original stylesheets remain in the repository.

## Connections puzzles

`connections.html` is the public playable archive of Anusree's published AJ puzzles, copied from the separate Connections – Friends Edition board. The shared board is the authoring source; Busy Beaver is the personal website. Only published records owned by Anusree are included. Drafts and Aishwarya's puzzles are excluded.

`connections/puzzles.json` is a snapshot, currently AJ #1–4, newest first. To add later publications, export the authenticated author's published groups and update this file through the normal PR process. Never include credentials, private drafts, or shared-board progress in the repository. Existing word/category text must match the published source exactly. Public visitors play without logging in; progress is local to their browser and validated by replaying guesses. The static site's puzzle definitions are public source, as with other browser-only games.
