import { generateSRT, generateVTT } from '../utils/subtitleGenerator.js';

document.addEventListener('DOMContentLoaded', () => {
  const toggleExt = document.getElementById('toggle-extension');
  const targetLang = document.getElementById('target-language');
  const generateBtn = document.getElementById('generate-btn');
  const btnText = document.querySelector('.btn-text') || { classList: { add: () => {}, remove: () => {} } }; // Fallback if needed
  const spinner = document.getElementById('loading-spinner');
  const statusMsg = document.getElementById('status-message');
  const downloadSection = document.getElementById('download-section');
  const downloadSrt = document.getElementById('download-srt');
  const downloadVtt = document.getElementById('download-vtt');

  let currentSubtitles = null;

  // Load saved settings
  chrome.storage.sync.get(['enabled', 'targetLanguage', 'subtitles'], (res) => {
    if (res.enabled !== undefined) toggleExt.checked = res.enabled;
    if (res.targetLanguage) targetLang.value = res.targetLanguage;
    
    if (res.subtitles) {
      currentSubtitles = res.subtitles;
      showDownloadOptions();
    }
  });

  // Save settings on change
  toggleExt.addEventListener('change', () => {
    chrome.storage.sync.set({ enabled: toggleExt.checked });
    sendMessageToActiveTab({ action: 'toggleSubtitles', enabled: toggleExt.checked });
  });

  targetLang.addEventListener('change', () => {
    chrome.storage.sync.set({ targetLanguage: targetLang.value });
  });

  generateBtn.addEventListener('click', () => {
    setLoading(true);
    showStatus('Detecting video and extracting...', '');

    // Step 1: Tell content script to extract transcript or audio info
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];

      // Prevent running on restricted pages like chrome://
      if (activeTab.url.startsWith('chrome://')) {
        setLoading(false);
        showStatus('Extensions cannot run on chrome:// pages. Go to a video page!', 'error');
        return;
      }

      function attemptExtraction() {
        chrome.tabs.sendMessage(activeTab.id, { action: 'extractAudioOrTranscript' }, (response) => {
          if (chrome.runtime.lastError || !response) {
            setLoading(false);
            showStatus('Could not find a video. Make sure a video is on the page and refresh the tab!', 'error');
            return;
          }

          showStatus('Generating subtitles via AI...', '');

          // Step 2: Send to background to process via Gemini API
          chrome.runtime.sendMessage({
            action: 'processSubtitles',
            data: response.data,
            language: targetLang.value
          }, (res) => {
            setLoading(false);
            if (res && res.success) {
              currentSubtitles = res.subtitles;
              chrome.storage.sync.set({ subtitles: currentSubtitles });
              showStatus('Subtitles ready in selected language.', 'success');
              showDownloadOptions();
              sendMessageToActiveTab({ action: 'displaySubtitles', subtitles: currentSubtitles });
            } else {
              showStatus('Failed to generate subtitles: ' + (res ? res.error : 'Unknown error'), 'error');
            }
          });
        });
      }

      // Try sending a ping message first to see if content script is loaded
      chrome.tabs.sendMessage(activeTab.id, { action: 'ping' }, (response) => {
        if (chrome.runtime.lastError) {
          // Script not injected yet (probably tab opened before extension installed). 
          // Inject it dynamically!
          chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            files: ['content/content.js']
          }).then(() => {
            chrome.scripting.insertCSS({
              target: { tabId: activeTab.id },
              files: ['content/overlay.css']
            }).then(() => {
              // Wait a tiny bit for it to initialize
              setTimeout(attemptExtraction, 100);
            });
          }).catch(err => {
            setLoading(false);
            showStatus('Please refresh the page to use the extension here.', 'error');
          });
        } else {
          attemptExtraction();
        }
      });
    });
  });

  function setLoading(isLoading) {
    if (isLoading) {
      btnText.classList.add('hidden');
      spinner.classList.remove('hidden');
      generateBtn.disabled = true;
    } else {
      btnText.classList.remove('hidden');
      spinner.classList.add('hidden');
      generateBtn.disabled = false;
    }
  }

  function showStatus(text, type) {
    statusMsg.textContent = text;
    statusMsg.className = 'status-msg';
    if (type === 'success') statusMsg.classList.add('status-success');
    if (type === 'error') statusMsg.classList.add('status-error');
    statusMsg.classList.remove('hidden');
  }

  function showDownloadOptions() {
    downloadSection.classList.remove('hidden');
  }

  downloadSrt.addEventListener('click', () => {
    if (!currentSubtitles) return;
    const srtContent = generateSRT(currentSubtitles);
    downloadFile(srtContent, 'subtitles.srt', 'text/plain');
  });

  downloadVtt.addEventListener('click', () => {
    if (!currentSubtitles) return;
    const vttContent = generateVTT(currentSubtitles);
    downloadFile(vttContent, 'subtitles.vtt', 'text/vtt');
  });

  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function sendMessageToActiveTab(msg) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, msg);
    });
  }
});
