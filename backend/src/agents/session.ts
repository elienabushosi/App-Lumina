/**
 * Step 10 — Session persistence + restore.
 *
 * Wraps browser.ts saveSession/newContext. Called by the APEX orchestrator:
 *   - Before login: newContext() restores saved session if one exists
 *   - After successful login: persistSession() saves the new state
 *   - One session file per agentId — never share sessions across agents
 */
import type { BrowserContext } from 'playwright';
import { existsSync } from 'fs';
import { join } from 'path';
import { env } from '../config/env.js';
import { newContext, saveSession } from './browser.js';
import logger from '../lib/logger.js';

export async function getContextForAgent(agentId: string): Promise<BrowserContext> {
  return newContext(agentId);
}

export async function persistSession(context: BrowserContext, agentId: string): Promise<void> {
  await saveSession(context, agentId);
}

export function hasSession(agentId: string): boolean {
  return existsSync(join(env.SF_SESSION_DIR, `${agentId}.json`));
}
