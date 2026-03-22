/**
 * Step 11 — Gemini Computer Use wrapper.
 *
 * Implements the correct multi-turn Computer Use loop:
 *   1. Send screenshot + goal to Gemini
 *   2. Gemini returns functionCall parts (click, type, scroll, etc.)
 *   3. Execute actions via Playwright, take new screenshot
 *   4. Send screenshot back as functionResponse
 *   5. Repeat until Gemini stops returning actions
 */
import { GoogleGenAI, Environment } from '@google/genai';
import type { Page } from 'playwright';
import { env } from '../config/env.js';
import logger from '../lib/logger.js';
import { startTimer } from '../lib/timer.js';

const MODEL = 'gemini-2.5-computer-use-preview-10-2025';
const MAX_ITERATIONS = 50;
const ACTION_DELAY_MS = 800;

export interface GeminiLoopOptions {
  maxIterations?: number;
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
  const viewport = page.viewportSize() ?? { width: 1440, height: 900 };

  const loopTimer = startTimer();
  logger.info({ proposalId, step: 'gemini', status: 'loop_started', goal: goal.slice(0, 80) });

  // Build initial prompt
  const systemPrompt = [
    options.context ? `Context:\n${options.context}\n` : '',
    `Goal: ${goal}`,
    '',
    'Never submit or save a form. Stop after the last field is filled.',
    `Screen resolution: ${viewport.width}x${viewport.height}`,
  ].filter(Boolean).join('\n');

  // Multi-turn conversation history
  const contents: Parameters<typeof ai.models.generateContent>[0]['contents'] = [];

  for (let i = 0; i < maxIter; i++) {
    // Take screenshot
    const screenshot = await page.screenshot({ type: 'png' });
    const b64 = screenshot.toString('base64');

    // Build user turn: first turn includes the goal, subsequent turns just the screenshot
    const userParts: object[] = [
      { inlineData: { mimeType: 'image/png', data: b64 } },
    ];
    if (i === 0) userParts.unshift({ text: systemPrompt });

    contents.push({ role: 'user', parts: userParts });

    // Call Gemini
    const response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: {
        tools: [{ computerUse: { environment: Environment.ENVIRONMENT_BROWSER } }],
        systemInstruction: i === 0 ? systemPrompt : undefined,
      },
    });

    const candidate = response.candidates?.[0];
    if (!candidate?.content) {
      logger.warn({ proposalId, step: 'gemini', msg: 'Empty response from Gemini', iteration: i + 1 });
      break;
    }

    // Add model response to conversation history
    contents.push({ role: 'model', parts: candidate.content.parts });

    // Extract function calls from response
    const functionCalls = candidate.content.parts?.filter((p: any) => p.functionCall) ?? [];

    if (functionCalls.length === 0) {
      logger.info({ proposalId, step: 'gemini', status: 'done', iteration: i + 1, durationMs: loopTimer(), msg: 'No more actions' });
      break;
    }

    const iterTimer = startTimer();
    logger.info({
      proposalId,
      step: 'gemini',
      iteration: i + 1,
      actions: functionCalls.map((p: any) => p.functionCall?.args?.action ?? p.functionCall?.name),
    });

    // Execute each action and collect results
    const functionResponses: object[] = [];

    for (const part of functionCalls as any[]) {
      const call = part.functionCall;
      const result = await executeComputerUseAction(page, call, proposalId);
      functionResponses.push({
        functionResponse: {
          name: call.name,
          response: {
            ...result,
            current_url: page.url(),
          },
        },
      });

      if (result.done) {
        logger.info({ proposalId, step: 'gemini', status: 'done', durationMs: loopTimer(), reason: 'action signalled done' });
        return;
      }
    }

    logger.info({ proposalId, step: 'gemini', iteration: i + 1, iterationMs: iterTimer() });
    await page.waitForTimeout(ACTION_DELAY_MS);

    // Add function responses as next user turn
    contents.push({ role: 'user', parts: functionResponses });
  }

  logger.warn({ proposalId, step: 'gemini', status: 'max_iterations_reached', maxIter });
}

// ── Execute a single Computer Use action ──────────────────────────────────────

async function executeComputerUseAction(
  page: Page,
  call: any,
  proposalId: string
): Promise<{ success: boolean; done?: boolean }> {
  const args = call.args ?? {};
  const action = args.action ?? call.name;

  try {
    switch (action) {
      case 'click': {
        const [x, y] = args.coordinate ?? [args.x, args.y];
        await page.mouse.click(x, y, { button: args.button ?? 'left' });
        break;
      }
      case 'double_click': {
        const [x, y] = args.coordinate ?? [args.x, args.y];
        await page.mouse.dblclick(x, y);
        break;
      }
      case 'type': {
        await page.keyboard.type(args.text ?? '', { delay: 40 });
        break;
      }
      case 'key': {
        await page.keyboard.press(args.key ?? args.text ?? '');
        break;
      }
      case 'scroll': {
        const [x, y] = args.coordinate ?? [args.x, args.y];
        await page.mouse.move(x, y);
        const delta = (args.amount ?? 3) * 100;
        await page.mouse.wheel(0, args.direction === 'up' ? -delta : delta);
        break;
      }
      case 'move': {
        const [x, y] = args.coordinate ?? [args.x, args.y];
        await page.mouse.move(x, y);
        break;
      }
      case 'screenshot': {
        // Gemini requesting a fresh screenshot — handled at top of next iteration
        break;
      }
      case 'done': {
        return { success: true, done: true };
      }
      default:
        logger.warn({ proposalId, step: 'gemini', msg: 'Unknown action', action });
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ proposalId, step: 'gemini', action, err: message });
    return { success: false };
  }
}
