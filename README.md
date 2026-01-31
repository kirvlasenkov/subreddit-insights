# subreddit-insights

**Stop scrolling Reddit for hours. Get product insights in 2 minutes.**

You know the drill: you have a product idea, so you dive into Reddit to understand your audience. Three hours later, you've read 200 posts and still can't articulate what people actually want.

This CLI tool does that research for you — and gives you structured, actionable insights.

## What you get

```
$ subreddit-insights r/techsales
```

↓ 2 minutes later ↓

```markdown
## Pain Points

### CRM busywork killing selling time (~24 mentions)
> "I spend 2 hours a day just updating Salesforce instead of actually selling"
> "My manager cares more about CRM hygiene than closed deals"

### Cold outreach becoming ineffective (~19 mentions)
> "Response rates dropped from 5% to under 1% this year"
> "Everyone's inbox is flooded, nobody reads cold emails anymore"

### Unrealistic quotas in down market (~15 mentions)
> "Leadership won't adjust targets even though the market completely changed"

## Desires

### Better prospect research tools (~21 mentions)
> "I'd pay good money for something that tells me what to say BEFORE the call"
> "Wish I could know their tech stack and recent news without 30 min of googling"

### Automation that doesn't feel robotic (~12 mentions)
> "I want to automate follow-ups but not sound like a bot"

## Audience Language

They say "pipeline" not "sales funnel"
They say "disco call" not "discovery meeting"
They say "hitting quota" not "reaching targets"
They say "tech stack" not "software tools"

## Product Hypotheses

### Hypothesis: Pre-call intelligence tool
SDRs who struggle with cold outreach would pay for automated
prospect research — because manual research takes 30 min per lead
and most skip it entirely.

**Evidence:** 24 mentions of time waste, 21 mentions wanting better research
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
