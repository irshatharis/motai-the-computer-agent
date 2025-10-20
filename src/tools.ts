import {tool} from "ai";
import {z} from "zod";
import type {Action} from "./action";
import {Key} from "@kirillvakalov/nut-tree__nut-js";
import {setTimeout as delay} from "node:timers/promises";
import {readFile, readFileSync} from "node:fs";
import sharp from "sharp";
const defineTool: any = tool;

function mapCharKey(char: string): Key | null {
  const c = char.trim();
  if (c.length !== 1) return null;
  const upper = c.toUpperCase();
  if (upper >= "A" && upper <= "Z") {
    return (Key as any)[upper] as Key;
  }
  // digits are not reliably represented across platforms; return null to fallback
  return null;
}

function mapNamedKey(name: string): Key | null {
  const k = name.toLowerCase();
  switch (k) {
    case "enter":
    case "return":
      return Key.Enter;
    case "escape":
    case "esc":
      return Key.Escape;
    case "tab":
      return Key.Tab;
    case "backspace":
      return Key.Backspace;
    case "space":
    case "spacebar":
      return Key.Space;
    case "up":
    case "arrowup":
      return Key.Up;
    case "down":
    case "arrowdown":
      return Key.Down;
    case "left":
    case "arrowleft":
      return Key.Left;
    case "right":
    case "arrowright":
      return Key.Right;
    default: {
      // f1-f12
      const fMatch = /^f([1-9]|1[0-2])$/.exec(k);
      if (fMatch) {
        const fName = `F${fMatch[1]}`;
        return (Key as any)[fName] as Key;
      }
      return null;
    }
  }
}

function mapModifier(mod: string): Key | null {
  const m = mod.toLowerCase();
  switch (m) {
    case "command":
    case "cmd":
    case "meta":
      return Key.LeftSuper;
    case "control":
    case "ctrl":
      return Key.LeftControl;
    case "shift":
      return Key.LeftShift;
    case "alt":
    case "option":
      return Key.LeftAlt;
    default:
      return null;
  }
}

export function createTools(action: Action) {
  return {
    getScreenContent: defineTool({
      description:
        "Capture the current screen to a file and return its path and size.",
      parameters: z.object({}),
      execute: async () => {
        console.log("Calling getScreenContent...");
        try {
          const [imgPath, size] = await Promise.all([
            action.captureScreen(),
            action.getScreenSize(),
          ]);

          // Optimize image: resize to max 1280px width and compress
          const optimizedBuffer = await sharp(imgPath)
            .resize(1280, null, {
              fit: "inside",
              withoutEnlargement: true,
            })
            .jpeg({quality: 75})
            .toBuffer();

          const base64 = optimizedBuffer.toString("base64");

          return {
            success: true,
            image: {base64, mimeType: "image/jpeg"},
            screen: size,
          };
        } catch (error: any) {
          return {success: false, error: String(error?.message || error)};
        }
      },
    }),

    clickOn: defineTool({
      description:
        "Click on a UI element by its text. Not yet implemented in v3.",
      parameters: z.object({
        text: z.string().describe("Text to click (can be partial)"),
        retries: z.number().optional().default(2),
      }),
      execute: async ({text}: {text: string}) => {
        console.log("Calling clickOn...");
        return {
          success: false,
          error: `clickOn(\"${text}\") is not implemented in v3 yet (OCR not wired).`,
        };
      },
    }),

    clickAt: defineTool({
      description:
        "Click at specific screen coordinates (pixels from top-left).",
      parameters: z.object({
        x: z.number().describe("X coordinate"),
        y: z.number().describe("Y coordinate"),
      }),
      execute: async ({x, y}: {x: number; y: number}) => {
        try {
          console.log("Calling clickAt...");
          await action.setPointerPosition(x, y);
          await delay(50);
          await action.leftClick();
          await delay(300);
          return {success: true, x, y};
        } catch (error: any) {
          return {success: false, error: String(error?.message || error), x, y};
        }
      },
    }),

    typeText: defineTool({
      description: "Type text using the keyboard.",
      parameters: z.object({
        text: z.string().describe("Text to type"),
      }),
      execute: async ({text}: {text: string}) => {
        console.log("Calling typeText...");
        await action.typeString(text);
        const waitMs = Math.min(200 + text.length * 5, 1000);
        await delay(waitMs);
        return {success: true, typed: text, length: text.length};
      },
    }),

    pressKey: defineTool({
      description:
        'Press a keyboard key, optionally with modifiers. Example: pressKey("enter"), or pressKey("space", ["command"]).',
      parameters: z.object({
        key: z
          .string()
          .describe(
            'Key to press: "enter", "escape", "tab", "backspace", "space", letters A-Z, arrows, function keys ("f1"-"f12")',
          ),
        modifiers: z
          .array(z.enum(["command", "control", "shift", "alt"]))
          .optional(),
      }),
      execute: async ({
        key,
        modifiers = [],
      }: {
        key: string;
        modifiers?: string[];
      }) => {
        try {
          console.log("Calling pressKey...");
          const modifierKeys = modifiers
            .map(mapModifier)
            .filter((m): m is Key => m !== null);

          const baseKey = mapNamedKey(key) ?? mapCharKey(key) ?? null;

          if (baseKey) {
            await action.pressKey(...modifierKeys, baseKey);
          } else if (modifierKeys.length === 0) {
            // Fallback to typing the string if we couldn't map the key
            await action.typeString(key);
          } else {
            return {success: false, error: `Unsupported key: ${key}`};
          }

          let waitTime = 250;
          const kLower = key.toLowerCase();
          if (kLower === "enter" || kLower === "return") waitTime = 600;
          if (modifierKeys.length > 0) waitTime = Math.max(waitTime, 500);
          await delay(waitTime);

          return {success: true, key, modifiers};
        } catch (error: any) {
          return {success: false, error: String(error?.message || error)};
        }
      },
    }),

    scroll: defineTool({
      description: "Scroll the page or window up or down.",
      parameters: z.object({
        direction: z.enum(["up", "down"]).describe("Direction to scroll"),
        amount: z
          .number()
          .optional()
          .default(3)
          .describe("How much to scroll (1-10)"),
      }),
      execute: async ({
        direction,
        amount = 3,
      }: {
        direction: "up" | "down";
        amount?: number;
      }) => {
        try {
          console.log("Calling scroll...");
          const delta = Math.max(1, Math.min(10, Math.floor(amount))) * 200;
          if (direction === "up") {
            await action.scrollUp(delta);
          } else {
            await action.scrollDown(delta);
          }
          await delay(400);
          return {success: true, direction, amount};
        } catch (error: any) {
          return {success: false, error: String(error?.message || error)};
        }
      },
    }),

    wait: defineTool({
      description: "Wait for a specified amount of time (seconds).",
      parameters: z.object({
        seconds: z.number().describe("Number of seconds to wait"),
      }),
      execute: async ({seconds}: {seconds: number}) => {
        try {
          console.log("Calling wait...");
          await delay(seconds * 1000);
          return {success: true, waited: seconds};
        } catch (error: any) {
          return {success: false, error: String(error?.message || error)};
        }
      },
    }),

    doubleClick: defineTool({
      description:
        "Double-click on a UI element by its text. Not yet implemented in v3.",
      parameters: z.object({
        text: z.string().describe("The text to double-click on"),
        retries: z.number().optional().default(2),
      }),
      execute: async ({text}: {text: string}) => {
        console.log("Calling doubleClick...");
        return {
          success: false,
          error: `doubleClick(\"${text}\") is not implemented in v3 yet (OCR not wired).`,
        };
      },
    }),

    taskComplete: defineTool({
      description:
        "Call this when the task is successfully completed. Provide a summary of what was accomplished.",
      parameters: z.object({
        summary: z.string().describe("Summary of what was accomplished"),
      }),
      execute: async ({summary}: {summary: string}) => {
        console.log("Calling taskComplete...");
        return {success: true, completed: true, summary};
      },
    }),
  } as const;
}
