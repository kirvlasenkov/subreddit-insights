# subreddit-insights

Turn any subreddit into product research in 2 minutes.

## What it does

Analyzes Reddit discussions and extracts:
- **Pain points** — what frustrates users
- **Desires** — what they wish existed
- **Product hypotheses** — testable ideas with evidence
- **Audience language** — how they talk, what terms they use

## Installation

```bash
npm install -g subreddit-insights
```

## Setup

Get an [OpenAI API key](https://platform.openai.com/api-keys) and set it:

```bash
export OPENAI_API_KEY=sk-...
```

## Usage

```bash
subreddit-insights r/SideProject
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

```
-p, --period    7d | 30d | 90d | 180d (default: 30d)
-l, --limit     1-500 posts (default: 50)
-o, --output    custom output path
```

## Examples

```bash
# Last 7 days, up to 100 posts
subreddit-insights r/productivity --period 7d --limit 100

# Save to custom file
subreddit-insights r/remotework -o report.md
```

## License

MIT
