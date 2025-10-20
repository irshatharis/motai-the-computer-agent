import screenshot from "screenshot-desktop";
import sharp from "sharp";
import fs from "fs/promises";
import path from "path";

/**
 * Captures the current screen and returns image buffer
 */
export async function captureScreen() {
  try {
    const img = await screenshot({format: "png"});
    return img;
  } catch (error) {
    console.error("Failed to capture screenshot:", error);
    throw error;
  }
}

/**
 * Saves screenshot to file
 */
export async function saveScreenshot(buffer, filename = "screenshot.png") {
  const outputDir = path.join(process.cwd(), "output");
  await fs.mkdir(outputDir, {recursive: true});

  const filepath = path.join(outputDir, filename);
  await fs.writeFile(filepath, buffer);
  return filepath;
}

/**
 * Gets screen dimensions
 */
export async function getScreenDimensions() {
  const img = await captureScreen();
  const metadata = await sharp(img).metadata();
  return {
    width: metadata.width,
    height: metadata.height,
  };
}
