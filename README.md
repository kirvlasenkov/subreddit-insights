# subreddit-insights

Turn any subreddit into product research in 2 minutes.

## What it does

Analyzes Reddit discussions and extracts:
- **Pain points** — what frustrates users
- **Desires** — what they wish existed
- **Product hypotheses** — testable ideas with evidence
- **Audience language** — how they talk, what terms they use

## Quick start

```bash
npx subreddit-insights r/SideProject
```

You'll need an [OpenAI API key](https://platform.openai.com/api-keys):

```bash
export OPENAI_API_KEY=sk-...
npx subreddit-insights r/BeginnersRunning
```

## Example output

```
## Pain Points

### High friction / too many steps (~18 mentions)
> "44 seconds and multiple steps to watch a 6 second video?"

### UI blocking content on mobile (~7 mentions)
> "Your oldman face blocking UI is very annoying on mobile."

## Product Hypotheses

### Users who want zero-friction access would benefit from
### a redirect-based viewer because copy-paste flows cause abandonment.
Confidence: high
```

## Options

```bash
subreddit-insights <subreddit> [options]

-p, --period    7d | 30d | 90d | 180d (default: 30d)
-l, --limit     1-500 posts (default: 50)
-o, --output    custom output path
```

## Install globally

```bash
npm install -g subreddit-insights
subreddit-insights productivity --period 7d --limit 100
```

## License

MIT
