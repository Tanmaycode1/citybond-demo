# CityBond — Website & Content Portal

Complete source code for the CityBond demo website, including the animated homepage, product and company pages, original SEO routes, dynamic blog, and authenticated content portal.

**[Open the public demo](https://citybond-studio-git-feat-legacy-route-c066f6-geekrooms-projects.vercel.app/)** · **[Public repository](https://github.com/Tanmaycode1/citybond-demo)**

The `main` branch contains the full multipage website and portal, including the redesigned homepage with the original CityBond copy. It is based on source revision `56e6796`, with standalone setup instructions and a local credential generator. The separately hosted early prototype and its `/version` palette comparison are not this application.

## Quick start

Use Node.js 22 or 24 and npm.

```sh
git clone https://github.com/Tanmaycode1/citybond-demo.git
cd citybond-demo
npm ci
npm run setup:local
npm run dev
```

- Website: **http://localhost:3001**
- Content portal: **http://localhost:3001/studio-7c9e**
- Your generated local password: **`.owner-access.txt`**

The setup command creates unique credentials in `.env.local` and `.owner-access.txt`, with owner-only file permissions. Both files are gitignored. It refuses to overwrite existing credentials. Local drafts, publications, uploads and enquiries are stored in the gitignored `.data/` directory. The repository includes the website's seed content and images, so no database or cloud account is needed for local development.

## Content portal

Sign in at `/studio-7c9e`. The portal's address is not its security mechanism: content writes, draft previews, enquiry reads and private attachments require a signed HTTP-only session.

1. **Original Pages**: choose a page and edit the actual page title, introduction, SEO fields and content blocks. The homepage is `/`. Headings, paragraphs, links, lists and tables are editable.
2. **Home, Products, Pages, Projects and Resources**: update images, alternate text, structured details and supporting sections. Home also controls the role selector, scroll story, statistics and contact section. Original Pages copy takes precedence over older fallback text fields.
3. **Site → Nav**: edit the menu and dropdown links.
4. **Blogs**: add articles, edit their content and images, and set their URL slugs. New articles start as drafts; published posts appear at `/blog/your-slug/`. **Blog** controls the listing page and pagination.
5. **Save draft**, then **Open draft preview** to review privately. **Publish changes** makes the saved content live without a code deployment.
6. **Publish history** restores an earlier revision into the draft. **Enquiry inbox** shows submitted forms and private attachments.

The homepage presents imported copy in designed sections rather than a continuous text block. Section layout uses stable content IDs, so changing a heading does not break its layout. Images and text are still supplied by the portal's data.

Product thickness filters on Products and Collections use the same supplied panel specifications as the detail pages. Edit the product's **Original Pages** specification table: the `Panel` column or an explicit `Thickness of Composite Panel (mm)`, `Panel Thickness`, or `ACP Thickness` row. Values must include `mm`. Coil/skin thickness, coating values, and panel lengths are excluded. For new products without an Original Pages record, use a structured product specification labelled `Panel thickness`, `ACP thickness`, `Published thickness`, or `Published thicknesses`. Original-page data takes precedence when present. Products without a documented thickness remain in the unfiltered listing. Draft preview and publication both derive the filter values from their respective content revisions; no per-product mapping needs updating in code.

## Included features

Under **Site**, `headerStyle` accepts `tinted` (brand-tinted header with navy separator) or `white` (the original white alternative). Each footer link has an editable `group`; the footer renders those groups without dropping links. Its logo, tagline, description, contact details, and social links continue to use the Site content fields. The folded-panel artwork is decorative SVG and does not require an uploaded image.

The homepage starts with role selection or **Explore CityBond** (`/?explore=1`). The six role journeys follow the supplied Customer Journey PDF; their section order, primary/secondary actions, and showcased project categories are editable under **Roles**. Internal browsing carries a validated `role` query parameter into forms, where the role can still be changed. Returning to the generic homepage clears that perspective. Project enquiry links carry a validated project slug separately from product selection.

The product finder collects an enquiry before revealing its shortlist. It saves the chosen role and use case through the existing inbox endpoint; a failed submission keeps the form available for retry. Thirteen project/product associations were verified against supplied finish codes; their evidence is in `content/journey-project-links.json`.

- Responsive CityBond branding, six role journeys, scroll-driven image assembly, keyboard-accessible material tabs and reduced-motion support.
- Product collections, finish data, project galleries, company pages, network directory, material finder, resources and contact forms.
- Original URL aliases, canonical metadata, XML sitemap and editable dropdown navigation.
- Draft/publish workflow, immutable revision history, stale-edit conflict protection, image/PDF uploads and private enquiry attachments.
- A shared dynamic blog template, archive pages and four clearly labelled example articles.
- Exact imported original-site copy, content provenance, stock-image attribution, and the full test suite.

## Routes and content coverage

`content/required-urls.txt` contains the 184 supplied legacy URLs. The implementation covers:

| Coverage | Count |
| --- | ---: |
| Original non-blog URLs, rendered directly | 69 |
| Editable original-page records (aliases share records) | 62 |
| Original blog listing/archive URLs | 25 |
| Original article/web-story URLs awaiting supplied content | 90 |

Original spellings, PHP aliases and trailing-slash forms are retained, including `/vijyawada`. Public paths map to internal renderers in `src/data/canonical-paths.json` and `src/lib/routes.ts`.

The 90 original articles/web stories have not been migrated. Four sample posts demonstrate the blog workflow; samples and empty archives are excluded from search indexing. Preserve original article slugs when adding the real content.

`src/data/site.json` is the seed used until a store has its first published revision. `content/original-copy.json` holds the captured source text. The portal's **Import original website text** action restores that captured text to a draft while preserving images, navigation and blogs; review before publishing.

## Hosting on Vercel

Import this repository into a Vercel project with the Next.js framework preset. Connect a **private Vercel Blob store** and configure these server-only environment variables:

| Variable | Purpose |
| --- | --- |
| `BLOB_STORE_ID` | Added by the connected Blob store; deployment OIDC authenticates storage operations. |
| `CMS_PASSWORD_HASH` | Salted scrypt password hash, in `salt:hexKey` format. |
| `CMS_SESSION_SECRET` | Random session-signing secret of at least 32 characters. |
| `SITE_URL` | Optional canonical origin; defaults to `https://citybond.in`. |

The local setup command generates the two CMS values in `.env.local`. Transfer them using Vercel's secure environment-variable configuration, then redeploy. Never use `NEXT_PUBLIC_` prefixes for secrets. Use a separate Blob store for staging if publishing previews must not affect production content.

For a CLI deployment after signing in and linking the intended project:

```sh
npx vercel login
npx vercel link
node scripts/configure-vercel.mjs
npx vercel --prod
```

The configuration helper passes the CMS secrets through stdin rather than command arguments or logs. It does not create the Blob store; connect storage first. Production deliberately fails closed if storage is absent, and portal sign-in fails closed if credentials are absent.

**Hosted demo status:** the website link above is public. At this source handoff, the existing demo's live portal credentials still need configuration; the full portal is implemented and its edit/preview/publish flow has been tested locally. No live account credentials are included in this repository.

## Verification

```sh
npm test
npm run typecheck
npm run build
```

With a local server running and `setup:local` completed, these integration checks exercise the actual portal endpoints:

```sh
node scripts/check-local.mjs
node scripts/check-content-flow.mjs
node scripts/check-blog-local.mjs
```

Run integration checks against a disposable local content store. They save/publish temporary test content and restore the starting content. The general integration check also creates a local test enquiry and uploaded image; it sends no email. The homepage content-flow check validates rendered HTML, not just React's serialized payload.

Optional route audit:

```sh
AUDIT_OUTPUT=/tmp/citybond-routes.json node scripts/audit-required-urls.mjs
```

Optional source-copy verification and import require Python with `requests`, `beautifulsoup4` and `html5lib`:

```sh
python scripts/check-original-copy.py
python scripts/import-original-copy.py
```

The importer fetches the original website and checks text parity. Raw HTML is excluded from Git. Review regenerated source data before importing or publishing it.

## Project layout

```text
src/app/[[...path]]/        Public route entry point and metadata
src/app/studio-7c9e/        Authenticated portal entry point
src/app/api/studio/        Login, content, uploads, draft and publishing APIs
src/app/api/enquiries/     Form submissions
src/app/api/media/         Public uploaded media delivery
src/components/site/      Website layouts, animation and navigation
src/components/portal/    Content editor interface
src/lib/cms/              Schemas, authentication, storage and revisions
src/lib/routes.ts         Legacy URL resolution and canonical paths
src/lib/blog.ts           Dynamic blog and archive routing
src/data/                 Website seed content and canonical route map
content/                  Imported copy, URL baseline and asset provenance
public/                   Logos, imagery and stock placeholders
scripts/                  Setup, source import and integration checks
tests/                    CMS, routing, blog, content and motion tests
```

## Demo details

The brand palette follows the supplied CityBond guide. Bebas Neue and Roboto Condensed are review fallbacks; the exact licensed ND Logos/Bebas Neue Pro webfont files were not supplied. Asset provenance is recorded in `content/assets.json` and `content/stock-assets.json`. Stock architecture photographs are labelled as inspiration rather than evidence of CityBond installations.

Forms persist enquiries for review in the portal; they do not send email notifications. Third Eye View is a manual design-request workflow, not an AI rendering service. Live enquiries, attachments, passwords, sessions, private runtime storage and deployment credentials are excluded from this public source repository.
