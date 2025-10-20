import sharp from "sharp";

/**
 * Annotates screenshot with numbered boxes for each interactive element
 */
export async function annotateScreenshot(imageBuffer, elements) {
  const metadata = await sharp(imageBuffer).metadata();
  const {width, height} = metadata;

  // Create SVG overlays for all elements
  const svgElements = elements
    .map((element) => {
      const {id, x, y, width: w, height: h} = element;

      // Box dimensions
      const boxX = Math.max(0, x - w / 2);
      const boxY = Math.max(0, y - h / 2);

      // Calculate font size based on box size
      const fontSize = Math.min(24, Math.max(12, h * 0.4));

      return `
      <!-- Element ${id} -->
      <rect
        x="${boxX}"
        y="${boxY}"
        width="${w}"
        height="${h}"
        fill="rgba(255, 0, 0, 0.15)"
        stroke="red"
        stroke-width="2"
      />
      <circle
        cx="${x}"
        cy="${y}"
        r="18"
        fill="red"
        opacity="0.9"
      />
      <text
        x="${x}"
        y="${y + fontSize / 3}"
        font-size="${fontSize}"
        font-weight="bold"
        fill="white"
        text-anchor="middle"
        font-family="Arial, sans-serif"
      >${id}</text>
    `;
    })
    .join("\n");

  const svg = `
    <svg width="${width}" height="${height}">
      ${svgElements}
    </svg>
  `;

  // Composite the SVG overlay onto the screenshot
  const annotatedImage = await sharp(imageBuffer)
    .composite([
      {
        input: Buffer.from(svg),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer();

  return annotatedImage;
}

/**
 * Creates a simpler annotation with just numbered circles
 */
export async function annotateWithNumbers(imageBuffer, elements) {
  const metadata = await sharp(imageBuffer).metadata();
  const {width, height} = metadata;

  const svgElements = elements
    .map((element) => {
      const {id, x, y} = element;

      return `
      <g>
        <circle
          cx="${x}"
          cy="${y}"
          r="20"
          fill="rgba(255, 50, 50, 0.85)"
          stroke="white"
          stroke-width="2"
        />
        <text
          x="${x}"
          y="${y + 7}"
          font-size="18"
          font-weight="bold"
          fill="white"
          text-anchor="middle"
          font-family="Arial, sans-serif"
        >${id}</text>
      </g>
    `;
    })
    .join("\n");

  const svg = `
    <svg width="${width}" height="${height}">
      ${svgElements}
    </svg>
  `;

  const annotatedImage = await sharp(imageBuffer)
    .composite([
      {
        input: Buffer.from(svg),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer();

  return annotatedImage;
}
