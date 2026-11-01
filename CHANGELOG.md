# Changelog — eWith.me JSON-LD Schema & Readability Inspector

## [1.1.2] - 2026-11-01
### Changed
- Linked official public GitHub repository (`https://github.com/ewithme-coder/ewithme-jsonld-readability`) and issue tracker in `package.json` and `.vsixmanifest` for Visual Studio Marketplace and Open VSX Registry verification.

## [1.1.1] - 2026-10-31
### Added
- Real-time Schema.org JSON-LD extraction and diagnostics for `.html`, `.jsx`, `.tsx`, `.vue`, `.astro`, `.md`, `.json`, and `.jsonld` files.
- Required & recommended property validation for `Article`, `NewsArticle`, `TechArticle`, `FAQPage`, `BreadcrumbList`, `JobPosting`, `Course`, `CollegeOrUniversity`, `WebApplication`, and `Organization`.
- Wikidata Entity Grounding (`sameAs` / `about` / `mentions` `Q-ID`) verification.
- Live Flesch Reading Ease, Flesch-Kincaid Grade Level, Sentence Length Burstiness ($\sigma$), and AI-cliché detection in the VS Code Status Bar and interactive Audit Report Webview.
- Built-in JSON-LD templates (`ewithme.insertSchemaTemplate`) and snippets (`ewith-jsonld-*`).
