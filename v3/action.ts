import {
  screen,
  mouse,
  Point,
  Button,
  keyboard,
  Key,
  FileType,
} from "@kirillvakalov/nut-tree__nut-js";
import path from "node:path";
import {setTimeout} from "node:timers/promises";

export class Action {
  async leftClick() {
    await mouse.leftClick();
  }

  async rightClick() {
    await mouse.rightClick();
  }

  async leftDoubleClick() {
    await mouse.doubleClick(Button.LEFT);
  }

  async rightDoubleClick() {
    await mouse.doubleClick(Button.RIGHT);
  }

  async mouseMove(...args: [number, number][]) {
    const points = args.map(([x, y]) => new Point(x, y));
    await mouse.move(points);
  }

  async scrollUp(y: number) {
    await mouse.scrollUp(y);
  }

  async scrollDown(y: number) {
    await mouse.scrollDown(y);
  }

  async scrollLeft(x: number) {
    await mouse.scrollLeft(x);
  }

  async scrollRight(x: number) {
    await mouse.scrollRight(x);
  }

  async typeString(string: string) {
    await keyboard.type(string);
  }

  async pressKey(...keys: Key[]) {
    await keyboard.pressKey(...keys);
  }

  /**
   * Capture the screen and save it to the output folder
   * @returns The path to the captured screen
   */
  async captureScreen() {
    const imgPath = await screen.capture(
      `result-${Date.now()}`,
      FileType.PNG,
      path.join(process.cwd(), "output"),
    );

    return imgPath;
  }

  async setPointerPosition(x: number, y: number) {
    const point = new Point(x, y);
    await mouse.setPosition(point);
  }

  async getScreenSize() {
    const [width, height] = await Promise.all([
      screen.width(),
      screen.height(),
    ]);

    return {width, height};
  }
}

const action = new Action();

await setTimeout(5000);
await action.captureScreen();
