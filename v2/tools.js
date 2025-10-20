import {tool} from "ai";
import {z} from "zod";

/**
 * Define tools the LLM can use to control the computer
 * These are fast, text-based operations
 */
export function createTools(perception, actions) {
  return {
    // Get current screen content (text-based, no vision API)
    getScreenContent: tool({
      description:
        "Get all visible text on the current screen. Use this to understand what's on screen before taking action. This is FAST and should be your first action.",
      parameters: z.object({}),
      execute: async () => {
        try {
          // Ensure OCR is initialized
          await perception.init();

          const context = await perception.getScreenContext();
          const summary = perception.getTextSummary();

          return {
            success: true,
            visibleText: summary,
            elementCount: context.elements.length,
            phrases: context.phrases.slice(0, 20).map((p) => ({
              text: p.text,
              position: `(${p.x}, ${p.y})`,
            })),
          };
        } catch (error) {
          console.error("Error in getScreenContent:", error);
          return {
            success: false,
            error: `Failed to capture screen: ${error.message}`,
          };
        }
      },
    }),

    // Click on text element
    clickOn: tool({
      description:
        'Click on a UI element by its text. Example: clickOn("Search") will find and click the Search button/link. Use partial text if needed.',
      parameters: z.object({
        text: z.string().describe("The text to click on (can be partial)"),
        retries: z
          .number()
          .optional()
          .default(2)
          .describe("Number of retries if element not found"),
      }),
      execute: async ({text, retries = 2}) => {
        let lastError = null;

        for (let attempt = 0; attempt <= retries; attempt++) {
          try {
            if (attempt > 0) {
              console.log(`   Retry ${attempt}/${retries}...`);
              await actions.wait(300);
            }

            // Ensure we have screen context (refresh on retry)
            await perception.getScreenContext(attempt > 0);

            const element = perception.findElement(text);

            if (!element) {
              lastError = `Could not find "${text}" on screen`;
              continue;
            }

            // Click with slight padding consideration for better accuracy
            // For phrases, click slightly higher (buttons often need this)
            const clickY = element.type === "phrase" ? element.y : element.y;

            actions.click(element.x, clickY);

            // Adaptive wait based on element type
            const waitTime = element.type === "phrase" ? 400 : 300;
            await actions.wait(waitTime);

            // Refresh screen context after successful action
            await perception.getScreenContext(true);

            return {
              success: true,
              clicked: element.text,
              position: `(${element.x}, ${clickY})`,
              confidence: element.confidence,
              attempts: attempt + 1,
            };
          } catch (error) {
            lastError = `Error clicking: ${error.message}`;
            console.error(`Error in clickOn attempt ${attempt + 1}:`, error);
          }
        }

        // All retries failed
        return {
          success: false,
          error: lastError || "Unknown error",
          availableText: perception.lastContext
            ? perception.getTextSummary()
            : "Screen not captured",
          attempts: retries + 1,
        };
      },
    }),

    // Click at specific coordinates
    clickAt: tool({
      description:
        "Click at specific screen coordinates. Use this when you know exact position or clickOn fails.",
      parameters: z.object({
        x: z.number().describe("X coordinate"),
        y: z.number().describe("Y coordinate"),
      }),
      execute: async ({x, y}) => {
        try {
          actions.click(x, y);
          await actions.wait(400);
          await perception.getScreenContext(true);
          return {success: true, x, y};
        } catch (error) {
          console.error("Error in clickAt:", error);
          return {success: false, error: error.message, x, y};
        }
      },
    }),

    // Type text
    typeText: tool({
      description:
        "Type text using the keyboard. Use this to enter URLs, search terms, form data, etc.",
      parameters: z.object({
        text: z.string().describe("Text to type"),
      }),
      execute: async ({text}) => {
        actions.type(text);
        // Adaptive wait based on text length
        const waitTime = Math.min(200 + text.length * 5, 1000);
        await actions.wait(waitTime);
        return {success: true, typed: text, length: text.length};
      },
    }),

    // Press key
    pressKey: tool({
      description:
        'Press a keyboard key, optionally with modifiers. Common shortcuts: Cmd+Space (Spotlight), Cmd+Tab (switch apps), Cmd+T (new tab), Cmd+Q (quit). Examples: pressKey("enter"), pressKey("space", ["command"]) for Spotlight',
      parameters: z.object({
        key: z
          .string()
          .describe(
            'Key to press: "enter", "escape", "tab", "backspace", "space", letters, numbers, arrow keys ("up", "down", "left", "right"), function keys ("f1"-"f12")',
          ),
        modifiers: z
          .array(z.enum(["command", "control", "shift", "alt"]))
          .optional()
          .describe(
            'Optional modifiers: ["command"] for Mac Cmd, ["control"] for Ctrl, ["shift"], ["alt"]. Use command on macOS, control on Windows/Linux.',
          ),
      }),
      execute: async ({key, modifiers = []}) => {
        try {
          actions.pressKey(key, modifiers);

          // Adaptive wait times based on what key does
          let waitTime = 250;
          if (["enter", "return"].includes(key.toLowerCase())) {
            waitTime = 600; // Navigation/form submission
          } else if (
            modifiers.includes("command") ||
            modifiers.includes("control")
          ) {
            // Shortcuts often trigger UI changes
            waitTime =
              modifiers.includes("command") && key.toLowerCase() === "space"
                ? 800 // Spotlight needs more time
                : 500;
          }

          await actions.wait(waitTime);

          // Refresh screen after keyboard shortcuts that likely changed UI
          const shouldRefresh =
            modifiers.length > 0 ||
            ["enter", "return", "escape", "tab"].includes(key.toLowerCase());

          if (shouldRefresh) {
            await perception.getScreenContext(true);
          }

          return {success: true, key, modifiers};
        } catch (error) {
          console.error("Error in pressKey:", error);
          return {success: false, error: error.message};
        }
      },
    }),

    // Scroll
    scroll: tool({
      description: "Scroll the page or window up or down",
      parameters: z.object({
        direction: z.enum(["up", "down"]).describe("Direction to scroll"),
        amount: z
          .number()
          .optional()
          .default(3)
          .describe("How much to scroll (1-10)"),
      }),
      execute: async ({direction, amount = 3}) => {
        try {
          actions.scroll(direction, amount);
          // Wait for scroll animation and content to settle
          await actions.wait(400);
          await perception.getScreenContext(true);
          return {success: true, direction, amount};
        } catch (error) {
          console.error("Error in scroll:", error);
          return {success: false, error: error.message};
        }
      },
    }),

    // Wait
    wait: tool({
      description:
        "Wait for a specified amount of time (for page loads, animations, etc)",
      parameters: z.object({
        seconds: z.number().describe("Number of seconds to wait"),
      }),
      execute: async ({seconds}) => {
        try {
          await actions.wait(seconds * 1000);
          await perception.getScreenContext(true);
          return {success: true, waited: seconds};
        } catch (error) {
          console.error("Error in wait:", error);
          return {success: false, error: error.message};
        }
      },
    }),

    // Double click
    doubleClick: tool({
      description: "Double-click on a UI element by its text",
      parameters: z.object({
        text: z.string().describe("The text to double-click on"),
        retries: z
          .number()
          .optional()
          .default(2)
          .describe("Number of retries if element not found"),
      }),
      execute: async ({text, retries = 2}) => {
        let lastError = null;

        for (let attempt = 0; attempt <= retries; attempt++) {
          try {
            if (attempt > 0) {
              console.log(`   Retry ${attempt}/${retries}...`);
              await actions.wait(300);
            }

            // Ensure we have screen context
            await perception.getScreenContext(attempt > 0);

            const element = perception.findElement(text);

            if (!element) {
              lastError = `Could not find "${text}" on screen`;
              continue;
            }

            actions.doubleClick(element.x, element.y);
            await actions.wait(400);
            await perception.getScreenContext(true);

            return {
              success: true,
              doubleClicked: element.text,
              confidence: element.confidence,
              attempts: attempt + 1,
            };
          } catch (error) {
            lastError = `Error double-clicking: ${error.message}`;
            console.error(
              `Error in doubleClick attempt ${attempt + 1}:`,
              error,
            );
          }
        }

        return {
          success: false,
          error: lastError || "Unknown error",
          availableText: perception.lastContext
            ? perception.getTextSummary()
            : "Screen not captured",
          attempts: retries + 1,
        };
      },
    }),

    // Task complete
    taskComplete: tool({
      description:
        "Call this when the task is successfully completed. Provide a summary of what was accomplished.",
      parameters: z.object({
        summary: z.string().describe("Summary of what was accomplished"),
      }),
      execute: async ({summary}) => {
        return {success: true, completed: true, summary};
      },
    }),
  };
}
