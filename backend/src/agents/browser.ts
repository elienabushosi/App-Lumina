/**
 * Playwright browser lifecycle management for the APEX agent.
 *
 * One shared Browser instance is launched on first use and reused across
 * all proposal jobs. Each job gets its own BrowserContext (isolated cookies,
 * storage, sessions). Contexts are closed after each job — the browser stays open.
 *
 * Session persistence: after a successful Salesforce login the context's
 * storage state is saved to SF_SESSION_DIR/{agentId}.json and restored on
 * the next run so the agent does not need to log in every time.
 */
import { chromium, type Browser, type BrowserContext } from 'playwright';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { env } from '../config/env.js';
import logger from '../lib/logger.js';

let browser: Browser | null = null;

function sessionPath(agentId: string): string {
  const dir = env.SF_SESSION_DIR;
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, `${agentId}.json`);
}

export async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    logger.info({ msg: 'Launching Chromium' });
    browser = await chromium.launch({
      headless: false, // TODO: switch back to true once session persistence is working
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    browser.on('disconnected', () => {
      logger.warn({ msg: 'Browser disconnected' });
      browser = null;
    });
  }
  return browser;
}

export async function newContext(agentId: string): Promise<BrowserContext> {
  const instance = await getBrowser();
  const session = sessionPath(agentId);
  const hasSession = existsSync(session);

  const context = await instance.newContext({
    viewport: { width: 1440, height: 900 },
    ...(hasSession && { storageState: session }),
  });

  logger.info({ msg: 'Browser context created', agentId, restoredSession: hasSession });
  return context;
}

export async function saveSession(context: BrowserContext, agentId: string): Promise<void> {
  const path = sessionPath(agentId);
  await context.storageState({ path });
  logger.info({ msg: 'Session saved', agentId, path });
}

export async function closeBrowser(): Promise<void> {
  if (browser?.isConnected()) {
    await browser.close();
    browser = null;
    logger.info({ msg: 'Browser closed' });
  }
}
