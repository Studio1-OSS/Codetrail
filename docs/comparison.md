# How Codetrail compares

[← Back to the README](../README.md)

Codetrail does the jobs of four tools people use to understand a codebase. GitDiagram draws a repo's architecture, DeepWiki writes a wiki and answers questions, CodeTour plays hand-written walkthroughs in VS Code, and CodeViz draws architecture and call graphs in VS Code.

| | Codetrail | GitDiagram | DeepWiki | CodeTour | CodeViz |
|---|---|---|---|---|---|
| What the model sees | Every file, one prompt | Tree, README, source excerpts | An index of the repo, searched per page and question | No model | AI agents search the code |
| Architecture diagram | Layers, colours, routed links; open a module into its files | Layers, colours, links | Mermaid diagrams in wiki pages | — | C4 and UML, editable |
| Written docs for every module | Yes, references checked, a diagram per page | A short overview | Yes, a wiki | — | Diagram-led docs |
| Ask questions about the code | Yes, with follow-ups, Thorough and Research modes | — | Yes, with Deep Research | — | Yes |
| Step-by-step walkthroughs with file + line | Generated or written by you, every line checked | — | Codemaps (code in execution order) | Hand-written | Walkthroughs in search results |
| Tour markers in the code, progress | Yes | — | — | Yes | — |
| Pull requests | A tour of the change, with review notes | — | — | Tours pinned to a branch or commit | PR diagrams (paid plan) |
| Checked against the code | Every quoted line, and again on each newer commit | Every linked path | — | Drift warnings in CI | — |
| Export the diagram | Mermaid (with GitHub links), SVG, PNG, draw.io | Mermaid, PNG | — | `.tour` files | Mermaid, draw.io, PNG, SVG |
| A live diagram image for a README | SVG or PNG, with a badge; also the link preview | Yes, with a badge | A badge | — | Embeds (Teams plan) |
| Markdown page for AI tools | `/owner/repo.md`, `llms.txt` | `/owner/repo.md`, `llms.txt` | — | — | — |
| Read only some folders | Choose folders or globs | — | A page list in `.devin/wiki.json` | — | — |
| What it costs you | Your Nebius key; the price shown before and after every call | Free quota, cost after a run | Free for public repos | Free | Free tier, Pro $19/month |
| Works from a URL in the browser | Yes | Yes | Yes | VS Code (desktop and web) | VS Code |
| MCP server for coding agents | Yes, also a Claude Code plugin | Yes | Yes | — | — |
| Open source | Yes, MIT | Yes, MIT | No | Yes, MIT | No |
| Private code | Private repos with a GitHub token, and local folders; the code goes to DeepSeek on your Nebius key | With a GitHub token | With a Devin account | Local files | Local folders; code goes to cloud models |
| Function-level call graph | JS/TS, Python, Go, from the code | — | — | — | Yes, from the language server |
| Explainer video of a repo | — | Yes | — | — | — |

Checked in October 2026 against each tool's own docs and code. Where the others are ahead: CodeViz draws editable C4 and UML diagrams and covers more languages in its call graph; GitDiagram makes narrated explainer videos; DeepWiki already has wikis for many public repos, so there's nothing to wait for; CodeTour plays tours inside VS Code itself.
