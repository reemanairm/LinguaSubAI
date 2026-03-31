let currentVideo = null;
let subtitleContainer = null;
let subtitleData = [];
let isEnabled = true;
let syncInterval = null;

// Listen for messages from the popup or background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'ping') {
        sendResponse({ success: true });
        return;
    }

    if (request.action === 'extractAudioOrTranscript') {
        const video = findMainVideo();
        if (!video) {
            sendResponse(null);
            return;
        }
        currentVideo = video;

        const data = {
            videoUrl: window.location.href,
            videoSrc: video.src || video.currentSrc,
            pageTitle: document.title,
            duration: video.duration || 0,
            currentTime: video.currentTime || 0
        };
        sendResponse({ success: true, data });
    }

    else if (request.action === 'displaySubtitles') {
        subtitleData = request.subtitles;
        isEnabled = true;
        createSubtitleContainer();
        startSyncing();
    }

    else if (request.action === 'toggleSubtitles') {
        isEnabled = request.enabled;
        if (subtitleContainer) {
            subtitleContainer.style.display = isEnabled ? 'flex' : 'none';
        }
        if (isEnabled && subtitleData.length > 0) {
            startSyncing();
        } else {
            stopSyncing();
        }
    }

    else if (request.action === 'changeLanguage') {
        // If the language changes, we typically want to instruct the background to fetch new subs.
        // In our popup.js, the user has to click "Generate" again, so we don't necessarily need to handle it here.
        // But if we wanted auto-switch, we'd trigger a fetch here.
    }
});

// Helper: Find the largest/most likely main video on the page
function findMainVideo() {
    let videos = Array.from(document.querySelectorAll('video'));

    // Check Shadow DOMs (common on YouTube and other modern sites)
    const allNodes = document.querySelectorAll('*');
    for (const node of allNodes) {
        if (node.shadowRoot) {
            const shadowVideos = Array.from(node.shadowRoot.querySelectorAll('video'));
            videos = videos.concat(shadowVideos);
        }
    }

    if (videos.length === 0) {
        const iframes = document.querySelectorAll('iframe');
        for (let frame of iframes) {
            try {
                const frameSubs = Array.from(frame.contentDocument.querySelectorAll('video'));
                videos = videos.concat(frameSubs);
            } catch (e) {
                // Ignore cross-origin frame errors
            }
        }
    }

    // Filter out videos with no width/height
    videos = videos.filter(v => v.clientWidth > 0 || v.clientHeight > 0);

    if (videos.length === 0) return null;

    // Sort by dimensions to find the main player
    return videos.sort((a, b) => (b.clientWidth * b.clientHeight) - (a.clientWidth * a.clientHeight))[0];
}

function createSubtitleContainer() {
    if (subtitleContainer) {
        subtitleContainer.remove();
    }

    if (!currentVideo) {
        currentVideo = findMainVideo();
    }
    if (!currentVideo) return;

    // Search for the best parent (player container)
    // On YouTube this is often .html5-video-player or similar
    let videoParent = currentVideo.parentElement;
    const playerSelectors = ['.html5-video-player', '.video-player', '.player-container', '#player-api'];
    
    for (const selector of playerSelectors) {
        const container = currentVideo.closest(selector);
        if (container) {
            videoParent = container;
            break;
        }
    }

    // Create UI
    subtitleContainer = document.createElement('div');
    subtitleContainer.className = 'ai-subtitle-overlay';
    subtitleContainer.style.display = isEnabled ? 'flex' : 'none';

    // Ensure relative positioning for correct absolute overlay
    if (getComputedStyle(videoParent).position === 'static') {
        videoParent.style.position = 'relative';
    }

    const textElement = document.createElement('span');
    textElement.className = 'ai-subtitle-text';
    textElement.innerText = '';

    subtitleContainer.appendChild(textElement);
    videoParent.appendChild(subtitleContainer);

    // Initial size match
    syncOverlaySize();

    // Observer to handle video resizes and keep subtitles looking good
    const resizeObserver = new ResizeObserver(() => syncOverlaySize());
    resizeObserver.observe(currentVideo);
}

function syncOverlaySize() {
    if (!subtitleContainer || !currentVideo) return;
    subtitleContainer.style.width = currentVideo.clientWidth + 'px';
    subtitleContainer.style.left = currentVideo.offsetLeft + 'px';
}

function startSyncing() {
    stopSyncing();
    if (!currentVideo || subtitleData.length === 0) return;

    const updateSubs = () => {
        if (!isEnabled) return;

        const currentTime = currentVideo.currentTime;

        // Find active subtitle
        const activeSub = subtitleData.find(sub => currentTime >= sub.start && currentTime <= sub.end);

        if (subtitleContainer) {
            const textNode = subtitleContainer.querySelector('.ai-subtitle-text');
            if (textNode) {
                if (activeSub) {
                    textNode.innerText = activeSub.text;
                    textNode.style.opacity = '1';
                } else {
                    textNode.innerText = '';
                    textNode.style.opacity = '0';
                }
            }
        }

        syncInterval = requestAnimationFrame(updateSubs);
    };

    syncInterval = requestAnimationFrame(updateSubs);
}

function stopSyncing() {
    if (syncInterval) {
        cancelAnimationFrame(syncInterval);
        syncInterval = null;
    }
}
