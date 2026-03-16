/**
 * Deepgram transcription with speaker diarization.
 * Pre-recorded API: POST audio buffer, get back transcript with speaker labels.
 */

const DEEPGRAM_API_URL = "https://api.deepgram.com/v1/listen";

/**
 * Transcribe audio buffer with speaker diarization.
 * @param {Buffer | Uint8Array} audioBuffer - Raw audio (e.g. WAV, MP3 from RingCentral).
 * @param {string} [contentType] - Optional e.g. "audio/wav", "audio/mpeg". Omit for auto-detect.
 * @returns {Promise<{ transcript: string, words?: Array<{ word: string, speaker: number, start: number, end: number }> }>}
 */
export async function transcribeWithDiarization(audioBuffer, contentType = "audio/wav") {
	const apiKey = process.env.DEEPGRAM_API_KEY;
	if (!apiKey || apiKey === "placeholder") {
		throw new Error("DEEPGRAM_API_KEY is not set in environment.");
	}

	const params = new URLSearchParams({
		model: "nova-2",
		diarize: "true",
		punctuate: "true",
		smart_format: "true",
	});

	const url = `${DEEPGRAM_API_URL}?${params.toString()}`;
	const response = await fetch(url, {
		method: "POST",
		headers: {
			Authorization: `Token ${apiKey}`,
			"Content-Type": contentType,
		},
		body: audioBuffer,
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Deepgram API error ${response.status}: ${text}`);
	}

	const json = await response.json();
	const channel = json.results?.channels?.[0];
	const alternative = channel?.alternatives?.[0];
	if (!alternative) {
		return { transcript: "", words: [] };
	}

	const transcript = alternative.transcript ?? "";
	const words = (alternative.words ?? []).map((w) => ({
		word: w.punctuated_word ?? w.word ?? "",
		speaker: w.speaker ?? 0,
		start: w.start ?? 0,
		end: w.end ?? 0,
	}));

	return { transcript, words };
}
