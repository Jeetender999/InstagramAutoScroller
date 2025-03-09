chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "checkInstagram") {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const isInstagram = tabs[0]?.url?.includes("instagram.com");
        sendResponse({ isInstagram });
      });
      return true;
    }
  });