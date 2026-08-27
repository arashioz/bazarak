const SmeeClient = require("smee-client");

const source = process.env.BAZAREK_SMEE_URL || "https://smee.io/OdOE95Y0uG9EwX4E";
const target = process.env.SMEE_TARGET || "http://localhost:3001/events";

const smee = new SmeeClient({
  source,
  target,
  logger: console,
});

const events = smee.start();

process.on("SIGINT", () => {
  events.close();
  process.exit(0);
});
