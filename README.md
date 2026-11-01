# eWith.me JSON-LD Schema & Readability Inspector

**Real-time Schema.org JSON-LD linter, Wikidata entity grounding verifier, Flesch-Kincaid & Sentence Burstiness readability analyzer, and SEO structured data snippets for Visual Studio Code.**

Built by the engineering team at **[eWith.me](https://ewith.me)** — the privacy-first AI writing, academic research, and career intelligence platform.

---

## ✨ Key Features

1. **Real-Time Schema.org JSON-LD Diagnostics (`<script type="application/ld+json">`)**
   - Automatically detects and validates embedded JSON-LD blocks in `.html`, `.htm`, `.jsx`, `.tsx`, `.vue`, `.astro`, `.md`, `.mdx`, `.json`, and `.jsonld` files.
   - Verifies required and recommended Google Rich Result properties for `Article`, `NewsArticle`, `TechArticle`, `BlogPosting`, `FAQPage`, `BreadcrumbList`, `JobPosting`, `Course`, `CollegeOrUniversity`, `WebApplication`, and `Organization`.
   - Checks for **Wikidata Entity Grounding (`sameAs`, `about`, `mentions` `Q-ID` links)** to strengthen semantic search entity disambiguation.

2. **Live Flesch Readability & Sentence Burstiness ($\sigma$) Scoring**
   - Displays live **Flesch Reading Ease (`0–100`)**, **Flesch-Kincaid Grade Level**, and **Schema count** directly in the VS Code Status Bar.
   - Measures **Sentence Length Burstiness (standard deviation $\sigma$)** and flags overused AI-cliché phrases so technical writers and editors maintain natural, high-burstiness human prose.

3. **Interactive Side-by-Side Audit Webview Report**
   - Run **`eWith.me: Audit JSON-LD Schema & Readability`** from the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) or click the Status Bar badge to open a rich visual report of all extracted JSON-LD entities, property diagnostics, and readability metrics.

4. **1-Click JSON-LD Templates & Snippets**
   - Run **`eWith.me: Insert JSON-LD Schema Template...`** or type `ewith-jsonld-article`, `ewith-jsonld-faq`, `ewith-jsonld-breadcrumb`, `ewith-jsonld-job`, or `ewith-jsonld-webapp` to insert production-ready structured data blocks.

---

## 🔗 Companion Online Tools & Documentation ([eWith.me](https://ewith.me))

- **[eWith.me Platform Home](https://ewith.me)** — Local-first AI tools, exam preparation, and open job directory.
- **[AI Humanizer & Burstiness Optimizer](https://ewith.me/ai-humanizer)** — Refine robotic drafts into natural human prose.
- **[Paraphrasing & Text Studio](https://ewith.me/paraphrasing-tool)** — Rewrite and polish academic or technical writing.
- **[Grammar Checker & Proofreader](https://ewith.me/grammar-checker)** — Instant client-side syntax and style linting.
- **[AI Summarizer](https://ewith.me/summarizer)** — Condense long-form research articles into key takeaways.
- **[Academic Citation Generator (APA, MLA, Chicago, Harvard)](https://ewith.me/citation-generator)** — Format verified bibliographic references.
- **[Official GitHub Repository](https://github.com/ewithme-coder/ewithme-jsonld-readability)** — Source code, issue tracker, and release history (`ewithme-coder/ewithme-jsonld-readability`).
- **[Architecture & Documentation](https://ewith.me/docs)** — Explore our isomorphic SSR, JSON-LD entity graph, and 0-byte telemetry specifications.
- **[Privacy Policy](https://ewith.me/privacy)** — 100% local in-editor execution with zero source code transmission and zero telemetry.

---

## 🔒 Privacy & Security Guarantee

This extension executes **100% locally inside Visual Studio Code**. Zero source code, document text, or telemetry is ever transmitted to external servers. Read our full **[Privacy Policy](https://ewith.me/privacy)**.
