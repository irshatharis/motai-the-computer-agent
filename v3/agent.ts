import {createOpenRouter} from "@openrouter/ai-sdk-provider";
import {generateText, stepCountIs} from "ai";
import {createTools} from "./tools";
import {Action} from "./action";

export class ComputerAgent {
  openRouter: ReturnType<typeof createOpenRouter>;
  action: Action;

  constructor() {
    this.action = new Action();
    this.openRouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
    });
  }

  async executeTask(task: string) {
    const {text} = await generateText({
      model: this.openRouter.chat("anthropic/claude-3.5-sonnet"),
      system: `
      You are a computer use agent that can control a computer like a human.
      You have access to tools that let you:
      - See what's on screen (text-based OCR, very fast)
      - Click on elements by their text (uses smart matching)
      - Type text and press keys (including keyboard shortcuts)
      - Scroll, wait, and more
      You will be given a task and you will need to complete it using the tools available to you.
      `,
      prompt: task,
      tools: createTools(this.action),
      stopWhen: stepCountIs(20),
    });

    return text;
  }
}
