import { callGeminiAPI } from './api.js';

// Cache subtitles to avoid re-generating for the same video URL
const subtitleCache = new Map();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'processSubtitles') {
        handleProcessSubtitles(request)
            .then(response => sendResponse(response))
            .catch(error => sendResponse({ success: false, error: error.message }));

        return true; // Indicates async response
    }
});

async function handleProcessSubtitles(request) {
    const { data, language, apiKey } = request;

    // Try cache first
    const cacheKey = `${data.videoUrl || 'local'}_${language}`;
    if (subtitleCache.has(cacheKey)) {
        return { success: true, subtitles: subtitleCache.get(cacheKey) };
    }

    try {
        // Call Gemini API directly
        const subtitles = await callGeminiAPI(apiKey, data, language);

        // Cache the result
        subtitleCache.set(cacheKey, subtitles);

        return { success: true, subtitles };
    } catch (error) {
        console.error('Error in processing subtitles:', error);
        throw error;
    }
}
