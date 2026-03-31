import { DEFAULT_API_KEY } from './config.js';

/**
 * Interacts directly with the Gemini API to generate or translate subtitles.
 */
export async function callGeminiAPI(apiKey, data, targetLanguage) {
    const key = apiKey || DEFAULT_API_KEY;
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;

    // We prompt Gemini to act as a subtitle generator based on the video context
    const prompt = `
You are an expert AI subtitle generator and translator. 
The user is watching a video titled: "${data.pageTitle}".
Video Duration: ${data.duration ? Math.floor(data.duration) + " seconds" : "Unknown"}.
Target Translation Language: ${targetLanguage}

Generate a dense subtitle track that spans the entire duration of the video. 
Provide at least one subtitle entry every 8-15 seconds for the duration of the video.
Make the subtitles highly realistic and synchronized with the provided title/context.
  `;

    const payload = {
        contents: [{
            parts: [{ text: prompt }]
        }],
        generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
            responseSchema: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        start: { type: "number", description: "Start time in seconds" },
                        end: { type: "number", description: "End time in seconds" },
                        text: { type: "string", description: "The subtitle text" }
                    },
                    required: ["start", "end", "text"]
                }
            }
        }
    };

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Gemini API Error: ${errorData.error?.message || response.statusText}`);
        }

        const json = await response.json();

        // Extract text from Gemini response structure
        // In structured mode, Gemini 1.5+ returns the JSON in the candidate text field
        const botText = json.candidates[0]?.content?.parts[0]?.text || "[]";

        // Structured mode often returns a direct JSON string
        const subtitles = JSON.parse(botText);

        if (!Array.isArray(subtitles)) {
            throw new Error('Gemini did not return an array');
        }

        return subtitles;
    } catch (error) {
        console.error("Gemini API call failed:", error);
        throw error;
    }
}
