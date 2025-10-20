# Computer Use Agent

A computer use agent that can control your computer like a human - click, type, navigate - anything you can do with keyboard and mouse.

## 🚀 V2 Available! (Recommended)

**V2 is 10x faster and 50x cheaper than V1!**

- ⚡ **0.5s per action** (vs 5s in V1)
- 💰 **$0.0003 per task** (vs $0.05 in V1)
- 🎯 **OCR-based** perception (no vision API needed)
- 🛠️ **Tool calling** with ai-sdk

👉 **[Quick Start V2](QUICKSTART-V2.md)** - Get started in 5 minutes

👉 **[Full V2 Docs](README-V2.md)** - Complete guide

👉 **[Migration Guide](MIGRATION.md)** - V1 → V2

## Choose Your Version

### V2 (Recommended) ⭐

**Best for:** Most use cases, speed, cost-efficiency

```bash
npm run test:v2          # Test OCR
npm run demo:v2 "task"   # Run agent
```

**How it works:** OCR + Tool Calling

- Screenshot → Tesseract OCR (200ms)
- Extract text + positions locally
- LLM uses tools to control computer
- Text-based, super fast, very cheap

### V1 (Vision-based)

**Best for:** Icon-only UIs, complex visual layouts

```bash
npm run test            # Test screenshots
npm run demo "task"     # Run agent
```

**How it works:** Annotated Screenshots

1. **Capture** - Takes a screenshot of your screen
2. **Detect** - Identifies potential interactive elements (buttons, links, etc.)
3. **Annotate** - Overlays numbered labels on each element
4. **Analyze** - Sends annotated image to a vision LLM (Claude/GPT-4V)
5. **Execute** - LLM picks a number, agent executes the action using RobotJS

This is the same approach used by Anthropic's Claude Computer Use.

## Setup

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Get an OpenRouter API key:**

   - Visit https://openrouter.ai/keys
   - Create an account and generate an API key

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env and add your OPENROUTER_API_KEY
   ```

## Usage

### Test Screenshot System

First, verify the screenshot and annotation system works:

```bash
node test-screenshot.js
```

This will create `output/test-annotated.png` showing numbered elements on your screen.

### Run the Agent

```bash
# Basic usage
node demo.js "your task here"

# Examples
node demo.js "Click on the search bar"
node demo.js "Find and click the settings button"
node demo.js "Open a new browser tab"
```

### Options

Edit `demo.js` to customize:

- `maxSteps`: Maximum number of steps (default: 10)
- `stepDelay`: Delay between steps in ms (default: 2000)
- `model`: LLM model to use (default: claude-3.5-sonnet)

## Project Structure

```
src/
├── screenshot.js   - Screen capture using screenshot-desktop
├── detector.js     - Element detection (grid-based for POC)
├── annotator.js    - Overlay numbers on screenshots using Sharp
├── llm-client.js   - OpenRouter API integration
├── executor.js     - Execute actions with RobotJS
└── agent.js        - Main agent loop
```

## Debugging

All annotated screenshots are saved to `./output/` with step numbers. Check these to see what the LLM saw at each step.

## Limitations (POC)

- **Element detection** is grid-based (simplified). Production would use:
  - OCR for text detection
  - Accessibility APIs for UI elements
  - Edge detection for buttons
- **No error recovery** yet
- **Fixed grid** doesn't adapt to actual UI layout
- **macOS permissions** required (Accessibility + Screen Recording)

## Improvements for Production

1. **Better Element Detection:**

   - Integrate OCR (Tesseract.js)
   - Use OS accessibility APIs
   - Computer vision for UI element detection

2. **Smarter Annotation:**

   - Only annotate truly interactive elements
   - Group related elements
   - Better positioning to avoid overlaps

3. **Memory & Context:**

   - Remember previous actions
   - Learn from failures
   - Build a task plan before executing

4. **Safety:**
   - Whitelist allowed actions
   - Confirmation for destructive operations
   - Sandboxing

## Models

Recommended models via OpenRouter:

- `anthropic/claude-3.5-sonnet` (best for computer use)
- `openai/gpt-4-vision-preview` (good alternative)
- `google/gemini-pro-vision` (budget option)

Check https://openrouter.ai/models for all available vision models.

## License

MIT
