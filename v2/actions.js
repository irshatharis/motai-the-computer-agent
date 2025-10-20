import robot from "robotjs";

/**
 * Fast action executor
 * Simple, focused, optimized for accuracy and speed
 */
export class ActionLayer {
  constructor(options = {}) {
    // Lower mouse speed = faster movement (counter-intuitive but that's how robotjs works)
    this.mouseSpeed = options.mouseSpeed || 1;
    // Lower keyboard delay = faster typing
    this.typingSpeed = options.typingSpeed || 10;

    robot.setMouseDelay(this.mouseSpeed);
    robot.setKeyboardDelay(this.typingSpeed);

    // Runtime self-checks for accessibility (best-effort)
    try {
      const screen = robot.getScreenSize();
      if (!screen || !screen.width || !screen.height) {
        console.warn(
          "⚠️  RobotJS screen size unavailable. Mouse actions may not work.",
        );
      }
      const pos = robot.getMousePos();
      if (!pos || typeof pos.x !== "number" || typeof pos.y !== "number") {
        console.warn(
          "⚠️  RobotJS cannot read mouse position. Check accessibility permissions.",
        );
      }
    } catch (e) {
      console.warn(
        "⚠️  RobotJS initialization warning:",
        e?.message || e,
        "\n   On macOS, enable: System Settings > Privacy & Security > Accessibility and Screen Recording",
      );
    }
  }

  /**
   * Click at coordinates with smooth movement
   */
  click(x, y, button = "left") {
    console.log(`🖱️  Click (${x}, ${y})`);
    // Smooth mouse movement for better accuracy
    robot.moveMouse(x, y);
    // Small delay to ensure mouse is in position
    robot.setMouseDelay(2);
    robot.mouseClick(button);
    robot.setMouseDelay(this.mouseSpeed);
    return {success: true, action: "click", x, y};
  }

  /**
   * Double click
   */
  doubleClick(x, y) {
    console.log(`🖱️  Double-click (${x}, ${y})`);
    robot.moveMouse(x, y);
    robot.mouseClick("left", true);
    return {success: true, action: "doubleClick", x, y};
  }

  /**
   * Type text
   */
  type(text) {
    console.log(`⌨️  Type: "${text}"`);
    robot.typeString(text);
    return {success: true, action: "type", text};
  }

  /**
   * Press key with optional modifiers
   */
  pressKey(key, modifiers = []) {
    const modStr = modifiers.length ? modifiers.join("+") + "+" : "";
    console.log(`⌨️  Press: ${modStr}${key}`);

    if (modifiers.length > 0) {
      robot.keyTap(key, modifiers);
    } else {
      robot.keyTap(key);
    }
    return {success: true, action: "pressKey", key, modifiers};
  }

  /**
   * Scroll
   */
  scroll(direction = "down", amount = 3) {
    console.log(`📜 Scroll ${direction}`);
    const magnitude = direction === "down" ? -amount : amount;
    robot.scrollMouse(0, magnitude);
    return {success: true, action: "scroll", direction};
  }

  /**
   * Move mouse
   */
  moveMouse(x, y) {
    robot.moveMouse(x, y);
    return {success: true, action: "moveMouse", x, y};
  }

  /**
   * Get current mouse position
   */
  getMousePosition() {
    return robot.getMousePos();
  }

  /**
   * Get screen size
   */
  getScreenSize() {
    return robot.getScreenSize();
  }

  /**
   * Wait/sleep (minimized logging for cleaner output)
   */
  async wait(ms) {
    if (ms >= 500) {
      console.log(`⏳ Wait ${ms}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, ms));
    return {success: true, action: "wait", ms};
  }
}
