# CityBond website and content portal

[Public demo](https://citybond-studio-git-feat-legacy-route-c066f6-geekrooms-projects.vercel.app/) · [Public repository](https://github.com/Tanmaycode1/citybond-demo)

The complete multipage website, original content migration, owner portal, enquiry storage and exterior material visualizer. The early prototype at `citybond-studio.vercel.app` and its palette comparison are a different deployment.

## Local setup

Use Node.js 24 and npm:

```sh
npm ci
npm run setup:local
npm run dev
```

Website: `http://localhost:3001`. Portal: `http://localhost:3001/studio-7c9e`. The setup command generates a unique password in `.owner-access.txt` and secrets in `.env.local`, both owner-readable and gitignored. It refuses to overwrite credentials. Drafts, publications, uploads and enquiries use `.data/`; `CMS_LOCAL_DIR` can select a different store. No Docker or database is required locally.

## Original content migration

The November 2026 source crawl imported 73 complete articles, 29 editable AMP stories, 130 original product finishes and 558 first-party media files. There are 62 canonical main-page records and 98 projects, including 66 original gallery entries. All 292 discovered working source addresses are covered, including aliases, query archives and pagination.

Original spellings, PHP aliases and trailing slashes are retained. Articles use eight posts per page and ten original blog listing pages. The two original author slugs remain distinct. `/hpl-series` and the petrol-canopy alias retain their appropriate destination. Source links which were already broken are tracked separately from working routes.

- `content/migration-source-urls.txt`: working source URL baseline.
- `content/migration-assets.json`: media URL paths, hashes and provenance.
- `content/original-copy.json`: captured original page text.
- `src/data/site.json`: initial editable content, metadata, products, rich article HTML and story slides.

Older content stores upgrade once through `sourceRevision: 1`, bringing imported records up to date while preserving unrelated custom records. Subsequent owner edits are preserved. Existing immutable publication revisions remain available for rollback.

## Compact content portal

Sign in at `/studio-7c9e`. The route itself is not the security mechanism: writes, enquiries, previews and private attachments require an authenticated HTTP-only session.

- **Pages:** original page copy, home sections, role journeys and supporting content.
- **Products:** products, finishes, specifications, images and project relationships.
- **Journal:** rich-text articles, images, SEO, drafts and editable web-story slides.
- **Resources:** upload or link actual documents; request forms remain until files are supplied.
- **Enquiries:** paginated submissions, structured context and authenticated attachments.
- **Settings:** navigation, branding, shared labels, configuration and publication history.

Search the record list and edit one record at a time using its content/image/SEO tabs. Use **Save draft**, **Open draft preview**, then **Publish changes**. Publication updates the site without redeployment. New articles route to `/blog/your-slug/`; new products render their own specifications. Original source routes are protected against accidental removal or renaming. Stale-edit checks prevent overwriting a newer revision.

Original-page copy takes precedence over fallback fields. Product thickness filters read documented panel/ACP thickness in millimetres, excluding coil thickness and dimensions. Products without documented thickness remain in the unfiltered listing.

## Customer journey and forms

The six role journeys follow the supplied Website Customer Journey PDF. Validated role, product and project context carries into enquiries. Product-finder answers are stored separately from the user's message before the shortlist is revealed. Thirteen project/product relationships have evidence in `content/journey-project-links.json`; unverified gallery entries do not claim a particular finish.

Contact, dealership, samples, career applications, catalogue requests, magazine requests, product finder and visualizer enquiries use private server storage. Career attachments require authentication, and job applicants are not asked for a business role. Submissions appear in the portal inbox; email notifications are not configured.

## Exterior visualizer

The active `NeutralWallVisualizer` uses the reviewed neutral facade preparation:

1. Upload a building photo and choose a finish.
2. Preparation starts while the visitor completes the compact contact form.
3. A server-side Meta image edit creates neutral panels. Segmentation and coverage refinement protect openings and scene details.
4. After the form, materials and colours are composed locally without another AI generation per selection.
5. A comparison slider shows the original and result. A compact collection selector exposes all source finishes.

Set the server-only `MODEL_API_KEY`. No local GPU is required. Uploaded photos are sent to the hosted provider and stored privately. Prepared results are cached by decoded pixel fingerprint and pipeline version, not filename. Three photos per submitted email and upload/retry rate limits are implemented; email ownership is not verified. New photos still require preparation, and mask/geometry quality can vary between buildings.

Main implementation: `NeutralWallVisualizer.tsx`, `neutral-server.ts`, `neutral-renderer.ts` and `neutral.worker.ts`. Older experimental renderers remain for comparison; the neutral workflow is active.

## Hosting and SEO

Use a Next.js Vercel preview deployment and a connected **private Blob store**. A CPU VM can use `npm run build` and `npm start` with persistent local storage. Configure server-only variables:

| Variable | Purpose |
| --- | --- |
| `BLOB_STORE_ID` | Private Vercel Blob store, authenticated with deployment OIDC. |
| `CMS_PASSWORD_HASH` | Salted scrypt password hash generated by setup. |
| `CMS_SESSION_SECRET` | Random session secret, at least 32 characters. |
| `MODEL_API_KEY` | Meta image preparation and segmentation. |
| `SITE_URL` | Canonical origin; defaults to `https://citybond.in`. |
| `SITE_INDEXABLE` | Keep `false` on demos; set `true` only at final domain cutover. |

Never use `NEXT_PUBLIC_` for secrets. Hosted storage and portal authentication fail closed when configuration is absent. Use separate stores if staging edits must not affect production content. Preserve the existing preview alias; deploying to the early prototype's production alias would replace that comparison.

Original titles, descriptions, terminology, article dates and canonical paths are imported. Published routes appear in the sitemap. Category/tag indexing follows original exclusions. Private paths are excluded and the Vercel demo defaults to noindex. Check final-domain redirects, robots and sitemap in Search Console at cutover; parity tests cannot guarantee rankings.

## Verification

```sh
npm test
npm run lint
npm run build
node scripts/final-browser-qa.mjs
```

The final browser runner generates temporary credentials and an isolated store, starts the production build on port 3008 and records headless Chromium. It checks portal editing, seven form paths, the source routes, AMP stories and rendered content/SEO. Install Chromium using `npx playwright install chromium`. Source parity requires Python `beautifulsoup4` and the captured source snapshot; adjust source/output paths in the scripts for another checkout.

Final local results: **87 tests passed**, lint and build passed, **292/292 routes**, **135/135 content/SEO comparisons**, **29/29 AMP stories**, portal create/upload/preview/publish and seven form submissions passed. Visualizer flow checks use a saved prepared image and controlled API timing; this run does not claim a fresh paid inference or provider availability.

`scripts/import-final-source.py` imports the captured crawl. Review regenerated data before applying it. Raw crawl files, recordings, private content stores and secrets are excluded from this repository.

## Remaining client inputs

- Actual CAD/spec PDFs, installation guides, case-study files, corporate video and podcast links.
- Seven additional 3D finishes if all eleven in the journey PDF are required; the source exposes four.
- PVC/WPC catalogue information and more verified project/material relationships.
- Dealer-specific addresses; 18 city pages currently use central contacts.
- Licensed ND Logos/Bebas Neue Pro webfonts; review fallbacks remain.

Missing assets use enquiry/request actions where applicable. Original content is preserved while rebranding and customer journeys retain the new presentation.
