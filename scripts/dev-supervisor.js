const net = require("net");
const { spawn } = require("child_process");

const port = 3000;
const restartDelay = 2000;
let child;
let restartTimer;
let stopping = false;

function isPortOpen() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: "127.0.0.1" });
    socket.setTimeout(1000);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function startLoop() {
  if (stopping || await isPortOpen() || stopping) return;

  child = spawn("npm", ["run", "dev", "--", "-p", String(port)], {
    stdio: "inherit",
  });

  child.once("error", (error) => {
    console.error("Unable to start the Next.js dev server:", error);
  });

  child.once("close", (code, signal) => {
    child = undefined;
    if (stopping) return;
    console.error(
      `Next.js dev server exited (${signal || `code ${code}`}); retrying in ${restartDelay}ms.`,
    );
    restartTimer = setTimeout(startLoop, restartDelay);
  });
}

function stop(signal) {
  stopping = true;
  clearTimeout(restartTimer);
  if (child) child.kill(signal);
}

process.once("SIGINT", () => stop("SIGINT"));
process.once("SIGTERM", () => stop("SIGTERM"));

startLoop().catch((error) => {
  console.error("Unable to supervise the Next.js dev server:", error);
  process.exitCode = 1;
});
