document.addEventListener('DOMContentLoaded', async () => {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const messageDiv = document.getElementById('message');
  
    // Check if we're on Instagram
    chrome.runtime.sendMessage({ action: "checkInstagram" }, async (response) => {
      if (!response.isInstagram) {
        startBtn.disabled = true;
        stopBtn.disabled = true;
        messageDiv.style.display = 'block';
        return;
      }
  
      // Get the current tab to check if content script is loaded
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      startBtn.addEventListener('click', async () => {
        try {
          await chrome.tabs.sendMessage(tab.id, { action: "start" });
        } catch (error) {
          console.error("Failed to start auto-scroll:", error);
          messageDiv.textContent = "Error: Please refresh the page and try again";
          messageDiv.style.display = 'block';
        }
      });
  
      stopBtn.addEventListener('click', async () => {
        try {
          await chrome.tabs.sendMessage(tab.id, { action: "stop" });
        } catch (error) {
          console.error("Failed to stop auto-scroll:", error);
        }
      });
    });
  });
  