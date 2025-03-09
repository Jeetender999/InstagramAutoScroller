// Global state for reels
const reelState = {
    isRunning: false,
    settings: {
      playCount: 1,
      scrollDirection: "up",
      skipWithComments: false
    }
  };
  
  // Selectors for reels
  const VIDEOS_LIST_SELECTOR = "main video";
  const COMMENTS_SELECTOR = ".BasePortal span";
  
  // Helper functions
  function sleep(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }
  
  function getCurrentVideo() {
    return Array.from(document.querySelectorAll(VIDEOS_LIST_SELECTOR)).find((video) => {
      const rect = video.getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= window.innerHeight;
    });
  }
  
  function checkIfCommentsAreOpen() {
    return document.querySelector(COMMENTS_SELECTOR)?.innerText?.length > 0;
  }
  
  async function endVideoEvent() {
    console.log({
      amountOfPlays: reelState.amountOfPlays,
      amountOfPlaysToSkip: reelState.settings.playCount,
      scrollDirection: reelState.settings.scrollDirection,
      applicationIsOn: reelState.isRunning,
      currentVideo: getCurrentVideo(),
    });
  
    const VIDEOS_LIST = Array.from(document.querySelectorAll(VIDEOS_LIST_SELECTOR));
    const currentVideo = getCurrentVideo();
    if (!currentVideo) return;
  
    if (!reelState.isRunning) {
      currentVideo.setAttribute("loop", "true");
      currentVideo.removeEventListener("ended", endVideoEvent);
      return;
    }
  
    reelState.amountOfPlays++;
    if (reelState.amountOfPlays < reelState.settings.playCount) return;
  
    const index = VIDEOS_LIST.findIndex((vid) => vid.src === currentVideo.src);
    let nextVideo = VIDEOS_LIST[index + (reelState.settings.scrollDirection === "down" ? 1 : -1)];
  
    if (!nextVideo) {
      console.log("⚠️ No next video found. Scrolling manually...");
      window.scrollBy({ 
        top: reelState.settings.scrollDirection === "down" ? window.innerHeight : -window.innerHeight, 
        behavior: "smooth" 
      });
      await sleep(1000);
      nextVideo = getCurrentVideo();
    }
  
    if (!reelState.settings.skipWithComments && checkIfCommentsAreOpen()) {
      currentVideo.pause();
      let checkInterval = setInterval(() => {
        if (!checkIfCommentsAreOpen()) {
          scrollToNextVideo(nextVideo);
          clearInterval(checkInterval);
        }
      }, 100);
    } else {
      scrollToNextVideo(nextVideo);
    }
  }
  
  function scrollToNextVideo(video) {
    if (video) {
      reelState.amountOfPlays = 0;
      video.scrollIntoView({ behavior: "smooth", block: "center" });
      console.log("🎥 Scrolled to next video");
    }
  }
  
  function startAutoScrolling() {
    reelState.isRunning = true;
    reelState.amountOfPlays = 0;
    console.log("🎯 Auto-scrolling enabled. Watching Instagram Reels hands-free! 🎥");
    
    // Start monitoring immediately
    const currentVideo = getCurrentVideo();
    if (currentVideo) {
      currentVideo.removeAttribute("loop");
      currentVideo.removeEventListener("ended", endVideoEvent);
      currentVideo.addEventListener("ended", endVideoEvent, { once: true });
    }
  }
  
  function stopAutoScrolling() {
    reelState.isRunning = false;
    const currentVideo = getCurrentVideo();
    if (currentVideo) {
      currentVideo.setAttribute("loop", "true");
      currentVideo.removeEventListener("ended", endVideoEvent);
    }
    console.log("⏹️ Auto-scrolling disabled.");
  }
  
  // Main loop to continuously monitor videos
  function monitorVideosLoop() {
    if (reelState.isRunning) {
      const currentVideo = getCurrentVideo();
      if (currentVideo) {
        // Only add the event listener if it doesn't already have one
        if (currentVideo.getAttribute("data-auto-scroll-monitored") !== "true") {
          currentVideo.removeAttribute("loop");
          currentVideo.removeEventListener("ended", endVideoEvent);
          currentVideo.addEventListener("ended", endVideoEvent, { once: true });
          currentVideo.setAttribute("data-auto-scroll-monitored", "true");
        }
      }
    }
    sleep(200).then(monitorVideosLoop);
  }
  
  // Initialize message listener for communication with popup
  function initializeReelMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "getReelState") {
        sendResponse({ isRunning: reelState.isRunning });
        return true;
      } else if (request.action === "startReels" && !reelState.isRunning) {
        reelState.settings = request.settings;
        startAutoScrolling();
        sendResponse({ status: "started" });
      } else if (request.action === "stopReels") {
        stopAutoScrolling();
        sendResponse({ status: "stopped" });
      }
      return true;
    });
  }
  
  // Initialize
  initializeReelMessageListener();
  monitorVideosLoop();
  console.log("📱 Instagram Reels Auto-Scroller initialized");