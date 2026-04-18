import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

const args = process.argv.slice(2);
const transportIdx = args.indexOf("--transport");
const transport = transportIdx >= 0 ? args[transportIdx + 1] : "stdio";

async function main() {
  const server = createServer();

  if (transport === "stdio") {
    const stdioTransport = new StdioServerTransport();
    await server.connect(stdioTransport);
  } else {
    console.error("streamable-http transport is not yet implemented in Node.js version. Use stdio.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
