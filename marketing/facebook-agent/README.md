# GetGo PH — Facebook Marketing Agent

A Claude-powered AI agent that generates Facebook marketing content, ad copy, video scripts, and campaign plans for GetGo PH.

## Quick Start

### 1. Install dependencies
```bash
cd marketing/facebook-agent
npm install
```

### 2. Configure API key
```bash
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
# Get your key at: https://console.anthropic.com
```

### 3. Run the agent

**Interactive mode (recommended for beginners):**
```bash
npm run interactive
# or
node agent.js
```

**Quick task commands:**
```bash
# Generate 7 days of Facebook posts
npm run generate-posts

# Generate ad copy for all phases
npm run generate-ads

# Generate a 60-second video script
npm run generate-script

# Plan the full 4-week campaign
npm run plan-week
```

## Interactive Mode Commands

Once in interactive mode:
- `posts` → Generate 3 Facebook posts (shipper + broker + engagement)
- `ads` → Generate Phase 1 awareness ad copy
- `script` → Generate a 30-second Reels script
- `week 1` through `week 4` → Plan a campaign week
- Any natural language task → The agent handles it!
- `exit` → Quit

## Example Prompts

```
"Generate 5 Facebook posts for brokers about earning potential"

"Write a Facebook ad for retargeting people who visited karga.ph but didn't download the app"

"Create a 15-second Reels hook for shippers using a curiosity angle"

"Plan week 2 content focused on real-time tracking feature"

"Generate 3 caption variations for a photo of a truck being loaded with goods"

"Write a Facebook Live script for a Q&A session about GetGo PH"
```

## Output Files

All generated content is saved to `./output/` organized by type:
- `output/posts/` — Facebook organic post copy
- `output/ads/` — Ad copy variants
- `output/scripts/` — Video scripts
- `output/plans/` — Campaign week plans
- `output/captions/` — Caption variations

## Agent Capabilities

### Tools Available

| Tool | Description |
|---|---|
| `generate_facebook_posts` | Batch post generation (1–7 posts) per content pillar |
| `generate_ad_copy` | A/B test ad copy variants with all Facebook ad fields |
| `generate_video_script` | Full video scripts with timecodes + storyboard |
| `plan_campaign_week` | 7-day content calendar with organic + paid plan |
| `generate_caption_variations` | Short/medium/long caption variants |
| `save_output` | Auto-save all content to files |

### Brand Knowledge Built-In
The agent knows:
- GetGo PH app features and value proposition
- Filipino target audience psychology
- Taglish copywriting style
- ₱150/day budget constraints
- All 3 campaign phases and objectives
- Hashtag strategy
- Facebook ad specs

## Customization

Edit `agent.js` → `CONFIG` to change:
```js
const CONFIG = {
  appName: "GetGo PH",
  appUrl: "https://karga.ph",
  facebookPage: "@GetGoPH",
  tagline: "Karga. Trabaho. Tagumpay.",
  dailyBudget: "150",
  model: "claude-sonnet-4-6",  // upgrade to claude-opus-4-6 for best quality
};
```
