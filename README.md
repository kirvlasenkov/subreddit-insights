# subreddit-insights

**Stop scrolling Reddit for hours. Get product insights in 2 minutes.**

You know the drill: you have a product idea, so you dive into Reddit to understand your audience. Three hours later, you've read 200 posts and still can't articulate what people actually want.

This CLI tool does that research for you — and gives you structured, actionable insights.

## What you get

```
$ subreddit-insights r/SideProject
```

↓ 2 minutes later ↓

```markdown
## Pain Points

### High friction in user onboarding (~18 mentions)
> "44 seconds and multiple steps to watch a 6 second video?"
> "I gave up after the third popup asking me to sign up"

### Pricing confusion (~12 mentions)
> "Is it free? Freemium? I couldn't figure out what I'd pay"

## Desires

### One-click solutions (~15 mentions)
> "Just let me paste a link and get the result"

### Transparent pricing upfront (~9 mentions)
> "Show me the price before I waste time signing up"

## Audience Language

They say "side project" not "startup"
They say "ship it" not "launch"
They say "ramen profitable" not "break-even"

## Product Hypotheses

### Hypothesis: Zero-friction access
Users who want quick results would pay for a tool that
requires no signup — because current alternatives cause
abandonment at the registration wall.

**Evidence:** 18 mentions of friction, 15 mentions of one-click preference
**Confidence:** High
```

## Why this matters

| Before | After |
|--------|-------|
| 3+ hours scrolling Reddit | 2 minutes |
| "I think users want..." | "18 people said they want..." |
| Guessing audience language | Copy-paste their exact words |
| Going into interviews blind | Walking in with hypotheses to validate |

**This doesn't replace user interviews.** It helps you walk into them with better questions and hypotheses worth testing.

## Quick start

```bash
# Install
npm install -g subreddit-insights

# Set your OpenAI API key
export OPENAI_API_KEY=sk-...

# Run
subreddit-insights r/YourTargetSubreddit
```

That's it. Report saves to `./reports/` as markdown.

## Use cases

**Validating a startup idea?**
```bash
subreddit-insights r/SaaS --period 90d --limit 200
```
Find out what 200 founders complained about in the last 3 months.

**Writing landing page copy?**
```bash
subreddit-insights r/productivity
```
Steal the exact phrases your audience uses to describe their problems.

**Preparing for user interviews?**
```bash
subreddit-insights r/remotework
```
Go in with "I saw people mention X a lot — tell me more" instead of "so... what problems do you have?"

**Competitive research?**
```bash
subreddit-insights r/Notion
```
See what users hate about the incumbent. Build what they're missing.

## Options

```
-p, --period    7d | 30d | 90d | 180d (default: 30d)
-l, --limit     1-500 posts to analyze (default: 50)
-o, --output    custom output path
```

## How it works

1. Fetches top posts + comments from the subreddit (public Reddit JSON API)
2. Sends to GPT-4o for structured analysis
3. Outputs categorized insights with direct quotes as evidence

No Reddit account needed. No auth tokens. Just run it.

## Requirements

- Node.js 18+
- OpenAI API key (~$0.02-0.10 per analysis depending on subreddit size)

## License

MIT — do whatever you want with it.

---

**Built for people who'd rather build products than do research busywork.**

[Report issues](https://github.com/kirvlasenkov/subreddit-insights/issues) · [GitHub](https://github.com/kirvlasenkov/subreddit-insights)
