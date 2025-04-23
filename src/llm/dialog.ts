import fs from 'fs';
import path from 'path';

export function initializeLogFile(): string {
  const now = new Date();
  const timestamp = `${now.getDate().toString().padStart(2, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getFullYear()}-${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  return path.join(process.cwd(), `/logs/log.${timestamp}.json`);
}

export function logMessage(
  role: string,
  content: string,
  logFile: string,
  context?: Record<string, any>,
): void {
  const logDir = path.join(process.cwd(), '/logs');
  const message = {
    role,
    content,
    timestamp: new Date().toISOString(),
    context,
  };

  process.stdout.write(`\x1b[0m\x1b[2J\x1b[H${content}\n\n`);

  fs.mkdirSync(logDir, { recursive: true });
  let logContent: any[] = fs.existsSync(logFile)
    ? JSON.parse(fs.readFileSync(logFile, 'utf-8'))
    : [];
  logContent.push(message);
  fs.writeFileSync(logFile, JSON.stringify(logContent, null, 2));
}

export function getLatestAction(logFile: string, action: string): any | null {
  if (!fs.existsSync(logFile)) return null;
  const logContent = JSON.parse(fs.readFileSync(logFile, 'utf-8'));
  const actionLogs = logContent.filter(
    (entry) => entry.context && entry.context.action === action,
  );
  return actionLogs.length > 0
    ? actionLogs[actionLogs.length - 1].context
    : null;
}
