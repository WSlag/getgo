/**
 * GetGo PH — Facebook Marketing Agent
 * Claude-powered AI agent for generating Facebook marketing content,
 * ad copy, video scripts, and campaign plans.
 *
 * Usage:
 *   node agent.js                        → Interactive mode
 *   node agent.js --task generate-posts  → Generate 7 days of posts
 *   node agent.js --task generate-ads    → Generate ad copy variants
 *   node agent.js --task generate-script → Generate a video script
 *   node agent.js --task plan-week       → Plan the next campaign week
 */

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";

// Load .env if present
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valParts] = trimmed.split("=");
      if (key && valParts.length) {
        process.env[key.trim()] = valParts.join("=").trim();
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────
const CONFIG = {
  appName: process.env.APP_NAME || "GetGo PH",
  appUrl: process.env.APP_URL || "https://karga.ph",
  facebookPage: process.env.FACEBOOK_PAGE || "@GetGoPH",
  tagline: process.env.TAGLINE || "Karga. Trabaho. Tagumpay.",
  dailyBudget: process.env.DAILY_BUDGET_PHP || "150",
  outputDir: process.env.OUTPUT_DIR || path.join(__dirname, "output"),
  model: "claude-sonnet-4-6",
};

// Ensure output directory exists
if (!fs.existsSync(CONFIG.outputDir)) {
  fs.mkdirSync(CONFIG.outputDir, { recursive: true });
}

// ─────────────────────────────────────────────────────────────
// BRAND KNOWLEDGE BASE (injected as system context)
// ─────────────────────────────────────────────────────────────
const BRAND_CONTEXT = `
You are the official Facebook Marketing Agent for ${CONFIG.appName} — Philippines' premier freight marketplace app.

## About GetGo PH
- **App Name:** GetGo PH (also called Karga / Karga Connect)
- **Website:** ${CONFIG.appUrl}
- **App:** Available on App Store and Google Play
- **Facebook:** ${CONFIG.facebookPage}
- **Tagline:** "${CONFIG.tagline}"

## What GetGo PH Does
GetGo PH is a freight marketplace app that connects:
1. **Shippers / Cargo Owners** — businesses and individuals who need to transport cargo
2. **Freight Brokers** — agents who earn commissions by referring shippers
3. **Truck Drivers / Operators** — verified drivers who provide the trucks

Key features:
- One-tap truck booking (3 steps)
- Real-time GPS tracking of cargo
- Verified drivers and trucks
- Transparent pricing (no hidden fees)
- GCash payment integration
- Broker referral and commission system
- 24/7 availability

## Target Audience
- **Primary (Shippers):** Filipino SME owners, e-commerce sellers, OFW business owners, importers/exporters, warehouse managers aged 25–55
- **Secondary (Brokers):** Aspiring entrepreneurs, logistics coordinators, side-income seekers aged 22–50
- **Geography:** Philippines nationwide, heavy Facebook users
- **Language:** Mix of Filipino/Tagalog and English (Taglish is ideal)

## Campaign Context
- Daily Facebook Ads budget: ₱${CONFIG.dailyBudget}/day
- Running a 30-day campaign across 3 phases:
  - Phase 1 (Days 1–10): Awareness via video views
  - Phase 2 (Days 11–20): Consideration via app installs + lead gen
  - Phase 3 (Days 21–30): Conversion via retargeting
- Free organic posts daily to supplement paid ads

## Brand Voice
- **Tone:** Friendly, relatable, aspirational but grounded — like a trusted kababayan (fellow Filipino)
- **Style:** Conversational Tagalog/Taglish, with occasional English for emphasis
- **Energy:** Positive, empowering, solution-focused
- **Avoid:** Overly formal corporate tone, excessive jargon, complicated logistics terms

## Content Pillars
1. Educational (30%) — Tips, how-to, logistics knowledge
2. Social Proof (25%) — Testimonials, success stories, user wins
3. Product/Feature (20%) — App demos, feature highlights
4. Engagement (15%) — Polls, questions, contests, "tag a friend"
5. Brand Story (10%) — Mission, Filipino entrepreneurship, community

## Key Hashtags
Primary: #GetGoPH #KargaConnect #GetGoApp
Shipper: #BookTruckNaLang #LogisticsPH #FreightPH
Broker: #GetGoBroker #KumitaSaGetGo
General: #NegosyoPH #SMEPilipinas #OFWBusiness

## Important Notes
- Always include the app download CTA: "I-download ang GetGo PH — libre sa karga.ph"
- For broker content, always mention: "LIBRE ang mag-sign up"
- Posts should be readable without audio (assume people scroll with sound off)
- Use emojis strategically — 3-5 per post, relevant to content
- Facebook posts work best at 150–300 characters for organic reach
`;

// ─────────────────────────────────────────────────────────────
// TOOLS AVAILABLE TO THE AGENT
// ─────────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: "generate_facebook_posts",
    description:
      "Generate a batch of Facebook posts for GetGo PH. Produces organic post copy in Filipino/Taglish with emojis, hashtags, and CTAs for a specified content type and audience.",
    input_schema: {
      type: "object",
      properties: {
        content_type: {
          type: "string",
          enum: [
            "educational",
            "social_proof",
            "product_feature",
            "engagement",
            "brand_story",
          ],
          description: "The content pillar type for the posts",
        },
        audience: {
          type: "string",
          enum: ["shippers", "brokers", "both"],
          description: "Target audience for the posts",
        },
        count: {
          type: "number",
          description: "Number of posts to generate (1–7)",
          minimum: 1,
          maximum: 7,
        },
        theme: {
          type: "string",
          description:
            "Optional specific theme or topic for the posts (e.g., 'real-time tracking', 'first booking promo', 'broker income')",
        },
      },
      required: ["content_type", "audience", "count"],
    },
  },
  {
    name: "generate_ad_copy",
    description:
      "Generate Facebook ad copy variants (primary text, headline, description, CTA) for GetGo PH paid campaigns. Produces multiple A/B test variants.",
    input_schema: {
      type: "object",
      properties: {
        campaign_objective: {
          type: "string",
          enum: [
            "video_views",
            "app_installs",
            "lead_generation",
            "traffic",
            "conversions",
          ],
          description: "The Facebook campaign objective",
        },
        audience: {
          type: "string",
          enum: ["shippers", "brokers", "retargeting"],
          description: "Target audience",
        },
        phase: {
          type: "number",
          enum: [1, 2, 3],
          description: "Campaign phase (1=Awareness, 2=Consideration, 3=Conversion)",
        },
        variants: {
          type: "number",
          description: "Number of ad copy variants to generate (2–4)",
          minimum: 2,
          maximum: 4,
        },
        angle: {
          type: "string",
          description:
            "Optional specific angle (e.g., 'urgency', 'social proof', 'benefit-led', 'problem-solution')",
        },
      },
      required: ["campaign_objective", "audience", "phase"],
    },
  },
  {
    name: "generate_video_script",
    description:
      "Generate a complete Facebook video ad script with scene descriptions, voiceover, on-screen text, and production notes.",
    input_schema: {
      type: "object",
      properties: {
        duration_seconds: {
          type: "number",
          enum: [15, 30, 60, 90],
          description: "Target video duration in seconds",
        },
        format: {
          type: "string",
          enum: ["reels_9x16", "feed_4x5", "feed_16x9", "stories_9x16"],
          description: "Video format/aspect ratio",
        },
        audience: {
          type: "string",
          enum: ["shippers", "brokers", "both"],
          description: "Primary target audience",
        },
        hook_style: {
          type: "string",
          enum: [
            "problem_pain",
            "curiosity",
            "social_proof",
            "bold_claim",
            "question",
          ],
          description: "Opening hook style for maximum retention",
        },
        objective: {
          type: "string",
          enum: [
            "brand_awareness",
            "app_install",
            "broker_signup",
            "first_booking",
          ],
          description: "Primary objective of the video",
        },
      },
      required: ["duration_seconds", "format", "audience", "hook_style"],
    },
  },
  {
    name: "plan_campaign_week",
    description:
      "Generate a detailed 7-day content plan for GetGo PH Facebook marketing, including both organic posts and paid ad recommendations.",
    input_schema: {
      type: "object",
      properties: {
        week_number: {
          type: "number",
          description: "Campaign week number (1–4)",
          minimum: 1,
          maximum: 4,
        },
        phase: {
          type: "number",
          enum: [1, 2, 3],
          description: "Campaign phase this week falls in",
        },
        focus_theme: {
          type: "string",
          description:
            "Optional primary theme for the week (e.g., 'broker recruitment', 'first booking promo', 'trust building')",
        },
        daily_budget: {
          type: "number",
          description: "Daily ad budget in PHP",
        },
      },
      required: ["week_number", "phase"],
    },
  },
  {
    name: "generate_caption_variations",
    description:
      "Generate multiple caption variations for a specific piece of content (image, video, or reel) — short, medium, and long form versions.",
    input_schema: {
      type: "object",
      properties: {
        content_description: {
          type: "string",
          description: "Description of the image/video this caption is for",
        },
        audience: {
          type: "string",
          enum: ["shippers", "brokers", "both"],
        },
        include_hashtags: {
          type: "boolean",
          description: "Whether to include hashtags",
        },
        tone: {
          type: "string",
          enum: ["casual", "professional", "urgent", "inspirational"],
          description: "Tone of the captions",
        },
      },
      required: ["content_description", "audience"],
    },
  },
  {
    name: "save_output",
    description: "Save generated marketing content to a file for later use.",
    input_schema: {
      type: "object",
      properties: {
        filename: {
          type: "string",
          description: "Filename for the output (without extension)",
        },
        content: {
          type: "string",
          description: "The marketing content to save",
        },
        type: {
          type: "string",
          enum: ["posts", "ads", "scripts", "plans", "captions"],
          description: "Type of content being saved",
        },
      },
      required: ["filename", "content", "type"],
    },
  },
];

// ─────────────────────────────────────────────────────────────
// TOOL EXECUTION HANDLERS
// ─────────────────────────────────────────────────────────────
function executeToolCall(toolName, toolInput, generatedContent) {
  switch (toolName) {
    case "generate_facebook_posts":
      return {
        status: "ready_to_generate",
        params: toolInput,
        instruction: `Generate ${toolInput.count} Facebook post(s) for GetGo PH targeting ${toolInput.audience} with content type "${toolInput.content_type}"${toolInput.theme ? ` focused on theme: "${toolInput.theme}"` : ""}. Each post should have: main copy (Tagalog/Taglish), 3-5 emojis, relevant hashtags, and a clear CTA to download the app or sign up as broker.`,
      };

    case "generate_ad_copy":
      return {
        status: "ready_to_generate",
        params: toolInput,
        instruction: `Generate ${toolInput.variants || 3} Facebook ad copy variant(s) for Phase ${toolInput.phase} (${["", "Awareness", "Consideration", "Conversion"][toolInput.phase]}) targeting ${toolInput.audience} with objective "${toolInput.campaign_objective}"${toolInput.angle ? ` using a "${toolInput.angle}" angle` : ""}. Each variant needs: Primary Text (max 125 chars), Headline (max 40 chars), Description (max 30 chars), and recommended CTA button text.`,
      };

    case "generate_video_script":
      return {
        status: "ready_to_generate",
        params: toolInput,
        instruction: `Generate a complete ${toolInput.duration_seconds}-second Facebook video script for GetGo PH. Format: ${toolInput.format}. Audience: ${toolInput.audience}. Hook style: ${toolInput.hook_style}. Include: timecoded scenes, voiceover script, on-screen text overlays, visual directions, and production notes. Language: Tagalog/Taglish with English emphasis words.`,
      };

    case "plan_campaign_week":
      return {
        status: "ready_to_generate",
        params: toolInput,
        instruction: `Generate a detailed 7-day GetGo PH Facebook content plan for Week ${toolInput.week_number}, Phase ${toolInput.phase}${toolInput.focus_theme ? `, focused on "${toolInput.focus_theme}"` : ""}. Daily budget: ₱${toolInput.daily_budget || CONFIG.dailyBudget}. Include: daily post type, copy theme, audience, post format, whether it's organic or paid, best posting time, and expected outcome.`,
      };

    case "generate_caption_variations":
      return {
        status: "ready_to_generate",
        params: toolInput,
        instruction: `Generate 3 caption variations for this content: "${toolInput.content_description}". Target audience: ${toolInput.audience}. Tone: ${toolInput.tone || "casual"}. Provide: SHORT version (under 80 chars), MEDIUM version (80–200 chars), LONG version (200–400 chars with storytelling). ${toolInput.include_hashtags ? "Include hashtags in each version." : "No hashtags."} All in Tagalog/Taglish.`,
      };

    case "save_output": {
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, 19);
      const typeDir = path.join(CONFIG.outputDir, toolInput.type);
      if (!fs.existsSync(typeDir)) {
        fs.mkdirSync(typeDir, { recursive: true });
      }
      const filename = path.join(
        typeDir,
        `${toolInput.filename}_${timestamp}.md`
      );
      fs.writeFileSync(filename, toolInput.content, "utf8");
      return {
        status: "saved",
        path: filename,
        message: `Content saved to: ${filename}`,
      };
    }

    default:
      return { status: "error", message: `Unknown tool: ${toolName}` };
  }
}

// ─────────────────────────────────────────────────────────────
// MAIN AGENT CLASS
// ─────────────────────────────────────────────────────────────
class GetGoPHMarketingAgent {
  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error(
        "\n❌ ERROR: ANTHROPIC_API_KEY is not set.\n" +
          "   Copy .env.example to .env and add your API key.\n" +
          "   Get your key at: https://console.anthropic.com\n"
      );
      process.exit(1);
    }

    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    this.conversationHistory = [];
  }

  /**
   * Run the agent with an agentic loop (tool use until done)
   */
  async run(userMessage) {
    console.log(`\n🚀 GetGo PH Marketing Agent`);
    console.log(`📋 Task: ${userMessage}\n`);

    this.conversationHistory.push({ role: "user", content: userMessage });

    let iterationCount = 0;
    const MAX_ITERATIONS = 10;

    while (iterationCount < MAX_ITERATIONS) {
      iterationCount++;

      const response = await this.client.messages.create({
        model: CONFIG.model,
        max_tokens: 4096,
        system: BRAND_CONTEXT,
        tools: TOOLS,
        messages: this.conversationHistory,
      });

      // Collect all text and tool use blocks
      const textBlocks = response.content.filter((b) => b.type === "text");
      const toolUseBlocks = response.content.filter(
        (b) => b.type === "tool_use"
      );

      // Print any text the agent outputs
      for (const block of textBlocks) {
        if (block.text.trim()) {
          console.log("\n🤖 Agent:", block.text);
        }
      }

      // If no tool calls, we're done
      if (response.stop_reason === "end_turn" || toolUseBlocks.length === 0) {
        break;
      }

      // Add assistant response to history
      this.conversationHistory.push({
        role: "assistant",
        content: response.content,
      });

      // Process all tool calls
      const toolResults = [];

      for (const toolUse of toolUseBlocks) {
        console.log(`\n🔧 Using tool: ${toolUse.name}`);
        console.log(`   Input:`, JSON.stringify(toolUse.input, null, 2));

        const toolResult = executeToolCall(
          toolUse.name,
          toolUse.input,
          null
        );

        console.log(`   Result status: ${toolResult.status}`);

        if (toolResult.status === "saved") {
          console.log(`   ✅ Saved: ${toolResult.path}`);
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(toolResult),
        });
      }

      // Add tool results to history
      this.conversationHistory.push({
        role: "user",
        content: toolResults,
      });
    }

    if (iterationCount >= MAX_ITERATIONS) {
      console.log(
        "\n⚠️  Max iterations reached. Task may be incomplete."
      );
    }

    console.log("\n✅ Agent task complete.\n");
  }

  /**
   * Interactive chat mode
   */
  async interactive() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log("\n╔══════════════════════════════════════════════════╗");
    console.log("║   GetGo PH — Facebook Marketing Agent            ║");
    console.log("║   Powered by Claude Sonnet 4.6                   ║");
    console.log("╠══════════════════════════════════════════════════╣");
    console.log("║  Commands:                                        ║");
    console.log("║  • Type any task or question                     ║");
    console.log("║  • 'posts' → Generate Facebook posts            ║");
    console.log("║  • 'ads' → Generate ad copy                     ║");
    console.log("║  • 'script' → Generate video script             ║");
    console.log("║  • 'week [1-4]' → Plan a campaign week          ║");
    console.log("║  • 'exit' → Quit                                ║");
    console.log("╚══════════════════════════════════════════════════╝\n");

    const askQuestion = () => {
      rl.question("You: ", async (input) => {
        const trimmed = input.trim();

        if (!trimmed) {
          askQuestion();
          return;
        }

        if (trimmed.toLowerCase() === "exit") {
          console.log(
            "\n👋 Salamat! Karga. Trabaho. Tagumpay. — GetGo PH\n"
          );
          rl.close();
          return;
        }

        // Shorthand commands
        let task = trimmed;
        if (trimmed.toLowerCase() === "posts") {
          task =
            "Generate 3 Facebook organic posts for GetGo PH — one for shippers, one for brokers, one for engagement. Save the results.";
        } else if (trimmed.toLowerCase() === "ads") {
          task =
            "Generate Facebook ad copy for Phase 1 awareness campaign targeting shippers. Create 3 variants with different angles. Save the results.";
        } else if (trimmed.toLowerCase() === "script") {
          task =
            "Generate a 30-second Facebook Reels script for GetGo PH targeting shippers with a problem-pain hook. Save the results.";
        } else if (/^week\s*([1-4])$/i.test(trimmed)) {
          const weekNum = trimmed.match(/([1-4])/)[1];
          const phase = weekNum <= 1 ? 1 : weekNum <= 2 ? 2 : 3;
          task = `Plan Week ${weekNum} of the GetGo PH Facebook campaign (Phase ${phase}). Include daily content plan with organic posts and paid ad recommendations. Save the plan.`;
        }

        try {
          // Keep conversation context for multi-turn
          this.conversationHistory.push({ role: "user", content: task });
          await this.runFromHistory();
          askQuestion();
        } catch (err) {
          console.error("\n❌ Error:", err.message);
          askQuestion();
        }
      });
    };

    askQuestion();
  }

  /**
   * Run agent from existing conversation history (for interactive mode)
   */
  async runFromHistory() {
    let iterationCount = 0;
    const MAX_ITERATIONS = 10;

    while (iterationCount < MAX_ITERATIONS) {
      iterationCount++;

      const response = await this.client.messages.create({
        model: CONFIG.model,
        max_tokens: 4096,
        system: BRAND_CONTEXT,
        tools: TOOLS,
        messages: this.conversationHistory,
      });

      const textBlocks = response.content.filter((b) => b.type === "text");
      const toolUseBlocks = response.content.filter(
        (b) => b.type === "tool_use"
      );

      for (const block of textBlocks) {
        if (block.text.trim()) {
          console.log("\n🤖 Agent:", block.text);
        }
      }

      if (response.stop_reason === "end_turn" || toolUseBlocks.length === 0) {
        this.conversationHistory.push({
          role: "assistant",
          content: response.content,
        });
        break;
      }

      this.conversationHistory.push({
        role: "assistant",
        content: response.content,
      });

      const toolResults = [];
      for (const toolUse of toolUseBlocks) {
        console.log(`\n🔧 Tool: ${toolUse.name}`);

        const toolResult = executeToolCall(toolUse.name, toolUse.input, null);

        if (toolResult.status === "saved") {
          console.log(`   ✅ Saved to: ${toolResult.path}`);
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(toolResult),
        });
      }

      this.conversationHistory.push({
        role: "user",
        content: toolResults,
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────
// CLI ENTRY POINT
// ─────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const taskFlag = args.indexOf("--task");
  const interactiveFlag = args.includes("--interactive");

  const agent = new GetGoPHMarketingAgent();

  if (interactiveFlag || args.length === 0) {
    // Interactive mode
    await agent.interactive();
    return;
  }

  if (taskFlag !== -1 && args[taskFlag + 1]) {
    const task = args[taskFlag + 1];

    const taskMap = {
      "generate-posts":
        "Generate 7 Facebook organic posts for GetGo PH covering all 5 content pillars. Include posts for shippers, brokers, and engagement. Use Filipino/Taglish language. Save all results as a posts file.",

      "generate-ads":
        "Generate Facebook ad copy for all 3 campaign phases: Phase 1 (Awareness - Video Views targeting shippers), Phase 2 (App Installs targeting shippers + Lead Gen targeting brokers), Phase 3 (Retargeting warm audiences). Generate 3 variants per ad set. Save all results.",

      "generate-script":
        "Generate a complete 60-second Facebook video ad script for GetGo PH. Format 4:5 feed video. Targeting both shippers and brokers. Use a problem-pain hook. Include full timecoded storyboard, voiceover, on-screen text, and production notes. Save the results.",

      "plan-week":
        "Generate the complete 4-week GetGo PH Facebook campaign plan. Week 1 = Phase 1 Awareness, Week 2 = Phase 1-2 transition, Week 3 = Phase 2 Consideration, Week 4 = Phase 3 Conversion. Daily budget ₱150. Save as a comprehensive campaign plan.",
    };

    const taskPrompt = taskMap[task];
    if (!taskPrompt) {
      console.error(
        `Unknown task: ${task}\nAvailable: ${Object.keys(taskMap).join(", ")}`
      );
      process.exit(1);
    }

    await agent.run(taskPrompt);
  } else {
    // If no flags, run interactive
    await agent.interactive();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
