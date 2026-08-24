import { config as loadEnvironment } from "dotenv";

loadEnvironment({ path: ".env.acceptance.local", quiet: true });
loadEnvironment({ path: ".env", quiet: true });
