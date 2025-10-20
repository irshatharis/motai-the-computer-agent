import "dotenv/config";
import {ComputerAgentV2} from "./v2/agent.js";
import {createOpenRouter} from "@openrouter/ai-sdk-provider";

/**
 * V2 Demo - Fast computer use agent with tool calling
 */
async function main() {
  // Get API key - support both OpenRouter and direct OpenAI/Anthropic
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!openrouterKey && !openaiKey && !anthropicKey) {
    console.error("❌ No API key found!");
    console.error(
      "   Set one of: OPENROUTER_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY",
    );
    console.error("   In your .env file");
    process.exit(1);
  }

  // Configure provider
  let provider, model, envKey, envValue;

  if (openrouterKey) {
    // OpenRouter setup - using official provider
    const openrouter = createOpenRouter({
      apiKey: openrouterKey,
    });
    model = openrouter.chat(process.env.MODEL || "anthropic/claude-3.5-sonnet");
    console.log("🔌 Using OpenRouter");
  } else if (anthropicKey) {
    provider = "anthropic";
    envKey = "ANTHROPIC_API_KEY";
    envValue = anthropicKey;
    console.log("🔌 Using Anthropic API");
  } else {
    provider = "openai";
    envKey = "OPENAI_API_KEY";
    envValue = openaiKey;
    console.log("🔌 Using OpenAI API");
  }

  // Set env for ai-sdk
  if (envKey) {
    process.env[envKey] = envValue;
  }

  // Get task from command line
  const task = process.argv[2];

  if (!task) {
    console.error("\n❌ No task provided!");
    console.error("\nUsage:");
    console.error('  npm run demo:v2 "your task here"');
    console.error("\nExamples:");
    console.error('  npm run demo:v2 "Click on the search bar"');
    console.error('  npm run demo:v2 "Type hello world"');
    console.error('  npm run demo:v2 "Open a new tab"');
    process.exit(1);
  }

  console.log("\n🚀 Computer Use Agent V2");
  console.log("━".repeat(70));
  console.log(`📋 Task: ${task}`);
  console.log("━".repeat(70));
  console.log("\n⚡ Key improvements:");
  console.log("   • OCR-based perception (no vision API needed)");
  console.log("   • Tool calling (LLM decides what to do)");
  console.log("   • 5-10x faster than V1");
  console.log("   • Much cheaper (text-based)");
  console.log("\n⚠️  Important:");
  console.log("   - Agent starts in 3 seconds");
  console.log("   - Press Ctrl+C to stop");
  console.log("   - Check output/ for debug screenshots\n");

  // Countdown
  for (let i = 3; i > 0; i--) {
    process.stdout.write(`\r   Starting in ${i}... `);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  console.log("\n");

  // Create agent
  const agentOptions = {
    maxSteps: 50,
    verbose: true,
  };

  if (model) {
    // OpenRouter: pass the model instance directly
    agentOptions.customModel = model;
  } else {
    // Direct API: pass provider name
    agentOptions.provider = provider;
    agentOptions.model = process.env.MODEL;
  }

  const agent = new ComputerAgentV2(agentOptions);

  try {
    const result = await agent.executeTask(task);

    console.log("\n📊 Results:");
    console.log(`   Success: ${result.success ? "✅" : "❌"}`);
    console.log(`   Total time: ${result.totalTime}s`);
    console.log(`   Steps taken: ${result.steps}`);
    console.log(
      `   Avg per step: ${(result.totalTime / result.steps).toFixed(2)}s`,
    );
  } catch (error) {
    console.error("\n❌ Fatal error:", error.message);
    if (error.stack) {
      console.error("\nStack trace:");
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await agent.cleanup();
  }
}

// Handle Ctrl+C
process.on("SIGINT", async () => {
  console.log("\n\n⚠️  Interrupted by user");
  process.exit(0);
});

main();
