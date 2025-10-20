import {captureScreen, saveScreenshot} from "./screenshot.js";
import {detectUIElements} from "./detector.js";
import {annotateScreenshot} from "./annotator.js";
import {LLMClient} from "./llm-client.js";
import {ActionExecutor} from "./executor.js";

/**
 * Main Computer Use Agent
 */
export class ComputerAgent {
  constructor(apiKey, options = {}) {
    this.llm = new LLMClient(apiKey, options.model);
    this.executor = new ActionExecutor();
    this.maxSteps = options.maxSteps || 10;
    this.outputDir = options.outputDir || "./output";
    this.stepDelay = options.stepDelay || 1000;
  }

  /**
   * Executes a task
   */
  async executeTask(task) {
    console.log("\n" + "=".repeat(60));
    console.log(`🤖 Starting task: "${task}"`);
    console.log("=".repeat(60) + "\n");

    const history = [];
    let stepCount = 0;

    while (stepCount < this.maxSteps) {
      stepCount++;
      console.log(`\n📍 Step ${stepCount}/${this.maxSteps}`);
      console.log("-".repeat(60));

      try {
        // 1. Capture screenshot
        console.log("📸 Capturing screenshot...");
        const screenshot = await captureScreen();

        // 2. Detect elements
        console.log("🔍 Detecting interactive elements...");
        const elements = await detectUIElements(screenshot);
        console.log(
          `   Found ${elements.length} potential interactive elements`,
        );

        // 3. Annotate screenshot
        console.log("✏️  Annotating screenshot with element numbers...");
        const annotatedImage = await annotateScreenshot(screenshot, elements);

        // Save annotated screenshot for debugging
        const filename = `step-${stepCount}-annotated.png`;
        await saveScreenshot(annotatedImage, filename);
        console.log(`   Saved annotated screenshot: output/${filename}`);

        // 4. Send to LLM for decision
        console.log("🧠 Asking LLM what to do...");
        const decision = await this.llm.analyzeScreenshot(
          annotatedImage,
          task,
          elements,
        );

        console.log("\n💭 LLM Decision:");
        console.log(`   Action: ${decision.action}`);
        console.log(`   Reasoning: ${decision.reasoning || decision.thinking}`);

        // Record this step
        history.push({
          step: stepCount,
          decision,
          timestamp: new Date().toISOString(),
        });

        // 5. Execute the action
        if (decision.action === "done") {
          console.log("\n✅ Task completed!");
          break;
        } else if (decision.action === "wait") {
          console.log("⏳ Waiting for page to load...");
          await this.executor.sleep(2000);
        } else if (decision.action === "click") {
          const element = elements.find((el) => el.id === decision.elementId);
          if (element) {
            await this.executor.click(element.x, element.y);
          } else {
            console.error(`❌ Element ${decision.elementId} not found`);
          }
        } else if (decision.action === "type") {
          await this.executor.type(decision.text);
        } else if (decision.action === "scroll") {
          await this.executor.scroll(decision.scrollDirection);
        } else {
          console.log(`⚠️  Unknown action: ${decision.action}`);
        }

        // Wait before next step
        await this.executor.sleep(this.stepDelay);
      } catch (error) {
        console.error(`\n❌ Error in step ${stepCount}:`, error.message);

        // Save error info
        history.push({
          step: stepCount,
          error: error.message,
          timestamp: new Date().toISOString(),
        });

        // Continue or break?
        if (stepCount < this.maxSteps) {
          console.log("⚠️  Attempting to continue...");
          await this.executor.sleep(2000);
        } else {
          break;
        }
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("🏁 Task execution finished");
    console.log(`   Total steps: ${stepCount}`);
    console.log("=".repeat(60) + "\n");

    return history;
  }

  /**
   * Takes a single step (useful for debugging)
   */
  async step(task) {
    const screenshot = await captureScreen();
    const elements = await detectUIElements(screenshot);
    const annotatedImage = await annotateScreenshot(screenshot, elements);

    // Save for inspection
    await saveScreenshot(annotatedImage, "debug-annotated.png");

    const decision = await this.llm.analyzeScreenshot(
      annotatedImage,
      task,
      elements,
    );

    return {decision, elements};
  }
}
