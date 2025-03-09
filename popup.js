document.addEventListener('DOMContentLoaded', async () => {
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const messageDiv = document.getElementById('message');
  const imageTimeInput = document.getElementById('imageTime');
  const themeToggle = document.getElementById("themeToggle");
  const body = document.body;
  const videoPlayCount = document.getElementsByName("videoPlayCount");

  // Load theme from localStorage
  if (localStorage.getItem("theme") === "dark") {
      body.classList.add("dark-mode");
      themeToggle.checked = true;
  }

  themeToggle.addEventListener("change", () => {
      if (themeToggle.checked) {
          body.classList.add("dark-mode");
          localStorage.setItem("theme", "dark");
      } else {
          body.classList.remove("dark-mode");
          localStorage.setItem("theme", "light");
      }
  });
  
  // Set default button states
  startBtn.disabled = false;
  stopBtn.disabled = true;

  // Load saved settings
  chrome.storage.local.get(['imageTime', 'videoMultiplier', 'extensionState'], (result) => {
      if (result.imageTime) imageTimeInput.value = result.imageTime;
      
      // Check saved extension state and update button states accordingly
      if (result.extensionState === 'running') {
          startBtn.disabled = true;
          stopBtn.disabled = false;
      } else {
          startBtn.disabled = false;
          stopBtn.disabled = true;
      }
  });

  // Save settings when changed
  imageTimeInput.addEventListener('change', () => {
      const value = Math.max(1, parseFloat(imageTimeInput.value));
      imageTimeInput.value = value;
      chrome.storage.local.set({ imageTime: value });
  });

  // Check if we're on Instagram
  chrome.runtime.sendMessage({ action: "checkInstagram" }, async (response) => {
      if (!response.isInstagram) {
          startBtn.disabled = true;
          stopBtn.disabled = true;
          messageDiv.textContent = "Please open Instagram to use this extension";
          messageDiv.style.display = 'block';
          return;
      }

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Check if auto-scroll is currently running
      try {
          chrome.tabs.sendMessage(tab.id, { action: "getState" }, (response) => {
              if (chrome.runtime.lastError) {
                  // Content script might not be ready or other error
                  console.error("Error checking state:", chrome.runtime.lastError);
                  return;
              }
              
              if (response && response.isRunning) {
                  // Extension is currently running
                  startBtn.disabled = true;
                  stopBtn.disabled = false;
                  chrome.storage.local.set({ extensionState: 'running' });
              } else {
                  startBtn.disabled = false;
                  stopBtn.disabled = true;
              }
          });
      } catch (error) {
          console.error("Failed to check auto-scroll state:", error);
      }
    
      startBtn.addEventListener('click', async () => {
          try {
              // Get the selected video play count
              let videoMultiplier = 1;
              for (const radioButton of videoPlayCount) {
                  if (radioButton.checked) {
                      videoMultiplier = parseFloat(radioButton.value);
                      break;
                  }
              }
              
              const settings = {
                  imageTime: parseFloat(imageTimeInput.value),
                  videoMultiplier: videoMultiplier
              };
              
              // Check if we're starting fresh or resuming
              const action = await new Promise(resolve => {
                  chrome.storage.local.get(['extensionState'], (result) => {
                      resolve(result.extensionState === 'stopped' ? "resume" : "start");
                  });
              });
              
              await chrome.tabs.sendMessage(tab.id, { 
                  action: action,
                  settings
              });
              
              startBtn.disabled = true;
              stopBtn.disabled = false;
              chrome.storage.local.set({ extensionState: 'running' });
          } catch (error) {
              console.error("Failed to start auto-scroll:", error);
              messageDiv.textContent = "Error: Please refresh the page and try again";
              messageDiv.style.display = 'block';
          }
      });

      stopBtn.addEventListener('click', async () => {
          try {
              await chrome.tabs.sendMessage(tab.id, { action: "stop" });
              startBtn.disabled = false;  // Enable start after stopping
              stopBtn.disabled = true;
              chrome.storage.local.set({ extensionState: 'stopped' });
          } catch (error) {
              console.error("Failed to stop auto-scroll:", error);
              messageDiv.textContent = "Error: Please refresh the page and try again";
              messageDiv.style.display = 'block';
          }
      });
  });
});