import {generateText} from "ai";
import {openai} from "@ai-sdk/openai";
import {anthropic} from "@ai-sdk/anthropic";
import {PerceptionLayer} from "./perception.js";
import {ActionLayer} from "./actions.js";
import {createTools} from "./tools.js";

/**
 * V2 Computer Use Agent
 * Fast, efficient, uses tool calling instead of vision every step
 */
export class ComputerAgentV2 {
  constructor(options = {}) {
    this.perception = new PerceptionLayer();
    this.actions = new ActionLayer({
      mouseSpeed: options.mouseSpeed || 1,
      typingSpeed: options.typingSpeed || 10,
    });

    // Model configuration
    if (options.customModel) {
      // Custom model provided (e.g., OpenRouter)
      this.model = options.customModel;
    } else {
      this.model = this.getModel(options.provider, options.model);
    }

    this.maxSteps = options.maxSteps || 15;
    this.tools = createTools(this.perception, this.actions);
    this.verbose = options.verbose !== false;
  }

  /**
   * Get model instance based on provider
   */
  getModel(provider = "anthropic", modelName) {
    if (provider === "openai") {
      return openai(modelName || "gpt-4-turbo");
    } else if (provider === "anthropic") {
      return anthropic(modelName || "claude-3-5-sonnet-20241022");
    } else {
      // Default to anthropic
      return anthropic("claude-3-5-sonnet-20241022");
    }
  }

  /**
   * Execute a task using tool calling
   */
  async executeTask(task) {
    console.log("\n" + "=".repeat(70));
    console.log(`🤖 V2 Agent - Task: "${task}"`);
    console.log("=".repeat(70) + "\n");

    const startTime = Date.now();
    const history = [];
    let stepCount = 0;

    // System prompt
    const systemPrompt = `You are a computer use agent that can control a computer like a human.

You have access to tools that let you:
- See what's on screen (text-based OCR, very fast)
- Click on elements by their text (uses smart matching)
- Type text and press keys (including keyboard shortcuts)
- Scroll, wait, and more

IMPORTANT RULES:
1. ALWAYS call getScreenContent FIRST to see what's on screen
2. Use clickOn with text that matches what you see (partial text works - it will find the best match)
3. Text matching is smart: it ranks by exact match > word boundary > starts with > contains
4. If clickOn fails, the error message shows available text - use that to adjust
5. Tools have built-in retry logic - trust the error messages
6. Work step-by-step and verify after each action by calling getScreenContent again
7. Call taskComplete when you've successfully completed the task

SMART STRATEGIES FOR COMMON TASKS:

Opening Applications (choose best approach):
- Option 1: Use Spotlight (RECOMMENDED on macOS)
  1. pressKey("space", ["command"]) to open Spotlight
  2. wait(1) for launcher to appear
  3. typeText("Application Name")
  4. pressKey("enter")
- Option 2: Click on Dock/Taskbar icons (if visible)
- Option 3: Use Start Menu on Windows (pressKey with "command" or "control")

Opening Files/URLs:
- Use Cmd+O (Mac) or Ctrl+O (Windows) to open file dialog
- Use Cmd+T (Mac) or Ctrl+T (Windows) for new browser tab
- Type URLs directly in address bar

Navigating When Nothing Clickable:
- Try keyboard shortcuts instead of clicking
- Common shortcuts: Cmd+Space (Spotlight), Cmd+Tab (switch apps), Cmd+Q (quit)
- Windows: Win key, Ctrl+Esc (Start menu), Alt+Tab (switch)
- Use Tab key to navigate between UI elements
- Use arrow keys to navigate menus

Tips for accuracy:
- Use distinctive text for clicking (not common words like "the" or "a")
- After any action, wait for it to complete then check screen again
- If element not found, try keyboard shortcut approach instead
- Button text is often grouped from multiple words - use the full phrase
- If stuck, try different approach (keyboard vs clicking)

Platform Detection:
- On macOS: use "command" modifier for shortcuts
- On Windows/Linux: use "control" modifier for shortcuts

Be efficient and adaptive - if one approach fails, try another!`;

    // Initial context
    const messages = [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: task,
      },
    ];

    while (stepCount < this.maxSteps) {
      stepCount++;
      console.log(`\n${"─".repeat(70)}`);
      console.log(`📍 Step ${stepCount}/${this.maxSteps}`);
      console.log("─".repeat(70));

      try {
        // Call LLM with tools
        const result = await generateText({
          model: this.model,
          messages,
          tools: this.tools,
          // maxSteps: 5, // Allow multiple tool calls per LLM turn
        });

        // Log what the LLM said
        if (result.text && this.verbose) {
          console.log(`\n💭 Agent: ${result.text}`);
        }

        // Record step
        history.push({
          step: stepCount,
          text: result.text,
          toolCalls: result.toolCalls?.map((tc) => ({
            tool: tc.toolName,
            args: tc.args,
            result: tc.result,
          })),
          timestamp: Date.now(),
        });

        // Check if task is complete
        // Robust completion detection
        const completeTool = result.toolCalls?.find(
          (tc) => tc.toolName === "taskComplete",
        );
        if (completeTool) {
          const summary =
            completeTool?.result?.summary ||
            completeTool?.args?.summary ||
            "Task completed";
          console.log(`\n✅ Task Complete: ${summary}`);
          // Record completion in history
          history.push({
            step: stepCount,
            completed: true,
            summary,
            timestamp: Date.now(),
          });
          break;
        }

        // Check if any tool call failed critically
        const failed = result.toolCalls?.some(
          (tc) => tc.result?.success === false && tc.result?.error,
        );

        if (failed && this.verbose) {
          console.log(
            "\n⚠️  Some actions failed, agent will try to recover...",
          );
        }

        // Add the complete response to message history
        // IMPORTANT: Only add properly formatted messages
        if (result.response && result.response.messages) {
          // Filter to ensure we only add valid message types
          const validMessages = result.response.messages.filter(
            (msg) =>
              msg &&
              msg.role &&
              (msg.role === "assistant" ||
                msg.role === "user" ||
                msg.role === "tool"),
          );
          messages.push(...validMessages);
        } else if (result.text || result.toolCalls) {
          // Manually construct valid assistant message
          const assistantMessage = {
            role: "assistant",
            content: result.text || "",
          };

          // Add tool calls if present
          if (result.toolCalls && result.toolCalls.length > 0) {
            assistantMessage.toolCalls = result.toolCalls.map((tc) => ({
              type: "tool-call",
              toolCallId: tc.toolCallId,
              toolName: tc.toolName,
              args: tc.args,
            }));
          }

          messages.push(assistantMessage);

          // Add tool results as separate messages
          if (result.toolCalls && result.toolCalls.length > 0) {
            for (const tc of result.toolCalls) {
              messages.push({
                role: "tool",
                content: [
                  {
                    type: "tool-result",
                    toolCallId: tc.toolCallId,
                    toolName: tc.toolName,
                    result: tc.result,
                  },
                ],
              });
            }
          }
        }

        // If no tool calls were made, prompt the agent
        if (!result.toolCalls || result.toolCalls.length === 0) {
          console.log("\n⚠️  Agent didn't use any tools, prompting...");
          messages.push({
            role: "user",
            content:
              "You need to use tools to complete the task. Start by calling getScreenContent to see what's on screen.",
          });
        }

        // Small delay between steps for stability
        await this.actions.wait(200);
      } catch (error) {
        console.error(`\n❌ Error in step ${stepCount}:`, error.message);
        if (error.stack && this.verbose) {
          console.error("Stack:", error.stack);
        }

        history.push({
          step: stepCount,
          error: error.message,
          timestamp: Date.now(),
        });

        // Add error to message history so LLM knows what happened
        messages.push({
          role: "user",
          content: `Error occurred: ${error.message}. Please try a different approach or call taskComplete if you cannot proceed.`,
        });

        // Try to recover
        if (stepCount < this.maxSteps - 2) {
          console.log("⚠️  Attempting to continue...");
          await this.actions.wait(1000);
        } else {
          console.log("⚠️  Too many errors or near max steps, stopping...");
          break;
        }
      }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log("\n" + "=".repeat(70));
    console.log(`🏁 Finished in ${totalTime}s (${stepCount} steps)`);
    console.log(
      `⚡ Avg speed: ${(totalTime / stepCount).toFixed(2)}s per step`,
    );
    console.log("=".repeat(70) + "\n");

    // Determine success robustly
    const success =
      history.some((h) => h.completed === true) ||
      history.some((h) =>
        h.toolCalls?.some((tc) => tc.tool === "taskComplete"),
      );

    return {
      success,
      steps: stepCount,
      totalTime,
      history,
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    await this.perception.cleanup();
  }
}
