# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## ⛔ STOP! READ BEFORE ANY WORK ⛔

**Before writing/changing code, MUST:**

1. **Create beads task** (if it doesn't exist):
   ```bash
   bd create "Task description" --parent <epic-id>
   ```

2. **Switch to feature branch**:
   ```bash
   git checkout -b feature/<issue-id>
   ```

3. **Or run through loop** (recommended):
   ```bash
   node loop.cjs <issue-id>
   ```

**Without this — DO NOT WRITE CODE!**

Interactive mode (without loop) is allowed ONLY for:
- Exploring the codebase
- Answering questions
- Minor fixes WITH EXPLICIT user permission

---

## Project Overview

**subreddit-insights** is a CLI tool for analyzing Reddit subreddits to extract product insights using AI. It fetches posts and comments from any subreddit, sends them to GPT-4o for structured analysis, and outputs categorized insights with direct quotes as evidence.

**Use cases:**
- Validating startup ideas
- Writing landing page copy using audience language
- Preparing for user interviews
- Competitive research

## Project Structure

```
src/
  cli.ts         # CLI entry point (Commander.js)
  reddit.ts      # Reddit API client (public JSON API)
  subreddit.ts   # Subreddit data fetching
  llm.ts         # OpenAI integration for analysis
  insights.ts    # Insight extraction types/schemas
dist/            # Compiled output (tsc)
reports/         # Generated markdown reports
```

## Git Flow

```
feature/<issue-id> (development branch)
  ↓ test locally
  ↓ all tests pass?
  ↓ PR to master
master (production)
  ↓ npm publish
  ↓
npm registry
```

**Rules:**
- Development in feature branches from `master`
- PRs merged to `master` after review
- Commit to `master` = ready for npm publish

**Rules for Claude:**
- **FORBIDDEN** to commit directly to `master` without explicit user permission
- Always work in a separate feature branch (`feature/<issue-id>`)
- Use beads for task tracking (`bd list`, `bd show`, `bd close`)
- Before any changes to `master` — ask user permission
- For features and changes — run through `node loop.cjs <issue-id>`
- Interactive mode (without loop) — only for exploration, questions, and minor fixes with permission

## Development Process (TDD)

1. **Write test** — describe expected behavior
2. **Run test** — verify it fails (red)
3. **Write code** — minimum to make test pass (green)
4. **Refactor** — improve code, tests must still pass

## Testing Strategy

```
Unit tests (vitest)
npm test
~2-3 sec
```

| Type | What it checks | When to run |
|------|----------------|-------------|
| Unit (`npm test`) | Business logic, API responses, LLM prompts | During development, before commit |

**Note:** This project currently has only unit tests. E2E tests are not applicable for a simple CLI tool.

## Claude Subagents

| Agent | When to use |
|-------|-------------|
| `subagent_type=Explore` | Exploring codebase, finding files |
| Code agent | Writing new code, features |
| Review agent | Code review before merging to master |

## Autonomous Loop (loop.cjs)

Script `loop.cjs` runs Claude in autonomous mode for working on beads tasks.

### Usage

```bash
# Work on specific task
node loop.cjs <issue-id>

# Work on all open tasks
node loop.cjs all

# Interactive mode (full Claude UI)
node loop.cjs <issue-id> -i
```

### Workflow

1. **Branch creation**: At start, creates `feature/<issue-id>` from `master`
2. **Task work**: Claude iteratively works on task (up to 30 iterations)
3. **Testing**: Before closing, runs `npm test`
4. **Closing**: After tests pass, closes task via `bd close <id>`
5. **Documentation**: Claude creates `docs/<issue-id>.md` describing the feature/fix
6. **Pull Request**: Automatically creates PR to `master`

### Beads Commands

```bash
bd list                    # List open tasks
bd list --all              # All tasks including closed
bd show <id>               # Task details
bd close <id> -r "reason"  # Close task with comment
```

## Commands

### Development
```bash
npm install              # Install dependencies
npm run dev              # Run CLI in dev mode (tsx)
npm run build            # Compile TypeScript
npm start                # Run compiled CLI
```

### Testing
```bash
npm test                 # Run all unit tests
npm run test:watch       # Watch mode for TDD
```

### Linting
```bash
npm run lint             # ESLint
npm run typecheck        # TypeScript type checking
```

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript (ES modules)
- **CLI**: Commander.js
- **AI**: OpenAI API (gpt-4o)
- **Testing**: Vitest
- **Linting**: ESLint + TypeScript

## Architecture

### CLI Flow
1. User runs `subreddit-insights r/SomeSubreddit`
2. `cli.ts` parses arguments with Commander
3. `subreddit.ts` fetches posts from Reddit public JSON API
4. `llm.ts` sends content to OpenAI for analysis
5. `insights.ts` structures the response
6. Result saved to `reports/` as markdown

### No Auth Required
Reddit's public JSON API is used — no tokens needed. Just append `.json` to any subreddit URL.

### OpenAI Integration
Uses GPT-4o for structured analysis. Requires `OPENAI_API_KEY` environment variable.

## Environment Variables

```bash
OPENAI_API_KEY=sk-...    # Required: OpenAI API key
```

## Path Aliases

Uses `@/*` → `src/*` for imports (configured in tsconfig.json).

## Publishing to npm

```bash
npm run build            # Compile TypeScript
npm publish              # Publish to npm registry
```

The package is published as `subreddit-insights` and can be installed globally:
```bash
npm install -g subreddit-insights
```

## Known Issues & Gotchas

### Reddit Rate Limiting
Reddit may rate-limit requests. The tool handles this gracefully but large subreddits may take longer.

### OpenAI Cost
Each analysis costs ~$0.02-0.10 depending on subreddit size. The tool reports token usage.

---

## Sections Not Applicable to This Project

The following sections from the original claude.md are not applicable:

- **Database/Migrations**: This is a stateless CLI tool with no database
- **Telegram Bot/TMA**: No Telegram integration
- **E2E Tests**: Simple CLI doesn't need browser-based E2E tests
- **Docker/docker-compose**: Not used in this project
- **Timeweb Deployment**: Published to npm instead
- **Monorepo Structure**: Single package project
- **Scheduler/Cron**: No background jobs
