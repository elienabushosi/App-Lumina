/**
 * Claude helper for extracting structured lead data from call transcripts.
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
// Use the model string provided with your API key onboarding.
const MODEL = "claude-sonnet-4-20250514";

const SYSTEM_PROMPT = `
You are an assistant that extracts structured insurance lead data from phone call transcripts
between an insurance agent and a caller.

Return ONLY valid JSON with this exact shape (no comments, no extra keys):

{
  "lead": {
    "status": "new" | "existing_customer" | "not_a_lead",
    "name": {
      "full": string | null,
      "first": string | null,
      "last": string | null
    },
    "contact": {
      "primary_phone": string | null,
      "alternate_phone": string | null,
      "email": string | null,
      "preferred_channel": "phone" | "email" | "sms" | "unknown"
    },
    "address": {
      "street": string | null,
      "city": string | null,
      "state": string | null,
      "postal_code": string | null
    },
    "insurance": {
      "lines_of_business": [
        "auto" | "home" | "renters" | "life" | "commercial" | "workers_comp" | "other"
      ],
      "primary_line": "auto" | "home" | "renters" | "life" | "commercial" | "workers_comp" | "other" | "unknown",
      "current_carrier": string | null,
      "current_premium": number | null,
      "vehicles": [
        {
          "year": number | null,
          "make": string | null,
          "model": string | null
        }
      ],
      "properties": [
        {
          "type": "home" | "condo" | "renters" | "commercial" | "other" | "unknown",
          "address": string | null
        }
      ]
    },
    "intent": {
      "urgency": "high" | "medium" | "low" | "unknown",
      "primary_goal": "get_quote" | "policy_change" | "billing_issue" | "claim" | "other" | "unknown"
    },
    "notes": {
      "summary": string,
      "key_quotes": string[],
      "agent_actions": string[]
    },
    "meta": {
      "call_id": string | null,
      "call_direction": "inbound" | "outbound" | "unknown",
      "call_result": "accepted" | "missed" | "voicemail" | "other" | "unknown"
    }
  }
}

Rules:
- Use null for missing values.
- Do not invent specific details (names, numbers, addresses) that are not clearly stated.
- If the caller is not a sales lead (e.g., wrong number, spam, pure service question),
  set lead.status = "not_a_lead" and leave other fields null or empty arrays as appropriate.
- The JSON must be parseable by JSON.parse with no trailing commas.
`;

function buildUserMessage({ transcriptText, words, meta }) {
  return `
You are given a phone call transcript between an insurance agent and a caller.

Focus on the CUSTOMER's intent and information. Treat speaker 0 as the agent if unclear,
and speaker 1 as the customer. If the roles are obvious from the transcript, use that.

Call meta:
${JSON.stringify(meta ?? {}, null, 2)}

Transcript text:
${transcriptText}

Word-level data with speakers:
${JSON.stringify({ words: words ?? [] }, null, 2)}
`;
}

/**
 * Call Claude to extract lead JSON from transcript.
 * @param {{ transcript: string, words?: Array<{ word: string, speaker?: number }>, meta?: any }} input
 * @returns {Promise<{ lead: any }>}
 */
export async function extractLeadFromTranscript(input) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "placeholder") {
    throw new Error("ANTHROPIC_API_KEY is not set in environment.");
  }

  const body = {
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildUserMessage({
          transcriptText: input.transcript ?? "",
          words: input.words ?? [],
          meta: input.meta ?? {},
        }),
      },
    ],
  };

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Claude API error ${response.status}: ${text}`);
  }

  const json = await response.json();
  const contentText = json.content?.[0]?.text ?? "";

  let parsed;
  try {
    // Claude sometimes wraps JSON in ``` or ```json fences; strip them if present.
    let cleaned = contentText.trim();
    if (cleaned.startsWith("```")) {
      // Remove leading ``` or ```json line
      const firstNewline = cleaned.indexOf("\n");
      if (firstNewline !== -1) {
        cleaned = cleaned.slice(firstNewline + 1);
      }
      // Remove trailing ```
      const lastFence = cleaned.lastIndexOf("```");
      if (lastFence !== -1) {
        cleaned = cleaned.slice(0, lastFence);
      }
      cleaned = cleaned.trim();
    }

    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error("Claude response was not valid JSON: " + e.message);
  }

  if (!parsed || typeof parsed !== "object" || !parsed.lead) {
    throw new Error("Claude response JSON missing 'lead' object.");
  }

  return parsed;
}

