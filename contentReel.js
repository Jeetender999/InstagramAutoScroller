// Global state for reels
const reelState = {
    isRunning: false,
    amountOfPlays: 0, // Adding initialization here
    isPaused: false, // For comment detection
    commentCheckInterval: null,
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
    // Check for comment section dialog or comment UI elements
    const commentSection = document.querySelector('div[aria-label="Comment"]') || 
                           document.querySelector('div[aria-label="Comments"]') ||
                           document.querySelector('section._aamu._ae3_._ae40._ae41') ||
                           document.querySelector('.BasePortal') ||
                           (document.querySelector(COMMENTS_SELECTOR)?.innerText?.length > 0);
    
    return !!commentSection;
  }
  
  // Start watching for comments
  function startCommentWatcher() {
    if (reelState.commentCheckInterval) {
      clearInterval(reelState.commentCheckInterval);
    }
    
    reelState.commentCheckInterval = setInterval(() => {
      if (!reelState.isRunning) {
        clearInterval(reelState.commentCheckInterval);
        return;
      }
      
      const commentsOpen = checkIfCommentsAreOpen();
      
      if (commentsOpen && !reelState.isPaused) {
        console.log("Comments opened - pausing reel auto-scroll");
        reelState.isPaused = true;
        
        // Pause the current video when comments are open
        const currentVideo = getCurrentVideo();
        if (currentVideo) {
          currentVideo.pause();
        }
      } else if (!commentsOpen && reelState.isPaused) {
        console.log("Comments closed - resuming reel auto-scroll");
        reelState.isPaused = false;
        
        // Resume the current video when comments are closed
        const currentVideo = getCurrentVideo();
        if (currentVideo) {
          currentVideo.play();
          
          // Reset the event listener for the resumed video
          if (reelState.isRunning) {
            currentVideo.removeEventListener("ended", endVideoEvent);
            currentVideo.addEventListener("ended", endVideoEvent, { once: true });
          }
        }
      }
    }, 500);
  }
  
  async function endVideoEvent() {
    console.log({
      amountOfPlays: reelState.amountOfPlays,
      amountOfPlaysToSkip: reelState.settings.playCount,
      scrollDirection: reelState.settings.scrollDirection,
      applicationIsOn: reelState.isRunning,
      currentVideo: getCurrentVideo(),
    });
  
    // If paused due to comments, don't proceed with scrolling
    if (reelState.isPaused) {
      console.log("Auto-scroll paused due to open comments");
      return;
    }
  
    const VIDEOS_LIST = Array.from(document.querySelectorAll(VIDEOS_LIST_SELECTOR));
    const currentVideo = getCurrentVideo();
    if (!currentVideo) return;
  
    if (!reelState.isRunning) {
      currentVideo.setAttribute("loop", "true");
      currentVideo.removeEventListener("ended", endVideoEvent);
      return;
    }
  
    reelState.amountOfPlays++;
    console.log(`Video played ${reelState.amountOfPlays} time(s) out of ${reelState.settings.playCount}`);
    
    if (reelState.amountOfPlays < reelState.settings.playCount) {
      // If we haven't reached the desired play count, replay the video
      currentVideo.currentTime = 0;
      currentVideo.play();
      
      // Re-attach the event listener for the next completion
      currentVideo.addEventListener("ended", endVideoEvent, { once: true });
      return;
    }
  
    // Reset play count for next video
    reelState.amountOfPlays = 0;
  
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
    reelState.isPaused = false;
    console.log("🎯 Auto-scrolling enabled. Watching Instagram Reels hands-free! 🎥");
    
    // Start comment watcher
    startCommentWatcher();
    
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
    reelState.isPaused = false;
    
    if (reelState.commentCheckInterval) {
      clearInterval(reelState.commentCheckInterval);
      reelState.commentCheckInterval = null;
    }
    
    const currentVideo = getCurrentVideo();
    if (currentVideo) {
      currentVideo.setAttribute("loop", "true");
      currentVideo.removeEventListener("ended", endVideoEvent);
    }
    console.log("⏹️ Auto-scrolling disabled.");
  }
  
  // Main loop to continuously monitor videos
  function monitorVideosLoop() {
    if (reelState.isRunning && !reelState.isPaused) {
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