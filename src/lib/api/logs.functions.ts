import { createServerFn } from "@tanstack/react-start";
import * as fs from "node:fs";
import * as path from "node:path";

export const getPlatformLogs = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const logPath = path.resolve(process.cwd(), "platform.log");
    if (!fs.existsSync(logPath)) {
      return { logs: "No logs recorded yet." };
    }

    // Read last 1000 lines or max 500KB to prevent overloading the browser
    const stats = await fs.promises.stat(logPath);
    const maxSize = 500 * 1024; // 500 KB
    if (stats.size > maxSize) {
      const fd = await fs.promises.open(logPath, "r");
      try {
        const buffer = Buffer.alloc(maxSize);
        const { bytesRead } = await fd.read(buffer, 0, maxSize, stats.size - maxSize);
        const truncated = buffer.toString("utf-8", 0, bytesRead);
        return { logs: `... [Truncated due to size] ...\n` + truncated };
      } finally {
        await fd.close();
      }
    }

    const logs = await fs.promises.readFile(logPath, "utf-8");
    return { logs };
  } catch (err: any) {
    return { logs: `Error reading logs: ${err.message}` };
  }
});

export const clearPlatformLogs = createServerFn({ method: "POST" }).handler(async () => {
  try {
    const logPath = path.resolve(process.cwd(), "platform.log");
    await fs.promises.writeFile(logPath, "", "utf-8");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});
