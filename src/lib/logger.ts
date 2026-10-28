import * as fs from "node:fs";
import * as path from "node:path";

const LOG_FILE_PATH = path.resolve(process.cwd(), "platform.log");

function formatMessage(level: string, message: string, context?: any): string {
  const timestamp = new Date().toISOString();
  let contextStr = "";
  if (context !== undefined) {
    if (context instanceof Error) {
      contextStr = `\nStack: ${context.stack || context.message}`;
    } else {
      try {
        contextStr = ` | Context: ${JSON.stringify(context)}`;
      } catch {
        contextStr = ` | Context: [Unable to serialize]`;
      }
    }
  }
  return `[${timestamp}] [${level}] ${message}${contextStr}\n`;
}

export async function writeLog(
  level: "INFO" | "WARNING" | "ERROR",
  message: string,
  context?: any,
) {
  const formatted = formatMessage(level, message, context);

  // Print to console too so it shows in terminal
  if (level === "ERROR") {
    console.error(formatted.trim());
  } else if (level === "WARNING") {
    console.warn(formatted.trim());
  } else {
    console.log(formatted.trim());
  }

  try {
    await fs.promises.appendFile(LOG_FILE_PATH, formatted, "utf-8");
  } catch (err) {
    console.error("Failed to write to log file:", err);
  }
}

export function logInfo(message: string, context?: any) {
  return writeLog("INFO", message, context);
}

export function logWarning(message: string, context?: any) {
  return writeLog("WARNING", message, context);
}

export function logError(message: string, context?: any) {
  return writeLog("ERROR", message, context);
}
