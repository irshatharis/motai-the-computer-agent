import sharp from "sharp";

/**
 * Detects interactive elements on screen using a grid-based approach
 * This is a simplified detector - in production you'd use OCR, accessibility APIs, etc.
 *
 * Strategy: Create a grid of points across the screen where user might click
 * and detect regions with high contrast (likely buttons/interactive elements)
 */
export async function detectElements(imageBuffer, options = {}) {
  const {
    gridSize = 20, // How many cells in the grid
    minArea = 400, // Minimum area for an element (pixels)
  } = options;

  const metadata = await sharp(imageBuffer).metadata();
  const {width, height} = metadata;

  // For POC: Create a grid-based detection system
  // We'll divide screen into regions and mark high-contrast areas
  const elements = [];

  // Simple approach: divide screen into a grid
  const cellWidth = Math.floor(width / gridSize);
  const cellHeight = Math.floor(height / gridSize);

  // Sample points across the screen
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const x = col * cellWidth + cellWidth / 2;
      const y = row * cellHeight + cellHeight / 2;

      // Skip edges (less likely to be interactive)
      if (x < 50 || y < 50 || x > width - 50 || y > height - 50) {
        continue;
      }

      // Create regions that might be interactive
      // In a real implementation, you'd use edge detection, OCR, or accessibility APIs
      elements.push({
        id: elements.length + 1,
        x: Math.floor(x),
        y: Math.floor(y),
        width: cellWidth - 10,
        height: cellHeight - 10,
        type: "interactive", // In reality: button, link, input, etc.
      });
    }
  }

  return elements;
}

/**
 * Smarter element detection using OCR-like regions
 * This creates elements at common UI locations
 */
export async function detectUIElements(imageBuffer) {
  const metadata = await sharp(imageBuffer).metadata();
  const {width, height} = metadata;

  // Common UI element positions (simplified for POC)
  const elements = [];

  // Top bar (browser controls, menu)
  for (let i = 0; i < 10; i++) {
    elements.push({
      id: elements.length + 1,
      x: 100 + i * 120,
      y: 60,
      width: 100,
      height: 40,
      type: "top-bar",
      description: "Top bar element",
    });
  }

  // Main content area - left side
  for (let i = 0; i < 8; i++) {
    elements.push({
      id: elements.length + 1,
      x: 150,
      y: 150 + i * 100,
      width: 200,
      height: 50,
      type: "content",
      description: "Left sidebar element",
    });
  }

  // Main content area - center
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 3; j++) {
      elements.push({
        id: elements.length + 1,
        x: 400 + j * 250,
        y: 150 + i * 100,
        width: 200,
        height: 50,
        type: "content",
        description: "Center content element",
      });
    }
  }

  // Right side
  for (let i = 0; i < 8; i++) {
    elements.push({
      id: elements.length + 1,
      x: width - 200,
      y: 150 + i * 100,
      width: 150,
      height: 50,
      type: "content",
      description: "Right sidebar element",
    });
  }

  return elements.filter((el) => el.x < width && el.y < height);
}
