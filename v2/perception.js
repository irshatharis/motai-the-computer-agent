import {createWorker} from "tesseract.js";
import sharp from "sharp";
import screenshot from "screenshot-desktop";

/**
 * Fast perception layer using OCR
 * Extracts text and positions without sending to vision API
 */
export class PerceptionLayer {
  constructor() {
    this.worker = null;
    this.lastScreenshot = null;
    this.lastContext = null;
    this.cacheTimeout = 1500; // Cache for 1.5 seconds (more responsive)
    this.minConfidence = 75; // Higher confidence threshold for accuracy
  }

  /**
   * Initialize OCR worker with optimized settings
   */
  async init() {
    if (this.worker) return;

    console.log("🔧 Initializing OCR engine...");
    this.worker = await createWorker("eng", 1, {
      logger: () => {}, // Suppress logs
    });

    // Set parameters for better accuracy and speed
    await this.worker.setParameters({
      tessedit_pageseg_mode: "11", // Sparse text mode - faster
      preserve_interword_spaces: "1", // Keep spaces for better phrase detection
    });

    console.log("✓ OCR engine ready");
  }

  /**
   * Capture current screen
   */
  async captureScreen() {
    try {
      const img = await screenshot({format: "png"});

      if (!img || img.length === 0) {
        throw new Error("Screenshot capture returned empty buffer");
      }

      // Verify image is valid using sharp
      const metadata = await sharp(img).metadata();
      console.log(`📸 Captured screen: ${metadata.width}x${metadata.height}px`);

      if (!metadata.width || !metadata.height || metadata.width < 100) {
        throw new Error(
          `Invalid screen dimensions: ${metadata.width}x${metadata.height}`,
        );
      }

      this.lastScreenshot = img;
      return img;
    } catch (error) {
      console.error("Screenshot error:", error.message);
      throw new Error(`Failed to capture screen: ${error.message}`);
    }
  }

  /**
   * Get screen dimensions
   */
  async getScreenSize() {
    if (!this.lastScreenshot) {
      await this.captureScreen();
    }
    const metadata = await sharp(this.lastScreenshot).metadata();
    return {width: metadata.width, height: metadata.height};
  }

  /**
   * Extract text and positions from screen using OCR
   * This is MUCH faster than sending to vision API
   */
  async getScreenContext(forceRefresh = false) {
    await this.init();

    // Use cache if available and recent
    if (
      !forceRefresh &&
      this.lastContext &&
      Date.now() - this.lastContext.timestamp < this.cacheTimeout
    ) {
      console.log("📋 Using cached screen context");
      return this.lastContext;
    }

    console.log("📸 Capturing and analyzing screen...");
    const startTime = Date.now();

    // Capture screenshot
    let screenshot;
    try {
      screenshot = await this.captureScreen();
    } catch (error) {
      console.error("Failed to capture screen:", error.message);
      throw error;
    }

    // Run OCR with better recognition
    let ocrResult;
    try {
      ocrResult = await this.worker.recognize(screenshot);
    } catch (error) {
      console.error("OCR recognition failed:", error.message);
      throw new Error(`OCR failed: ${error.message}`);
    }

    const {
      data: {text, words, lines},
    } = ocrResult;

    // Ensure words is an array
    if (!words || !Array.isArray(words)) {
      console.warn("OCR returned no words");
      this.lastContext = {
        elements: [],
        phrases: [],
        allText: text || "",
        lines: [],
        timestamp: Date.now(),
        screenshot,
      };
      return this.lastContext;
    }

    // Extract meaningful text elements with positions
    const elements = words
      .filter((word) => {
        if (!word || !word.text || !word.bbox) return false;
        const cleaned = word.text.trim();
        // Higher confidence threshold and filter out single characters unless they're common UI elements
        return (
          cleaned.length > 0 &&
          word.confidence > this.minConfidence &&
          (cleaned.length > 1 || /[0-9+×=<>]/.test(cleaned))
        );
      })
      .map((word, idx) => ({
        id: idx + 1,
        text: word.text.trim(),
        // Use center point for coordinates
        x: Math.round(word.bbox.x0 + (word.bbox.x1 - word.bbox.x0) / 2),
        y: Math.round(word.bbox.y0 + (word.bbox.y1 - word.bbox.y0) / 2),
        bbox: {
          x: word.bbox.x0,
          y: word.bbox.y0,
          width: word.bbox.x1 - word.bbox.x0,
          height: word.bbox.y1 - word.bbox.y0,
        },
        confidence: Math.round(word.confidence),
        baseline: word.baseline, // Keep baseline for better grouping
      }));

    // Group nearby words into phrases (common UI pattern)
    const phrases = this.groupIntoElements(elements);

    const elapsed = Date.now() - startTime;
    console.log(
      `✓ Found ${elements.length} text elements in ${elapsed}ms (${phrases.length} interactive areas)`,
    );

    this.lastContext = {
      elements: elements || [],
      phrases: phrases || [],
      allText: text || "",
      lines: lines
        ? lines.map((l) => l.text.trim()).filter((t) => t.length > 0)
        : [],
      timestamp: Date.now(),
      screenshot,
    };

    return this.lastContext;
  }

  /**
   * Group nearby text elements into phrases/buttons
   * Uses smarter grouping based on vertical alignment and horizontal proximity
   */
  groupIntoElements(elements) {
    if (!elements || elements.length === 0) {
      return [];
    }

    const phrases = [];
    const used = new Set();

    // Sort by reading order (top to bottom, left to right)
    const sorted = [...elements].sort((a, b) => {
      if (Math.abs(a.y - b.y) < 10) return a.x - b.x;
      return a.y - b.y;
    });

    for (let i = 0; i < sorted.length; i++) {
      if (used.has(sorted[i].id)) continue;

      const group = [sorted[i]];
      used.add(sorted[i].id);

      // Find nearby elements on roughly the same line
      for (let j = i + 1; j < sorted.length; j++) {
        if (used.has(sorted[j].id)) continue;

        const horizontalDist = sorted[j].x - sorted[i].x;
        const verticalDist = Math.abs(sorted[j].y - sorted[i].y);

        // Group if:
        // - On same horizontal line (within 15px vertical)
        // - Close horizontally (within average character width * 3)
        const avgWidth =
          (sorted[i].bbox.width + sorted[j].bbox.width) / 2 || 10;
        const maxHorizontalGap = Math.max(avgWidth * 3, 30);

        if (verticalDist < 15 && horizontalDist < maxHorizontalGap) {
          group.push(sorted[j]);
          used.add(sorted[j].id);
        }
      }

      // Create phrase from group, sorted left to right
      group.sort((a, b) => a.x - b.x);
      const texts = group.map((e) => e.text).join(" ");
      const avgX = group.reduce((sum, e) => sum + e.x, 0) / group.length;
      const avgY = group.reduce((sum, e) => sum + e.y, 0) / group.length;

      // Calculate combined bounding box
      const minX = Math.min(...group.map((e) => e.bbox.x));
      const minY = Math.min(...group.map((e) => e.bbox.y));
      const maxX = Math.max(...group.map((e) => e.bbox.x + e.bbox.width));
      const maxY = Math.max(...group.map((e) => e.bbox.y + e.bbox.height));

      phrases.push({
        id: phrases.length + 1,
        text: texts,
        x: Math.round(avgX),
        y: Math.round(avgY),
        bbox: {
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
        },
        elements: group,
        confidence: Math.round(
          group.reduce((sum, e) => sum + e.confidence, 0) / group.length,
        ),
      });
    }

    return phrases;
  }

  /**
   * Find element by text with smart ranking
   * Returns best match based on exact match, word boundaries, and confidence
   */
  findElement(searchText) {
    if (!this.lastContext) {
      throw new Error(
        "No screen context available. Call getScreenContext() first.",
      );
    }

    const search = searchText.toLowerCase().trim();
    const searchWords = search.split(/\s+/);

    // Combine elements and phrases for searching
    const elements = this.lastContext.elements || [];
    const phrases = this.lastContext.phrases || [];

    const allCandidates = [
      ...elements.map((e) => ({...e, type: "element"})),
      ...phrases.map((p) => ({...p, type: "phrase"})),
    ];

    if (allCandidates.length === 0) {
      return null;
    }

    // Score each candidate
    const scored = allCandidates
      .map((candidate) => {
        const text = candidate.text.toLowerCase().trim();
        let score = 0;

        // Exact match (highest priority)
        if (text === search) {
          score += 1000;
        }
        // Exact word match
        else if (new RegExp(`\\b${this.escapeRegex(search)}\\b`).test(text)) {
          score += 500;
        }
        // Starts with search term
        else if (text.startsWith(search)) {
          score += 300;
        }
        // Contains search term
        else if (text.includes(search)) {
          score += 200;
        }
        // All search words present
        else if (searchWords.every((word) => text.includes(word))) {
          score += 150;
        }
        // Partial word matches
        else {
          const matchedWords = searchWords.filter((word) =>
            text.includes(word),
          ).length;
          score += matchedWords * 50;
        }

        // If no match at all, skip
        if (score === 0) return null;

        // Bonus for higher confidence
        score += (candidate.confidence || 80) / 10;

        // Slight bonus for phrases (usually more meaningful)
        if (candidate.type === "phrase") {
          score += 10;
        }

        // Penalty for very long text (less likely to be a button/link)
        if (text.length > 50) {
          score -= 20;
        }

        return {candidate, score};
      })
      .filter((item) => item !== null);

    // Sort by score and return best match
    scored.sort((a, b) => b.score - a.score);

    return scored.length > 0 ? scored[0].candidate : null;
  }

  /**
   * Escape special regex characters
   */
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Get text-only summary for LLM (fast, no image needed)
   */
  getTextSummary() {
    if (!this.lastContext) return "No screen context available.";
    if (!this.lastContext.phrases || this.lastContext.phrases.length === 0) {
      return "No text detected on screen.";
    }

    // Get unique phrases, prioritizing longer/more meaningful ones
    const phrases = this.lastContext.phrases
      .filter((p) => p && p.text && p.text.length > 2)
      .sort((a, b) => {
        // Sort by confidence and length
        const scoreA = (a.confidence || 80) + a.text.length;
        const scoreB = (b.confidence || 80) + b.text.length;
        return scoreB - scoreA;
      });

    if (phrases.length === 0) {
      return "No meaningful text detected on screen.";
    }

    const uniqueTexts = [...new Set(phrases.map((p) => p.text))];

    return uniqueTexts.slice(0, 60).join(" | "); // Limit to 60 most relevant
  }

  /**
   * Save current screenshot for debugging
   */
  async saveScreenshot(filename) {
    if (!this.lastScreenshot) return null;

    const fs = await import("fs/promises");
    const path = await import("path");

    const outputDir = path.join(process.cwd(), "output");
    await fs.mkdir(outputDir, {recursive: true});

    const filepath = path.join(outputDir, filename);
    await fs.writeFile(filepath, this.lastScreenshot);
    return filepath;
  }

  /**
   * Cleanup
   */
  async cleanup() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}
