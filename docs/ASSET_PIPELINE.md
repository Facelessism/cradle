# Asset Pipeline and Fingerprinting

Cradle has no bundler. The only "build" is `npm run generate` (also `npm run build`), which writes `data/projects.json` and creates a `thumbnail.svg` for any mini that does not have one. This document says which static assets exist, how they are named, how they are cached, and how a changed file gets a new URL.

---

## 1. Asset types

| Asset                              | Location                                        | Referenced from                                   | Fingerprinted               |
| :--------------------------------- | :---------------------------------------------- | :------------------------------------------------ | :-------------------------- |
| Mini thumbnail                     | `projects/<category>/<slug>/thumbnail.svg`      | `script.js`, through `src/utils/assetUrl.js`      | Yes, `?v=<thumbnailHash>`   |
| Site favicon                       | `assets/favicon.svg`                            | `index.html` and every mini's `index.html`        | No (see section 4)          |
| Social preview images              | `assets/social-preview.{webp,jpg,png}`          | `og:image` / `twitter:image` meta in `index.html` | No (see section 4)          |
| Mini-specific images, icons, fonts | `projects/<category>/<slug>/` (often `assets/`) | That mini's own HTML, CSS, JS                     | No, the mini owns its names |

## 2. Naming and size

- Thumbnails are always called `thumbnail.svg`, use a `1200 x 675` viewBox, and are committed to git. The generator only writes one when it is missing, so a hand-made thumbnail is never overwritten.
- Social previews are `1200 x 630`. Keep the WebP as the primary image and the JPEG as the fallback; the PNG is the lossless source.
- The favicon is a single SVG. Minis point at the shared `assets/favicon.svg` instead of keeping their own copy.
- Prefer SVG for flat graphics. Use WebP for photos and screenshots, and keep a single image under roughly 100 KB where you can.

## 3. Fingerprinting

### How it works

1. `npm run generate` reads each mini's `thumbnail.svg`, takes the SHA-256 of its content, and keeps the first 8 hex characters.
2. The value is written to `data/projects.json` as `thumbnailHash`. That file is the **manifest**: it maps every mini to the current fingerprint of its thumbnail. A mini without a thumbnail has no `thumbnailHash` field.
3. `script.js` builds the card image URL with `getThumbnailUrl()` (`src/utils/assetUrl.js`):

   ```text
   projects/games/2048-game/thumbnail.svg?v=1a2b3c4d
   ```

   If an entry has no `thumbnailHash`, the plain URL without `?v=` is used.

The hash comes only from the file content. Before hashing, `\r\n` is turned into `\n`, because git can check the same file out with CRLF on Windows and LF on Linux and CI. File modification times are not used anywhere: git does not store them, so they differ between machines. The generator used to compare the thumbnail's modification time with the folder's; that check was removed, so the same input always gives the same output.

### Keeping the manifest correct

- After changing or adding a `thumbnail.svg`, run `npm run generate` and commit `data/projects.json` together with the thumbnail.
- `npm run validate:projects-sync` (it also runs in CI and in `npm run healthcheck`) fails with a `thumbnailHash mismatch` message if the manifest does not match the files on disk.

### Why a query string

The site is plain static files, so renaming files to `thumbnail.<hash>.svg` would need a rewrite step and would change every mini's folder contents. A `?v=` query keeps the file name stable, needs no tooling beyond the existing generator, and is honored as part of the cache key by browsers and by common CDNs.

## 4. Caching

What is safe to cache depends on whether the URL changes with the content.

| URL                                   | Safe cache policy                                    | Reason                                      |
| :------------------------------------ | :--------------------------------------------------- | :------------------------------------------ |
| `thumbnail.svg?v=<hash>`              | `Cache-Control: public, max-age=31536000, immutable` | The URL changes when the content changes.   |
| `data/projects.json`                  | `Cache-Control: no-cache` (revalidate)               | It holds the hashes, so it must stay fresh. |
| `index.html`, `script.js`, CSS        | `Cache-Control: no-cache` (revalidate)               | Not fingerprinted.                          |
| `assets/favicon.svg`, social previews | A short `max-age` (for example one day)              | Not fingerprinted, see below.               |

This repository does not contain hosting configuration (no `vercel.json`, `_headers`, or server code), so these headers are a recommendation for whoever configures the host. They are not set by any file in this repo.

The favicon and the social previews are left without a hash on purpose. Social crawlers read the `og:image` URL as an absolute address and many of them cache it by URL, and minis link the favicon by a relative path in their own HTML. If one of these files changes in a way that must show up immediately, rename it (for example `social-preview-v2.webp`) and update the references.

## 5. Optimizing SVG

Thumbnails written by the generator are already small (a few KB). If you replace one with your own, remove editor metadata and comments, keep the `viewBox`, and avoid embedding raster images as base64. There is no automatic SVG optimizer in the pipeline, and none is required.

## 6. Checklist for changing an asset

- [ ] Changed or added a `thumbnail.svg`: ran `npm run generate` and committed `data/projects.json`.
- [ ] `npm run validate:projects-sync` passes.
- [ ] Changed the favicon or a social preview: checked that the file name and size rules in section 2 still hold, and renamed the file if the change must show up immediately.

## 7. Not covered here

This document covers static asset naming, fingerprinting, and caching. For the repository's centralized compilation, bundling, and build tier architecture for mini projects, see [BUILD_STRATEGY.md](BUILD_STRATEGY.md).
