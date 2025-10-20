import axios from "axios";
import fs from "fs/promises";

/**
 * OpenRouter client for vision models
 */
export class LLMClient {
  constructor(apiKey, model = "anthropic/claude-3.5-sonnet") {
    this.apiKey = apiKey;
    this.model = model;
    this.baseURL = "https://openrouter.ai/api/v1";
  }

  /**
   * Analyzes annotated screenshot and decides what action to take
   */
  async analyzeScreenshot(imageBuffer, task, elements) {
    // Convert image buffer to base64
    const base64Image = imageBuffer.toString("base64");

    // Create context about available elements
    const elementsList = elements
      .map((el) => `Element ${el.id}: Located at (${el.x}, ${el.y})`)
      .join("\n");

    const systemPrompt = `You are a computer use agent. You can control a computer by selecting numbered elements on the screen.

The user will provide a task and an annotated screenshot showing numbered elements you can interact with.

Your response MUST be a valid JSON object with this structure:
{
  "thinking": "brief explanation of your reasoning",
  "action": "click" | "type" | "scroll" | "wait" | "done",
  "elementId": number (which numbered element to interact with, required for click),
  "text": "text to type" (required if action is "type"),
  "scrollDirection": "up" | "down" (required if action is "scroll"),
  "reasoning": "why you chose this action"
}

If the task is complete, return action: "done".
If you need to wait for something to load, return action: "wait".

Available elements:
${elementsList}

Be precise and choose the most relevant element for the task.`;

    try {
      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: this.model,
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Task: ${task}\n\nAnalyze this screenshot and tell me what to do next. The image shows numbered elements you can interact with.`,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/png;base64,${base64Image}`,
                  },
                },
              ],
            },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        },
        {
          headers: {
            "Authorization": `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/try-robot-js",
            "X-Title": "Computer Use Agent",
          },
        },
      );

      const content = response.data.choices[0].message.content;

      // Try to parse JSON response
      let decision;
      try {
        // Sometimes LLMs wrap JSON in markdown code blocks
        const jsonMatch =
          content.match(/```json\n?([\s\S]*?)\n?```/) ||
          content.match(/```\n?([\s\S]*?)\n?```/);

        if (jsonMatch) {
          decision = JSON.parse(jsonMatch[1]);
        } else {
          decision = JSON.parse(content);
        }
      } catch (e) {
        console.error("Failed to parse LLM response as JSON:", content);
        throw new Error("LLM did not return valid JSON");
      }

      return decision;
    } catch (error) {
      if (error.response) {
        console.error("OpenRouter API error:", error.response.data);
        throw new Error(
          `API error: ${error.response.data.error?.message || "Unknown error"}`,
        );
      }
      throw error;
    }
  }

  /**
   * Simple text completion without vision
   */
  async complete(prompt) {
    try {
      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: this.model,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 500,
        },
        {
          headers: {
            "Authorization": `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        },
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error(
        "OpenRouter API error:",
        error.response?.data || error.message,
      );
      throw error;
    }
  }
}
