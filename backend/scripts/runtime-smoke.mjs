import { spawn } from "node:child_process";

const HOST = "127.0.0.1";
const PORT = Number(process.env.BACKEND_TEST_PORT || 3901);
const BASE_URL = `http://${HOST}:${PORT}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForApi(maxAttempts = 30) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(`${BASE_URL}/api`);
      if (response.ok) {
        return response;
      }
    } catch (_error) {
      // Server not ready yet.
    }
    await sleep(500);
  }
  throw new Error(`Backend API did not become ready on ${BASE_URL} within timeout`);
}

async function run() {
  const child = spawn("node", ["src/app.js"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(PORT), NODE_ENV: "test" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let startupLogs = "";
  child.stdout.on("data", (chunk) => {
    startupLogs += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    startupLogs += chunk.toString();
  });

  try {
    const response = await waitForApi();
    const payload = await response.json();

    if (!payload?.endpoints?.auth || !payload?.endpoints?.contracts) {
      throw new Error("Backend /api response missing expected endpoints");
    }

    console.log(`Backend runtime smoke test passed on ${BASE_URL}`);
  } catch (error) {
    throw new Error(`${error.message}\n\nCaptured startup logs:\n${startupLogs}`);
  } finally {
    child.kill("SIGTERM");
    await Promise.race([
      new Promise((resolve) => child.on("exit", resolve)),
      sleep(1500),
    ]);
    if (!child.killed) {
      child.kill("SIGKILL");
    }
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
