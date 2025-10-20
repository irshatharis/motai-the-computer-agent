import "dotenv/config";
import {ComputerAgent} from "./src/agent.js";

/**
 * Demo script showing how to use the Computer Agent
 */
async function main() {
  // Check for API key
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("❌ OPENROUTER_API_KEY not found in environment variables");
    console.error("   Create a .env file with your OpenRouter API key");
    console.error("   Get one at: https://openrouter.ai/keys");
    process.exit(1);
  }

  // Create agent
  const agent = new ComputerAgent(apiKey, {
    model: process.env.MODEL || "anthropic/claude-3.5-sonnet",
    maxSteps: 10,
    stepDelay: 2000, // Wait 2s between steps
  });

  // Get task from command line or use default
  const task = process.argv[2] || "Click on the search bar";

  console.log("\n🚀 Computer Use Agent Demo");
  console.log("━".repeat(60));
  console.log(`📋 Task: ${task}`);
  console.log("━".repeat(60));
  console.log("\n⚠️  Important:");
  console.log("   - Make sure the window you want to interact with is visible");
  console.log("   - The agent will start in 5 seconds...");
  console.log("   - Annotated screenshots will be saved to ./output/");
  console.log("   - Press Ctrl+C to stop\n");

  // Countdown
  for (let i = 5; i > 0; i--) {
    process.stdout.write(`\r   Starting in ${i}... `);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  console.log("\n");

  try {
    // Execute the task
    const history = await agent.executeTask(task);

    // Print summary
    console.log("\n📊 Summary:");
    console.log(`   Total steps taken: ${history.length}`);
    console.log(`   Check ./output/ folder for annotated screenshots`);
  } catch (error) {
    console.error("\n❌ Fatal error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle Ctrl+C gracefully
process.on("SIGINT", () => {
  console.log("\n\n⚠️  Interrupted by user");
  process.exit(0);
});

main();
