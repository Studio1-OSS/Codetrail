# Codetrail user guide

How to run Codetrail on your machine and use every part of it. For what it is and how it works, see the [README](../README.md).

- [1. Set it up](#1-set-it-up)
- [2. Open a repo](#2-open-a-repo)
- [3. Read it](#3-read-it)
- [4. The map](#4-the-map)
- [5. Tours](#5-tours)
- [6. Ask questions](#6-ask-questions)
- [7. Docs](#7-docs)
- [8. Files and search](#8-files-and-search)
- [9. Pull requests](#9-pull-requests)
- [10. Your own folders](#10-your-own-folders)
- [11. Costs and the cache](#11-costs-and-the-cache)
- [12. Sharing](#12-sharing)
- [13. Coding agents (MCP)](#13-coding-agents-mcp)
- [14. Keyboard shortcuts](#14-keyboard-shortcuts)
- [15. Troubleshooting](#15-troubleshooting)

## 1. Set it up

You need a **Nebius Token Factory API key**: sign in at [tokenfactory.nebius.com](https://dub.sh/aistudio) and create one. Codetrail uses it for every model call. Nothing else is required.

**With Docker** (nothing else to install):

```bash
git clone https://github.com/Studio1-OSS/Codetrail.git
cd Codetrail
docker build -t codetrail .
docker run --name codetrail -p 3000:3000 \
  -e NEBIUS_API_KEY=your-key \
  -v codetrail-data:/data \
  -v ~/code:/repos:ro \
  codetrail
```

**From source** (Node.js 22.13+ and pnpm):

```bash
git clone https://github.com/Studio1-OSS/Codetrail.git
cd Codetrail
pnpm install
cp .env.example .env      # put your key in NEBIUS_API_KEY
pnpm dev
```

Open **http://localhost:3000**. There's no sign-up and no limit when you run it yourself.

Optional settings (in `.env`, or as `-e` flags with Docker):

| Setting | What it does |
| --- | --- |
| `GITHUB_TOKEN` | Raises GitHub's limit from 60 to 5,000 requests an hour, and opens private repos the token can read. A fine-grained token with "Contents: read" is enough. |
| `LOCAL_ROOT` | A folder of your projects (from source). Each folder inside it can be opened in Codetrail. Docker uses the `/repos` mount instead. |
| `MAX_REPO_TOKENS` | The most of a repo sent in one read (default 700,000 tokens). |
| `DAILY_BUDGET_USD` | Stops new model calls for the day after this much spend. Empty means no cap. |

The rest are listed in [`.env.example`](../.env.example).

## 2. Open a repo

Paste any of these into the box on the home page:

- `owner/repo`, or a GitHub link: `https://github.com/owner/repo`
- a branch, tag or commit: `…/tree/v2`, `…/commit/<sha>`, `owner/repo@v2`
- a file link, which opens that file: `…/blob/main/src/app.ts#L10`
- a pull request: `…/pull/123`, or `owner/repo#123`
- a git remote: `git@github.com:owner/repo.git`

You can also swap the domain: `github.com/owner/repo` becomes `localhost:3000/owner/repo`.

Repos someone already read on your instance open straight away, and everything stored with them is free to replay. If the branch has new commits since that read, a bar at the top says how many, with a link to read the latest.

## 3. Read it

A repo you haven't read yet opens on the **Ready to read** screen. Nothing has been spent yet. It shows:

- how much of the model's 1M-token context the repo fills;
- every file that will be sent (click **See every file that will be read**), and what's skipped and why: lockfiles, binaries, generated files, anything that looks like a credential;
- the estimated cost of the first read, and of each question after it.

**Choose folders** reads only part of the repo, which helps with a big monorepo. Untick folders to leave them out, or type the only ones to read (folders or globs such as `packages/*/src`). The estimate follows as you choose; **Apply** opens that read at `/owner/repo?only=src&skip=src/legacy`. A read of some folders is stored apart from the full read, so the same commit can be read both ways; the header shows which folders a read covers, and clicking that label goes back to the whole repo.

Press **Read the repo**. DeepSeek V4.1 Flash 1017 reads every file in one call, and you watch the map build as it writes: modules appear, then the links between them, then the steps of the first tour. A small repo takes 10–20 seconds.

## 4. The map

The middle of the screen is the map. It has four views:

- **Architecture** (the default): the modules as boxes, top to bottom in the order calls flow, grouped into layers such as "Entry points", "Routing" or "Storage", one colour per layer. Each box shows the folder most of its files live in. A **solid** arrow is confirmed by real imports in the code; a **dashed** one was inferred by the model. Hover a box to light up its links and read what each one does.
- **Modules**: the same map as a graph you can drag around.
- **Files**: the real import graph, file by file, grouped by module.
- **Calls**: one file's functions, what each one calls and who calls them, worked out from the code (no model call). Type a file name to pick another, or press **calls** in the code panel's header. Click a function to open it. JavaScript and TypeScript are read with the TypeScript compiler, so imports and aliases resolve exactly; Python and Go are matched by name to the files they import. Calls into libraries are counted, not drawn.

**Double-click a module** on the Architecture view (or press **Show its files on the map** in its panel) to open it into its files, with the imports between them; links to other modules then start at the file that has the import. Double-click again, or **Close opened modules**, to fold it back. Opened modules stay in the address (`?open=core,router`).

**Click a link** to see the evidence for it: every import line in the code that backs it, each opening at that line, with the module's own files first. A dashed link says the model inferred it, with nothing in the imports behind it.

Click a box or node to see what the module does and its key files (and, once the docs are written, a link to its docs page). Zoom with the buttons or your trackpad. During a tour, the current step's box is highlighted, each visited box shows its step numbers, and the route between steps is drawn.

**Export** (under the map) has:

- **Copy as Mermaid**: the architecture as a Mermaid flowchart. Layers become subgraphs, colours are kept, and each box links to its folder on GitHub at the commit read.
- **Download SVG** and **Download PNG**: the whole diagram on the Architecture view (the visible part on the others), PNG at twice the size.
- **Download for draw.io**: an editable draw.io file with the layers, boxes and links as laid out.
- **Embed in a README**: copies Markdown for a live diagram image (`/owner/repo/diagram.svg`, light, or `?theme=dark`) and an "Explore with Codetrail" badge, both linking to the repo's page. The image updates when the repo is read again. It uses the instance's `SITE_URL`, so set that to a public address first.
- **Markdown for AI tools**: the repo's page at `/owner/repo.md` (see [Sharing](#12-sharing)).

Repos read before layers were added are grouped by kind (entry, core, data…) instead. **Group into layers** under the diagram names the layers with one small call that sends only the module list, not the repo (about $0.002), and saves them with the map.

**On a phone or tablet**, the step and its code come first and the map sits below them; **Bigger map** enlarges it. One finger scrolls the page, two fingers pan and zoom the map. The tours, Ask box, docs and PRs open from the panel button at the top left.

## 5. Tours

A tour walks through the code in the order it runs, one step at a time. The left sidebar lists the suggested tours; the first read already wrote one of them. Going back to a tour you left picks up at the step you were on.

- Each step shows its explanation and opens the code at the exact lines.
- **Lines checked** means the line the model quoted was found in that range. **Range corrected** means the model's line numbers were off and Codetrail moved the range to the quoted line.
- **Play** advances on its own; **←** and **→** step by hand.
- Under each step, **Link to this step** copies a link to that exact step, and **Share & export** opens:
  - **Read as text** (or `T`): the whole tour with its code, copyable as Markdown with the code included.
  - **Share card**: the image shown as the link preview.
  - **Copy as Mermaid sequence diagram**.
  - **Export for VS Code CodeTour**: a `.tour` file pinned to the commit, each step selecting its whole line range.
- If the repo has its own CodeTour files (`.tours/*.tour`), they're listed under **Written by the maintainers**, checked the same way.
- **Tour markers in the code**: wherever a stored tour stops in the file you're reading, a thin amber mark sits in the code panel's margin. Hover it for the tour and step; click it to open that tour there. The flag button in the code panel's header (with the count) hides or shows them.
- **Progress**: the sidebar shows how much of each tour you've seen ("4/9 seen", "✓ seen"), and the step bar marks the steps you've visited. It's kept in your browser only.
- **Next tour**: the last step offers the next suggested tour you haven't finished, free when it's already stored (with its price when it isn't).

**Write your own tour.** **+ Write a tour** in the sidebar, or **Edit a copy of this tour** in the Share & export menu, turns the step column into an editor. Give it a title, then add steps: open any file (press `/`) or step, and **Add the lines on screen as a step** takes what the code panel shows; adjust the lines, give the step a title and say what happens there. Steps can be moved, shown and deleted. **Save the tour** is free: each step is checked against the code (the file must be in the commit and the lines must exist), and the tour is listed under **Your tours**, with markers, progress, a link and CodeTour export like any other. On a hosted instance it needs sign-in.

## 6. Ask questions

Type a question in **Ask how something works**, at the bottom of the sidebar.

- **Already answered · free**: while you type, anything stored that answers the question (a tour, an answer, a docs page or a conversation) shows up. Click it to open it at no cost.
- **The kind of answer** is picked from your wording, and you can switch it:
  - **Answer**: a short structured answer with tables, file lists, call sequences and code references, each checked against the code.
  - **Tour**: a step-by-step walk. "Walk me through…" and "what happens when…" pick this.
  - **Thorough**: a slower, more thorough answer that traces across every file involved. It costs more.
- **The price** for that kind of question is shown under the box before you ask: what it costs if the repo is in the cache, and the most it can cost.
- **Stop** ends a question, tour, docs or read you no longer want. If no one else is waiting on the same call, DeepSeek stops writing; whatever it had already read may still be billed. A stopped or failed question goes back into the box, with **Start again** or **Retry** next to the message.

**Follow-ups.** Under every answer and repo tour there are suggested follow-up questions (each with its price) and an **Ask a follow-up** box. Pull-request tours don't take follow-ups: the model would see the repo before the change, not the PR's code. A follow-up gets a short recap of the conversation, so the answer builds on what was already said. The conversation's questions appear as numbered pills, so you can go back to any of them. Conversations are listed in the sidebar and have their own link.

## 7. Docs

**Write the docs** in the sidebar writes one page for each module in a single call: an overview, how it works, key files and where to look, with every reference checked. After that, **Read the docs** is free.

Each page has a diagram of its module: its files and the imports between them, and the modules it links to. Click a file to open it, or a neighbouring module to go to its page. Open a page from the module's panel on the map (**Open its docs page**) or from the list at the top.

Export **This page** or **All** as Markdown (each page's diagram included as Mermaid), or all of it as **.json**. Under each answer, **Copy as Markdown** and **Download .md** give the answer with its tables, file lists, call sequences (also as Mermaid) and the lines of every checked code reference, linked at the commit.

## 8. Files and search

Press `/` (or click **browse & search files**) to browse every text file in the commit, including those not sent to the model, and to search their contents. Search runs on Codetrail's own copy, so it's instant and doesn't use GitHub. GitHub file links (`/owner/repo/blob/<ref>/<path>#L10`) open the file at that line.

The code panel's header has **copy** (the highlighted lines, or the whole file), **path** (copies `path:start-end`), **calls** (this file on the Calls view) and the tour-marker toggle.

## 9. Pull requests

Open a PR with its link, `owner/repo#123`, or the **Tour a PR** box in the sidebar. The repo needs to be read once first, and the PR page offers that if it hasn't been.

- **Before you pay**, the PR page shows the title, author, size and state, how much will be sent (the patches and the PR's version of each changed file), and the estimate. Because DeepSeek already has the repo, only the change is new input.
- **Tour this PR** walks through the change in the order it runs:
  - Changed lines are marked in the code: green for added, a red rule where lines were removed.
  - **diff** shows the patch.
  - Modules and files the PR touches get a **±** badge on the map.
- **For the reviewer** lists risks, missing tests, questions and small cleanups. Each note opens the line it's about; a note whose line couldn't be found says so.
- Tours are saved per head commit, so after a new push the PR gets a new tour and the old one stays, listed under the PR in the sidebar as an earlier push.

## 10. Your own folders

Useful for code that isn't on GitHub yet, a branch you haven't pushed, or a client project you can't share. With `LOCAL_ROOT` set (or a `/repos` mount in Docker), the home page lists **Your folders**. Each opens like a repo, read from disk with the same filters and secret scan, uncommitted changes included. After you edit files, the next visit offers a fresh read; an unchanged folder replays free. Folders are never available on an instance with sign-in turned on.

## 11. Costs and the cache

- **The cost pill** in the header shows what this repo has cost so far and what cached input saved. Click it for a receipt of every call: tokens sent, how many came from the cache, tokens written, time and cost.
- **Next question ≈ $…** (in the header and under the Ask box) is what the next question costs. One price means a recent call reused the repo, so the next one very likely will, at about 2% of the input price. A range means it hasn't lately: Token Factory's cache is best-effort, so a call can land on a server that doesn't hold the repo yet and cost up to the higher figure. Hover it for which case you're in.
- **The data page** (`/data`, linked as **Data** in the header) shows every repo read on your instance with its spend and savings, updated on each visit.

## 12. Sharing

Everything has a link: a tour step (`?tour=…&step=…`), an answer (`?answer=…`), a conversation (`?thread=…&turn=…`), a docs page (`?doc=<module>`), an open file (`?file=<path>&line=<n>`) and a PR (`/owner/repo/pull/123`). The browser's Back and Forward move between what you opened. Links show a share card as their preview image. Anyone opening a link on the same instance replays it free.

**Browse** (in the site header) lists every repo read on your instance, with search and sorting by newest, stars or name.

**For AI tools and plain text**, every read repo has a Markdown page at `/owner/repo.md`: the summary, the architecture as Mermaid, the modules with their files, every tour step by step with links to the lines, the docs with their diagrams, and the answers. `/llms.txt` lists them all. Both are built from what's stored, so they're free. Private repos and local folders only get one on a self-hosted instance without sign-in.

## 13. Coding agents (MCP)

Codetrail is also an MCP server, so Claude Code, Cursor and other agents can use it as a tool. It helps when an agent works in code it doesn't know: instead of searching file by file, it gets the module map (with its layers and a Mermaid diagram), a tour or an answer with exact `file:line` references, and it can ask follow-ups in the same thread. For reviews, `codetrail_pr` gives it the change in the order it runs, with notes. Local folders work too: use `_local/<folder>` as the repo. It offers four tools:

| Tool | What the agent gets |
| --- | --- |
| `codetrail_map(repo)` | The modules with their layers and key files, how they connect, the architecture as Mermaid, and suggested questions |
| `codetrail_tour(repo, question)` | Ordered steps with `path:Lx-Ly` and a link to each |
| `codetrail_ask(repo, question, thread?, thorough?)` | A short answer with checked code references, follow-up questions and a thread id for follow-ups |
| `codetrail_pr(repo, number)` | A reviewer's tour of a pull request with review notes (`repo` can be the PR's URL) |

**Claude Code**, with the app running (Docker or `pnpm dev`):

```bash
claude mcp add --transport http codetrail http://localhost:3000/api/mcp
```

Or without the app running, straight from the source folder:

```bash
claude mcp add codetrail -- pnpm --dir /path/to/Codetrail -s mcp
```

**Cursor** (`.cursor/mcp.json`):

```json
{ "mcpServers": { "codetrail": { "url": "http://localhost:3000/api/mcp" } } }
```

Then ask your agent things like "use codetrail to map lukeed/polka" or "use codetrail_pr to review https://github.com/owner/repo/pull/42". Results are stored like everything else, so repeats are free, and the web app shows what the agent asked.

## 14. Keyboard shortcuts

| Key | Does |
| --- | --- |
| `←` `→` | Previous / next step |
| `Space` | Play or pause the tour |
| `/` | Browse and search files |
| `Tab`, then `Enter` | Move through the map's nodes and open one |
| `T` | Read the tour as text |
| `?` | Show the shortcuts |
| `Esc` | Close a dialog, the docs, or an open module or file |

Shortcuts don't fire while you type, while a dialog is open, or for a key the focused control uses itself (Space on a button).

## 15. Troubleshooting

| What you see | What to do |
| --- | --- |
| "No Nebius key is set" | Add `NEBIUS_API_KEY` to `.env` (or `-e` with Docker) and restart. |
| "GitHub's rate limit was reached" | Set `GITHUB_TOKEN`; without one, GitHub allows 60 requests an hour. |
| A private repo says it doesn't exist | The `GITHUB_TOKEN` can't read it. Give the token "Contents: read" on that repo. |
| A big repo shows files as "signatures" | It's over the size budget, so lower-priority files go in as their declarations only. The Ready screen lists which. |
| A question cost more than the "cached" estimate | The cache missed (see [Costs and the cache](#11-costs-and-the-cache)). The receipt shows the real cached share. |
| Your folders don't appear | Set `LOCAL_ROOT` (or mount `/repos` in Docker), and keep `AUTH_MODE=none`. Hidden folders are skipped. |
| Port 3000 is taken | `pnpm dev --port 3100`, or `-p 3100:3000` with Docker. |
