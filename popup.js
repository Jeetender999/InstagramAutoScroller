document.addEventListener('DOMContentLoaded', async () => {
    // Tab elements
    const feedTab = document.getElementById('feedTab');
    const reelTab = document.getElementById('reelTab');
    const feedContent = document.getElementById('feedContent');
    const reelContent = document.getElementById('reelContent');
    
    // Feed elements
    const startFeedBtn = document.getElementById('startFeedBtn');
    const stopFeedBtn = document.getElementById('stopFeedBtn');
    const imageTimeInput = document.getElementById('imageTime');
    const feedVideoPlayCount = document.getElementsByName("videoPlayCount");
    
    // Reel elements
    const startReelBtn = document.getElementById('startReelBtn');
    const stopReelBtn = document.getElementById('stopReelBtn');
    const reelPlayCount = document.getElementsByName("reelPlayCount");
    const scrollDirection = document.getElementsByName("scrollDirection");
    //const skipComments = document.getElementById('skipComments') || false;
    
    // Common elements
    const messageDiv = document.getElementById('message');
    const themeToggle = document.getElementById("themeToggle");
    const body = document.body;
  
    // Tab Switching Logic
    feedTab.addEventListener('click', () => {
      feedTab.classList.add('active');
      reelTab.classList.remove('active');
      feedContent.classList.add('active');
      reelContent.classList.remove('active');
      chrome.storage.local.set({ activeTab: 'feed' });
    });
  
    reelTab.addEventListener('click', () => {
      reelTab.classList.add('active');
      feedTab.classList.remove('active');
      reelContent.classList.add('active');
      feedContent.classList.remove('active');
      chrome.storage.local.set({ activeTab: 'reel' });
    });
  
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
    startFeedBtn.disabled = false;
    stopFeedBtn.disabled = true;
    startReelBtn.disabled = false;
    stopReelBtn.disabled = true;
  
    // Load saved settings
    chrome.storage.local.get([
      'imageTime', 
      'videoMultiplier', 
      'feedState', 
      'reelState', 
      'reelPlayCount', 
      'scrollDirection', 
      //'skipComments',
      'activeTab'
    ], (result) => {
      // Feed settings
      if (result.imageTime) imageTimeInput.value = result.imageTime;
      
      // Reel settings
      if (result.reelPlayCount) {
        for (const radio of reelPlayCount) {
          if (radio.value === String(result.reelPlayCount)) {
            radio.checked = true;
            break;
          }
        }
      }
      
      if (result.scrollDirection) {
        for (const radio of scrollDirection) {
          if (radio.value === result.scrollDirection) {
            radio.checked = true;
            break;
          }
        }
      }
      
    //   if (result.skipComments !== undefined) {
    //     skipComments.checked = result.skipComments;
    //   }
  
      // Set active tab
      if (result.activeTab === 'reel') {
        reelTab.click();
      }
      
      // Check saved extension states and update button states accordingly
      if (result.feedState === 'running') {
        startFeedBtn.disabled = true;
        stopFeedBtn.disabled = false;
      } else {
        startFeedBtn.disabled = false;
        stopFeedBtn.disabled = true;
      }
      
      if (result.reelState === 'running') {
        startReelBtn.disabled = true;
        stopReelBtn.disabled = false;
      } else {
        startReelBtn.disabled = false;
        stopReelBtn.disabled = true;
      }
    });
  
    // Save settings when changed
    imageTimeInput.addEventListener('change', () => {
      const value = Math.max(1, parseFloat(imageTimeInput.value));
      imageTimeInput.value = value;
      chrome.storage.local.set({ imageTime: value });
    });
    
    // Save reel settings
    for (const radio of reelPlayCount) {
      radio.addEventListener('change', () => {
        if (radio.checked) {
          chrome.storage.local.set({ reelPlayCount: parseInt(radio.value) });
        }
      });
    }
    
    for (const radio of scrollDirection) {
      radio.addEventListener('change', () => {
        if (radio.checked) {
          chrome.storage.local.set({ scrollDirection: radio.value });
        }
      });
    }
    
    // skipComments.addEventListener('change', () => {
    //   chrome.storage.local.set({ skipComments: skipComments.checked });
    // });
  
    // Check if we're on Instagram
    chrome.runtime.sendMessage({ action: "checkInstagram" }, async (response) => {
      if (!response.isInstagram) {
        startFeedBtn.disabled = true;
        stopFeedBtn.disabled = true;
        startReelBtn.disabled = true;
        stopReelBtn.disabled = true;
        messageDiv.textContent = "Please open Instagram to use this extension";
        messageDiv.style.display = 'block';
        return;
      }
  
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Check if auto-scroll is currently running
      try {
        // Check feed state
        chrome.tabs.sendMessage(tab.id, { action: "getState" }, (response) => {
          if (chrome.runtime.lastError) {
            console.error("Error checking feed state:", chrome.runtime.lastError);
            return;
          }
          
          if (response && response.isRunning) {
            startFeedBtn.disabled = true;
            stopFeedBtn.disabled = false;
            chrome.storage.local.set({ feedState: 'running' });
          } else {
            startFeedBtn.disabled = false;
            stopFeedBtn.disabled = true;
          }
        });
        
        // Check reel state
        chrome.tabs.sendMessage(tab.id, { action: "getReelState" }, (response) => {
          if (chrome.runtime.lastError) {
            console.error("Error checking reel state:", chrome.runtime.lastError);
            return;
          }
          
          if (response && response.isRunning) {
            startReelBtn.disabled = true;
            stopReelBtn.disabled = false;
            chrome.storage.local.set({ reelState: 'running' });
          } else {
            startReelBtn.disabled = false;
            stopReelBtn.disabled = true;
          }
        });
      } catch (error) {
        console.error("Failed to check auto-scroll state:", error);
      }
    
      // Feed buttons event listeners
      startFeedBtn.addEventListener('click', async () => {
        try {
          // Get the selected video play count
          let videoMultiplier = 1;
          for (const radioButton of feedVideoPlayCount) {
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
            chrome.storage.local.get(['feedState'], (result) => {
              resolve(result.feedState === 'stopped' ? "resume" : "start");
            });
          });
          
          await chrome.tabs.sendMessage(tab.id, { 
            action: action,
            settings
          });
          
          startFeedBtn.disabled = true;
          stopFeedBtn.disabled = false;
          chrome.storage.local.set({ feedState: 'running' });
        } catch (error) {
          console.error("Failed to start feed auto-scroll:", error);
          messageDiv.textContent = "Error: Please refresh the page and try again";
          messageDiv.style.display = 'block';
        }
      });
  
      stopFeedBtn.addEventListener('click', async () => {
        try {
          await chrome.tabs.sendMessage(tab.id, { action: "stop" });
          startFeedBtn.disabled = false;
          stopFeedBtn.disabled = true;
          chrome.storage.local.set({ feedState: 'stopped' });
        } catch (error) {
          console.error("Failed to stop feed auto-scroll:", error);
          messageDiv.textContent = "Error: Please refresh the page and try again";
          messageDiv.style.display = 'block';
        }
      });
      
      // Reel buttons event listeners
      startReelBtn.addEventListener('click', async () => {
        try {
          // Get reel settings
          let playCount = 1;
          for (const radio of reelPlayCount) {
            if (radio.checked) {
              playCount = parseInt(radio.value);
              break;
            }
          }
          
          let direction = "up";
          for (const radio of scrollDirection) {
            if (radio.checked) {
              direction = radio.value;
              break;
            }
          }
          
          const settings = {
            playCount: playCount,
            scrollDirection: direction,
           // skipWithComments: skipComments.checked
          };
          
          await chrome.tabs.sendMessage(tab.id, { 
            action: "startReels",
            settings
          });
          
          startReelBtn.disabled = true;
          stopReelBtn.disabled = false;
          chrome.storage.local.set({ reelState: 'running' });
        } catch (error) {
          console.error("Failed to start reel auto-scroll:", error);
          messageDiv.textContent = "Error: Please refresh the page and try again";
          messageDiv.style.display = 'block';
        }
      });
  
      stopReelBtn.addEventListener('click', async () => {
        try {
          await chrome.tabs.sendMessage(tab.id, { action: "stopReels" });
          startReelBtn.disabled = false;
          stopReelBtn.disabled = true;
          chrome.storage.local.set({ reelState: 'stopped' });
        } catch (error) {
          console.error("Failed to stop reel auto-scroll:", error);
          messageDiv.textContent = "Error: Please refresh the page and try again";
          messageDiv.style.display = 'block';
        }
      });
    });
  });