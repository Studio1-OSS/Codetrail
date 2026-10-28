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

Press **Read the repo**. DeepSeek V4.1 Flash 1017 reads every file in one call, and you watch the map build as it writes: modules appear, then the links between them, then the steps of the first tour. A small repo takes 10–20 seconds.

## 4. The map

The middle of the screen is the map. It has two views:

- **Modules**: the parts of the codebase and how they connect. A **solid** line is confirmed by real imports in the code; a **dashed** one was inferred by the model.
- **Files**: the real import graph, file by file, grouped by module.

Drag nodes, zoom with the buttons or your trackpad, and click a node to see what it does and its key files. During a tour, the current step's node is highlighted and the route between steps is drawn. **Copy Mermaid** puts the module map in your clipboard for a README; **Download SVG** saves the view as an image.

## 5. Tours

A tour walks through the code in the order it runs, one step at a time. The left sidebar lists the suggested tours; one of them is traced in the first read.

- Each step shows its explanation and opens the code at the exact lines.
- **Lines checked** means the line the model quoted was found in that range. **Range corrected** means the model's line numbers were off and Codetrail moved the range to the quoted line.
- **Play** advances on its own; **←** and **→** step by hand.
- Under each step:
  - **Link to this step** copies a link to that exact step.
  - **Read as text** (or `T`) shows the whole tour with its code, copyable as Markdown.
  - **Trail card** is a share image.
  - **Copy as sequence diagram** copies the tour as a Mermaid diagram.
  - **Export for VS Code CodeTour** downloads a `.tour` file.
- If the repo has its own CodeTour files (`.tours/*.tour`), they're listed under **Written by the maintainers**, checked the same way.

## 6. Ask questions

Type a question in **Ask how something works**, at the bottom of the sidebar.

- **Already answered · free**: while you type, anything stored that answers the question (a tour, an answer, a docs page or a conversation) shows up. Click it to open it at no cost.
- **The kind of answer** is picked from your wording, and you can switch it:
  - **Answer**: a short structured answer with tables, file lists, call sequences and code references, each checked against the code.
  - **Tour**: a step-by-step walk. "Walk me through…" and "what happens when…" pick this.
  - **Thorough**: a slower, more thorough answer that traces across every file involved. It costs more.
- **The price** for that kind of question is shown under the box before you ask: what it costs if the repo is in the cache, and the most it can cost.

**Follow-ups.** Under every answer and tour there are suggested follow-up questions and an **Ask a follow-up** box. A follow-up gets a short recap of the conversation, so the answer builds on what was already said. The conversation's turns appear as numbered pills, so you can go back to any of them. Conversations are listed in the sidebar and have their own link.

## 7. Docs

**Write the docs** in the sidebar writes one page for each module in a single call: an overview, how it works, key files and where to look, with every reference checked. After that, **Read the docs** is free. Click a module on the map to open its page. Pages export as one Markdown file.

## 8. Files and search

Press `/` (or click **browse & search files**) to browse every text file in the commit, including those not sent to the model, and to search their contents. Search runs on Codetrail's own copy, so it's instant and doesn't use GitHub. GitHub file links (`/owner/repo/blob/<ref>/<path>#L10`) open the file at that line.

## 9. Pull requests

Open a PR with its link, `owner/repo#123`, or the **Tour a PR** box in the sidebar. The repo needs to be read once first, and the PR page offers that if it hasn't been.

- **Before you pay**, the PR page shows the title, author, size and state, how much will be sent (the patches and the PR's version of each changed file), and the estimate. Because DeepSeek already has the repo, only the change is new input.
- **Tour this PR** walks through the change in the order it runs:
  - Changed lines are marked in the code: green for added, a red rule where lines were removed.
  - **diff** shows the patch.
  - Modules and files the PR touches get a **±** badge on the map.
- **For the reviewer** lists risks, missing tests, questions and small cleanups. Each note opens the line it's about; a note whose line couldn't be found says so.
- Tours are saved per head commit, so after a new push the PR gets a new tour and the old one stays.

## 10. Your own folders

Useful for code that isn't on GitHub yet, a branch you haven't pushed, or a client project you can't share. With `LOCAL_ROOT` set (or a `/repos` mount in Docker), the home page lists **Your folders**. Each opens like a repo, read from disk with the same filters and secret scan, uncommitted changes included. After you edit files, the next visit offers a fresh read; an unchanged folder replays free. Folders are never available on an instance with sign-in turned on.

## 11. Costs and the cache

- **The cost pill** in the header shows what this repo has cost so far and what cached input saved. Click it for a receipt of every call: tokens sent, how many came from the cache, tokens written, time and cost.
- **The cache status** (the dot in the header and under the Ask box):
  - **in cache**: a recent call reused the repo, so the next one very likely will, at about 2% of the input price.
  - **cache not hit yet**: recent calls didn't reuse it. Token Factory's cache is best-effort: a call can land on a server that doesn't hold the repo yet.
  - **cache cold**: nothing recent.
- **The data page** (`/data`, linked as **Data** in the header) shows every repo read on your instance with its spend and savings, updated on each visit.

## 12. Sharing

Everything has a link: a tour step (`?tour=…&step=…`), an answer (`?answer=…`), a conversation (`?thread=…&turn=…`) and a PR (`/owner/repo/pull/123`). Links show a trail card as their preview image. Anyone opening a link on the same instance replays it free.

## 13. Coding agents (MCP)

Codetrail is also an MCP server, so Claude Code, Cursor and other agents can use it as a tool. It helps when an agent works in code it doesn't know: instead of searching file by file, it gets the module map, a tour or an answer with exact `file:line` references, and it can ask follow-ups in the same thread. For reviews, `codetrail_pr` gives it the change in the order it runs, with notes. Local folders work too: use `_local/<folder>` as the repo. It offers four tools:

| Tool | What the agent gets |
| --- | --- |
| `codetrail_map(repo)` | The modules with their key files, how they connect, and suggested questions |
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
| `Esc` | Close a panel or dialog |

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
