import {ComputerAgent} from "./agent";

const agent = new ComputerAgent();

const prompt = process.argv[2];

if (!prompt) {
  console.error("Please provide a prompt");
  process.exit(1);
}

const result = await agent.executeTask(prompt);
console.log(result);
