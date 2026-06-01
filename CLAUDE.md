# CLAUDE.md

Guidance for AI assistants (and humans) working in this repository.

## What this project is

**Mi Biblioteca** ("Historias a pedido" / "Stories on demand") is a personal,
single-page reading app. It is a curated library of long-form narrative
**stories written in Spanish** — non-fiction deep dives into business,
technology, history, and culture (e.g. the fall of Enron, the PayPal Mafia,
Pan Am, Google+).

The defining workflow of this project is **content authoring, not software
development**: the owner asks Claude to "add the story of [topic] to my library",
and Claude *writes the story* and edits the site to include it. This intent is
baked into the app itself — the "＋ Pedir historia" button explains the loop:

> 1. Abrí Claude / Cowork.
> 2. Decime: "Agregá a mi biblioteca la historia de [tema]".
> 3. Yo la escribo y actualizo la web automáticamente. 🎉

So most tasks here will be **"write a new story and add it"** rather than fixing
code.

## Repository layout

```
.
├── biblioteca.html   ← the entire application (HTML + CSS + JS in one file)
└── README.md         ← placeholder ("# Biblioteca")
```

There is **no build system, no dependencies, no package manager, no tests, and
no framework**. The whole app is one self-contained static `biblioteca.html`
file that runs by opening it in a browser. Do not introduce tooling, bundlers,
or npm unless the owner explicitly asks.

## How `biblioteca.html` is structured

The file is one document with three sections, in order:

1. **`<style>`** (top of `<head>`) — all CSS. Uses a dark, warm "library" theme
   driven by CSS custom properties in `:root` (`--bg`, `--accent`, `--card`,
   etc.). Mobile-first, designed to feel like a native iOS reading app
   (safe-area insets, sheet-style modals, backdrop blur).

2. **`<body>`** — three logical parts:
   - **The grid of cards** inside `<main class="main"> … <div class="books-grid">`.
     One `<div class="book-card" onclick="openReader('<id>')">` per story, each
     with a cover gradient + emoji, category chip, title, excerpt, and date.
   - **The "Pedir historia" modal** (`#addModal`) and the **reader overlay**
     (`#readerOverlay`).
   - **Hidden story bodies**: one `<div id="story-<id>" style="display:none">`
     per story, containing the full article markup.

3. **`<script>`** (bottom of `<body>`) — ~15 lines of plain vanilla JS, no
   libraries:
   - `openReader(id)` copies the `innerHTML` of `#story-<id>` into the reader
     overlay and opens it.
   - `closeReader()`, `openAddModal()`, `closeAddModal()` toggle visibility.

### The two-part story model (important)

**Every story exists in two places that must stay in sync by a shared `id`:**

| Part | Where | Purpose |
|------|-------|---------|
| **Card** | inside `.books-grid` | grid tile, `onclick="openReader('<id>')"` |
| **Story body** | `<div id="story-<id>">` near the end of `<body>` | full article, hidden until opened |

`openReader('twitter')` looks up `#story-twitter`. If a card's `id` has no
matching `story-<id>` div (or vice-versa), the story silently fails to open.
Always add/rename/remove **both** together.

The reader header title is read from the `.reader-title` element inside the
story body, so each story body must contain exactly one `.reader-title`.

## How to add a new story (the main task)

This is the most common request. Follow the existing pattern exactly.

1. **Pick a short, lowercase, alphanumeric `id`** (e.g. `jazz`, `volcanes`).
   It must be unique across both the card and the story body.

2. **Add the card** at the **top** of `.books-grid` (newest stories appear
   first — this matches the git history, where new stories are prepended).
   Copy an existing `.book-card` block and update:
   - `onclick="openReader('<id>')"`
   - the cover gradient (`style="background:linear-gradient(...)"`) and emoji
   - `.card-category` chip (emoji + label — see categories below)
   - `.card-title`, `.card-excerpt` (a 2–3 sentence hook)
   - `.card-date` (Spanish format, e.g. `4 de mayo, 2026`)

3. **Add the story body** as a new `<div id="story-<id>" style="display:none">`
   alongside the other story divs near the end of `<body>`. Mirror the existing
   structure:
   ```html
   <div id="story-<id>" style="display:none">
   <div class="reader-cat">⚡ Tecnología</div>
   <h1 class="reader-title">Título de la historia</h1>
   <div class="reader-date">4 de mayo, 2026</div>
   <span class="reader-emoji">🔴</span>
   <div class="reader-body">
     <h2>Subtítulo de sección</h2>
     <p>Párrafo…</p>
     <!-- …several <h2> sections with multiple <p> each… -->
   </div>
   </div>
   ```

4. **Update the story count** in `<div class="stats-bar">N historias</div>`.

5. **Verify** by opening `biblioteca.html` in a browser: the new card shows in
   the grid, and clicking it opens the full story in the reader.

### Writing-style conventions for the stories

- **Language: Spanish** (Rioplatense voice is welcome — the modal uses
  "Agregá", "Decime"; keep it natural).
- **Long-form and narrative**: each story is a multi-section essay with several
  `<h2>` headings and many `<p>` paragraphs. Match the depth and tone of the
  existing pieces (e.g. `#story-googleplus`, `#story-enron`) — engaging,
  well-researched, story-driven non-fiction.
- Use only `<h2>` and `<p>` inside `.reader-body` (that's the established
  pattern). The opening `<h1 class="reader-title">` is the title.

### Categories currently in use

`⚡ Tecnología`, `💼 Negocios`, `🌍 Historia` / `🏛️ Historia`, `🍽️ Cultura`,
`🎸 Música`, `🏙️ Civilización`. Reuse an existing label when it fits; pick a
fitting emoji + word if a genuinely new category is needed.

## Conventions & guardrails

- **Keep it a single self-contained file.** Do not split CSS/JS into separate
  files, add a framework, or pull in external dependencies/CDNs.
- **Vanilla JS only.** No build step, no transpilation.
- **Style via the existing CSS variables and classes** — don't introduce a new
  design system; reuse `.book-card`, `.reader-*`, etc.
- **Spanish UI and content** throughout. Dates in Spanish long form.
- Keep cards and story bodies in sync by `id` (see the two-part model above).

## Git workflow

- Active development branch for this task: `claude/claude-md-docs-ZV2sP`.
- Commit messages follow the existing history's convention: short, in Spanish,
  describing the content added — e.g. `Agrega Twitter y PayPal Mafia`,
  `Agrega historia: La historia de la música`.
- Commit and push when changes are complete. Do **not** open a pull request
  unless explicitly asked.

## Quick reference

- **Run it:** open `biblioteca.html` in any modern browser (no server needed).
- **Add a story:** new `.book-card` at top of `.books-grid` + new
  `#story-<id>` div + bump the `stats-bar` count.
- **Story won't open?** Check the card's `openReader('<id>')` matches an
  existing `#story-<id>`.
