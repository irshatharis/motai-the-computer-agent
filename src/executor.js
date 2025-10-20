import robot from "robotjs";

/**
 * Executes actions using robotjs
 */
export class ActionExecutor {
  constructor() {
    robot.setMouseDelay(50);
    robot.setKeyboardDelay(50);
  }

  /**
   * Clicks at specified coordinates
   */
  async click(x, y, button = "left") {
    console.log(`🖱️  Clicking at (${x}, ${y})`);

    // Move mouse to position
    robot.moveMouse(x, y);

    // Small delay to see the movement
    await this.sleep(200);

    // Click
    robot.mouseClick(button);

    // Wait after click for UI to respond
    await this.sleep(500);
  }

  /**
   * Double clicks at specified coordinates
   */
  async doubleClick(x, y) {
    console.log(`🖱️  Double-clicking at (${x}, ${y})`);
    robot.moveMouse(x, y);
    await this.sleep(200);
    robot.mouseClick("left", true); // true = double click
    await this.sleep(500);
  }

  /**
   * Types text
   */
  async type(text, delayBetweenKeys = 50) {
    console.log(`⌨️  Typing: "${text}"`);

    // Type each character with a small delay
    for (const char of text) {
      robot.typeString(char);
      await this.sleep(delayBetweenKeys);
    }

    await this.sleep(300);
  }

  /**
   * Presses a key
   */
  async pressKey(key, modifiers = []) {
    console.log(
      `⌨️  Pressing key: ${
        modifiers.length ? modifiers.join("+") + "+" : ""
      }${key}`,
    );

    if (modifiers.length > 0) {
      robot.keyTap(key, modifiers);
    } else {
      robot.keyTap(key);
    }

    await this.sleep(300);
  }

  /**
   * Scrolls in a direction
   */
  async scroll(direction = "down", amount = 5) {
    console.log(`📜 Scrolling ${direction}`);

    const magnitude = direction === "down" ? -amount : amount;
    robot.scrollMouse(0, magnitude);

    await this.sleep(500);
  }

  /**
   * Moves mouse to position
   */
  async moveTo(x, y) {
    console.log(`🖱️  Moving mouse to (${x}, ${y})`);
    robot.moveMouse(x, y);
    await this.sleep(200);
  }

  /**
   * Gets current mouse position
   */
  getMousePosition() {
    return robot.getMousePos();
  }

  /**
   * Gets screen size
   */
  getScreenSize() {
    return robot.getScreenSize();
  }

  /**
   * Helper function for delays
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
