# Verification

The complete site includes unit tests for CMS validation/authentication, storage conflicts, draft isolation, original-copy preservation, legacy routes, dynamic blogs, navigation and scroll progress.

The October 2026 integration checks passed for:

- 83 public application routes.
- All 69 required non-blog legacy URLs, without renaming.
- Content editing, private preview, publication and restoration.
- Homepage heading/body/image-alt edits in actual rendered HTML.
- Authenticated image uploads and public delivery.
- Enquiry persistence and authenticated private attachments.
- Blog creation, draft isolation, dynamic article URLs, publication and sitemap updates.

The public demo was separately checked without browser cookies: homepage, product and blog returned HTTP 200; the editor content API returned 401 and unauthenticated draft preview returned 404.

Run the commands in README.md to verify a fresh checkout. Live portal credential configuration remains a separate deployment requirement.
