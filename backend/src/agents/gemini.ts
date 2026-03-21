/**
 * Step 11 — Gemini Computer Use wrapper.
 *
 * Runs the screenshot → Gemini → execute → repeat loop.
 * Playwright handles browser control; Gemini handles visual reasoning.
 *
 * Usage:
 *   await runGeminiLoop(page, 'Fill the Alta form with these values: ...', proposalId);
 */
import { GoogleGenAI } from '@google/genai';
import type { Page } from 'playwright';
import { env } from '../config/env.js';
import logger from '../lib/logger.js';

const MODEL = 'gemini-2.5-pro-preview-05-06';

const MAX_ITERATIONS = 50;
const ACTION_DELAY_MS = 500; // pause between actions so the page can settle

// ── Action types returned by Gemini ──────────────────────────────────────────

interface ClickAction   { action: 'click';      x: number; y: number; button?: 'left' | 'right' | 'middle' }
interface TypeAction    { action: 'type';        text: string }
interface ScrollAction  { action: 'scroll';      x: number; y: number; direction: 'up' | 'down'; amount: number }
interface KeyAction     { action: 'key';         key: string }
interface MoveAction    { action: 'move_mouse';  x: number; y: number }
interface DoneAction    { action: 'done';        reason?: string }

type AgentAction = ClickAction | TypeAction | ScrollAction | KeyAction | MoveAction | DoneAction;

// ── Main loop ─────────────────────────────────────────────────────────────────

export interface GeminiLoopOptions {
  maxIterations?: number;
  /** Extra context injected at the top of every prompt (e.g. form field values). */
  context?: string;
}

export async function runGeminiLoop(
  page: Page,
  goal: string,
  proposalId: string,
  options: GeminiLoopOptions = {}
): Promise<void> {
  if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');

  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const maxIter = options.maxIterations ?? MAX_ITERATIONS;

  logger.info({ proposalId, step: 'gemini', status: 'loop_started', goal: goal.slice(0, 80) });

  for (let i = 0; i < maxIter; i++) {
    const screenshot = await page.screenshot({ type: 'png' });
    const b64 = screenshot.toString('base64');

    const prompt = buildPrompt(goal, options.context, i);

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType: 'image/png', data: b64 } },
          ],
        },
      ],
    });

    const actions = parseActions(response.text ?? '');
    logger.info({ proposalId, step: 'gemini', iteration: i + 1, actions: actions.map(a => a.action) });

    for (const act of actions) {
      if (act.action === 'done') {
        logger.info({ proposalId, step: 'gemini', status: 'done', reason: act.reason });
        return;
      }
      await executeAction(page, act);
      await page.waitForTimeout(ACTION_DELAY_MS);
    }
  }

  logger.warn({ proposalId, step: 'gemini', status: 'max_iterations_reached', maxIter });
}

// ── Prompt builder ─────────────────────────────────────────────────────────────

function buildPrompt(goal: string, context: string | undefined, iteration: number): string {
  return [
    context ? `Context:\n${context}\n` : '',
    `Goal: ${goal}`,
    '',
    'You are controlling a browser. Look at the screenshot and decide the next action.',
    'Respond with a JSON array of actions. Each action must be one of:',
    '  {"action":"click",     "x":<number>, "y":<number>}',
    '  {"action":"type",      "text":"<string>"}',
    '  {"action":"scroll",    "x":<number>, "y":<number>, "direction":"up"|"down", "amount":<number>}',
    '  {"action":"key",       "key":"<key>"}   // e.g. "Enter", "Tab", "Escape"',
    '  {"action":"move_mouse","x":<number>, "y":<number>}',
    '  {"action":"done",      "reason":"<string>"}',
    '',
    'Rules:',
    '- Return ONLY the JSON array. No explanation, no markdown fences.',
    '- Use "done" as the last action when the goal is fully achieved.',
    '- Never submit or save a form. Stop after filling the last field.',
    '- If a field is already filled correctly, skip it.',
    `- Iteration: ${iteration + 1} of ${MAX_ITERATIONS}`,
  ]
    .filter(Boolean)
    .join('\n');
}

// ── Response parser ────────────────────────────────────────────────────────────

function parseActions(text: string): AgentAction[] {
  // Strip markdown fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim();
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed as AgentAction[];
    // Gemini sometimes returns a single object instead of an array
    if (typeof parsed === 'object') return [parsed as AgentAction];
  } catch {
    // Gemini returned prose — extract the first JSON array we can find
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      try { return JSON.parse(match[0]) as AgentAction[]; } catch { /* fall through */ }
    }
  }

  logger.warn({ step: 'gemini', msg: 'Could not parse actions from response', text: text.slice(0, 200) });
  return [];
}

// ── Action executor ────────────────────────────────────────────────────────────

async function executeAction(page: Page, action: AgentAction): Promise<void> {
  switch (action.action) {
    case 'click':
      await page.mouse.click(action.x, action.y, { button: action.button ?? 'left' });
      break;

    case 'type':
      await page.keyboard.type(action.text, { delay: 40 });
      break;

    case 'scroll':
      await page.mouse.move(action.x, action.y);
      await page.mouse.wheel(0, action.direction === 'down' ? action.amount : -action.amount);
      break;

    case 'key':
      await page.keyboard.press(action.key);
      break;

    case 'move_mouse':
      await page.mouse.move(action.x, action.y);
      break;

    case 'done':
      // Handled in the loop above — should not reach here
      break;
  }
}
