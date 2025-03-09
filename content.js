// Global state
const state = {
  mainContainer: null,
  articles: [],
  currentIndex: 0,
  scrollTimeout: null,
  shouldStop: false,
  isProcessingScroll: false,
  lastProcessedIndex: -1,
  debounceTimeout: null,
  observer: null,
  isRunning: false,
  settings: {
    imageTime: 3,
    videoMultiplier: 1
  }
};

// Helper functions
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getVisibilityRatio(el) {
  const rect = el.getBoundingClientRect();
  const windowHeight = window.innerHeight || document.documentElement.clientHeight;
  
  if (rect.bottom < 0 || rect.top > windowHeight) {
    return 0;
  }

  const visibleHeight = Math.min(rect.bottom, windowHeight) - Math.max(rect.top, 0);
  return visibleHeight / rect.height;
}

function isFullyVisible(el) {
  return getVisibilityRatio(el) > 0.9;
}

function findMostVisibleArticle() {
  let maxVisibility = 0;
  let visibleArticle = null;
  let visibleIndex = -1;

  state.articles.forEach((article, index) => {
    const visibilityRatio = getVisibilityRatio(article);
    if (visibilityRatio > maxVisibility && visibilityRatio > 0.3) {
      maxVisibility = visibilityRatio;
      visibleArticle = article;
      visibleIndex = index;
    }
  });

  return { article: visibleArticle, index: visibleIndex, visibility: maxVisibility };
}

async function initializeStartingPosition() {
  await delay(500);
  const { article, index, visibility } = findMostVisibleArticle();

  if (index === -1 || !article) {
    console.log("No visible article found, starting from beginning");
    return 0;
  }

  await delay(200);
  const verificationResult = findMostVisibleArticle();
  
  if (verificationResult.index === index) {
    console.log(`Starting from post ${index + 1} (${(visibility * 100).toFixed(1)}% visible)`);
    
    const mediaElement = article.querySelector('video.x1lliihq.x5yr21d.xh8yej3') || 
                        article.querySelector('img.x5yr21d.xu96u03.x10l6tqk.x13vifvy.x87ps6o.xh8yej3');
    
    if (mediaElement) {
      mediaElement.scrollIntoView({ behavior: "smooth", block: "center" });
      await delay(500);
    }
    
    return index;
  }
  
  console.log("Position unstable, starting from beginning");
  return 0;
}

async function scrollToMedia(mediaElement, expectedIndex) {
  if (!mediaElement) return false;

  // Check if we should stop before attempting to scroll
  if (state.shouldStop) return false;

  // Initial scroll attempt
  mediaElement.scrollIntoView({ behavior: "smooth", block: "center" });
  await delay(500);
  
  // Check again if we should stop after the delay
  if (state.shouldStop) return false;

  let retryCount = 0;
  const maxRetries = 3;

  while (retryCount < maxRetries && !state.shouldStop) {
    const currentArticle = findMostVisibleArticle().article;
    const actualIndex = state.articles.indexOf(currentArticle);

    // Check if we're on the right post
    if (actualIndex !== expectedIndex) {
      console.log(`Scroll position mismatch. Expected: ${expectedIndex + 1}, Actual: ${actualIndex + 1}`);
      retryCount++;
      
      // Check if we should stop before attempting another scroll
      if (state.shouldStop) return false;
      
      // Try different scroll alignments
      if (retryCount === 1) {
        mediaElement.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (retryCount === 2) {
        mediaElement.scrollIntoView({ behavior: "smooth", block: "end" });
      } else {
        // Final attempt with instant scroll
        mediaElement.scrollIntoView({ behavior: "auto", block: "center" });
      }
      
      await delay(700); // Increased delay for better stability
      
      // Check again if we should stop after the delay
      if (state.shouldStop) return false;
      
      continue;
    }

    // Check visibility
    if (isFullyVisible(mediaElement)) {
      return true;
    }

    // If post is found but not fully visible, make small adjustments
    const rect = mediaElement.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const scrollAdjustment = rect.top - (windowHeight - rect.height) / 2;
    
    // Check if we should stop before scrolling again
    if (state.shouldStop) return false;
    
    window.scrollBy({ top: scrollAdjustment, behavior: 'smooth' });
    await delay(500);
    
    // Check again if we should stop after the delay
    if (state.shouldStop) return false;

    // Verify final position
    if (isFullyVisible(mediaElement)) {
      return true;
    }

    retryCount++;
  }

  // If we've exhausted retries but the post is somewhat visible, continue anyway
  const visibilityRatio = getVisibilityRatio(mediaElement);
  if (visibilityRatio > 0.5 && !state.shouldStop) {
    console.log(`Post ${expectedIndex + 1} partially visible (${(visibilityRatio * 100).toFixed(1)}%), continuing...`);
    return true;
  }

  return false;
}

async function handleManualScroll() {
  if (state.isProcessingScroll) return;
  state.isProcessingScroll = true;

  if (state.scrollTimeout) {
    clearTimeout(state.scrollTimeout);
    state.scrollTimeout = null;
  }

  await delay(500);

  const { article: visibleArticle, index: newIndex } = findMostVisibleArticle();
  
  if (!visibleArticle || newIndex === -1) {
    state.isProcessingScroll = false;
    return;
  }

  if (newIndex !== state.lastProcessedIndex) {
    await delay(200);
    const { index: verificationIndex } = findMostVisibleArticle();

    if (newIndex === verificationIndex) {
      state.lastProcessedIndex = newIndex;
      state.shouldStop = true;
      state.currentIndex = newIndex;

      const video = visibleArticle.querySelector('video.x1lliihq.x5yr21d.xh8yej3');
      const mediaType = video ? "Video" : "Image";

      console.log(`Manual scroll detected! Resetting index to ${state.currentIndex + 1}`);
      console.log(`Current post type: ${mediaType}`);

      await delay(500);
      if (state.isRunning) {
        startScrolling();
      }
    }
  }

  state.isProcessingScroll = false;
}

function initializeObserver() {
  state.observer = new MutationObserver(mutations => {
    let newArticles = [];

    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeName === "ARTICLE" && !state.articles.includes(node)) {
          newArticles.push(node);
        }
      });
    });

    if (newArticles.length > 0) {
      state.articles.push(...newArticles);
      console.log("New posts detected. Total articles:", state.articles.length);
    }

    if (state.debounceTimeout) {
      clearTimeout(state.debounceTimeout);
    }

    state.debounceTimeout = setTimeout(async () => {
      const { article: visibleArticle, index: visibleIndex } = findMostVisibleArticle();
      if (visibleArticle && visibleIndex !== state.currentIndex) {
        await handleManualScroll();
      }
    }, 300);
  });
}

async function startScrolling() {
  state.shouldStop = false;

  while (!state.shouldStop && state.isRunning) {
    if (state.currentIndex >= state.articles.length) {
      console.log("Waiting for new posts to load...");
      await delay(2000);
      
      // Check if we should stop after waiting
      if (state.shouldStop || !state.isRunning) break;
      
      continue;
    }

    const article = state.articles[state.currentIndex];
    const video = article.querySelector('video.x1lliihq.x5yr21d.xh8yej3');
    const image = article.querySelector('img.x5yr21d.xu96u03.x10l6tqk.x13vifvy.x87ps6o.xh8yej3');

    let mediaElement = video || image;
    if (!mediaElement) {
      state.currentIndex++;
      continue;
    }

    let mediaType = video ? "Video" : "Image";
    let waitTime = state.settings.imageTime * 1000;

    if (video) {
      if (video.readyState >= 2) {
        waitTime = (video.duration * state.settings.videoMultiplier) * 1000;
        console.log("Original video duration : ", video.duration);
      } else {
        waitTime = await new Promise(resolve => {
          const onLoaded = () => {
            resolve((video.duration * state.settings.videoMultiplier) * 1000);
            console.log("Original video duration : ", video.duration);
          };
          
          video.addEventListener("loadedmetadata", onLoaded, { once: true });
          
          const timeout = setTimeout(() => {
            video.removeEventListener("loadedmetadata", onLoaded);
            resolve(5000);
          }, 5000);
          
          // Cancel the timeout if we should stop
          if (state.shouldStop || !state.isRunning) {
            clearTimeout(timeout);
            video.removeEventListener("loadedmetadata", onLoaded);
            resolve(0);
          }
        });
        
        // Check again if we should stop after getting the duration
        if (state.shouldStop || !state.isRunning) break;
      }
    }

    console.log(`Attempting to view Post ${state.currentIndex + 1}: ${mediaType}`);

    const scrollSuccess = await scrollToMedia(mediaElement, state.currentIndex);
    
    // Check if we should stop after scrolling
    if (state.shouldStop || !state.isRunning) break;
    
    if (!scrollSuccess) {
      console.log(`Failed to properly scroll to post ${state.currentIndex + 1}, skipping to next post...`);
      state.currentIndex++;
      await delay(1000);
      
      // Check again if we should stop after delay
      if (state.shouldStop || !state.isRunning) break;
      
      continue;
    }

    console.log(`Successfully viewing Post ${state.currentIndex + 1}: ${mediaType} - Waiting ${waitTime / 1000} seconds`);

    if (!state.shouldStop && state.isRunning) {
      const waitPromise = new Promise(resolve => {
        state.scrollTimeout = setTimeout(resolve, waitTime);
      });
      
      // Make the wait interruptible
      await Promise.race([
        waitPromise,
        new Promise(resolve => {
          const checkInterval = setInterval(() => {
            if (state.shouldStop || !state.isRunning) {
              clearInterval(checkInterval);
              if (state.scrollTimeout) {
                clearTimeout(state.scrollTimeout);
                state.scrollTimeout = null;
              }
              resolve();
            }
          }, 200);
        })
      ]);
      
      // Check if we should stop after waiting
      if (state.shouldStop || !state.isRunning) break;

      const { article: finalArticle } = findMostVisibleArticle();
      if (finalArticle === article) {
        state.currentIndex++;
      } else {
        console.log("Position shifted during wait, readjusting...");
        const newIndex = state.articles.indexOf(finalArticle);
        state.currentIndex = newIndex >= 0 ? newIndex : state.currentIndex + 1;
      }
    }
  }
  
  console.log("Auto-scrolling stopped.");
}

async function initialize() {
  state.mainContainer = document.querySelector('.x9f619.xjbqb8w.x78zum5.x168nmei.x13lgxp2.x5pf9jr.xo71vjh.x1uhb9sk.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.xdt5ytf.xqjyukv.x6s0dn4.x1oa3qoh.x1nhvcw1');

  if (!state.mainContainer) {
    console.error("Main container not found!");
    return false;
  }

  state.articles = Array.from(state.mainContainer.querySelectorAll('article'));
  console.log("Initial Articles Found:", state.articles.length);
  
  initializeObserver();
  state.observer.observe(state.mainContainer, { childList: true, subtree: true });
  
  return true;
}

function initializeMessageListener() {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getState") {
      sendResponse({ isRunning: state.isRunning });
      return true;
    } else if (request.action === "start" && !state.isRunning) {
      state.settings = request.settings;
      state.currentIndex = 0;
      state.isRunning = true;
      initialize().then(initialized => {
        if (initialized) {
          startScrolling();
        }
      });
      sendResponse({ status: "started" });
    } else if (request.action === "resume" && !state.isRunning) {
      state.settings = request.settings;
      state.isRunning = true;
      initialize().then(initialized => {
        if (initialized) {
          startScrolling();
        }
      });
      sendResponse({ status: "resumed" });
    } else if (request.action === "stop") {
      console.log("Stopping auto-scroll...");
      state.isRunning = false;
      state.shouldStop = true;
      if (state.scrollTimeout) {
        clearTimeout(state.scrollTimeout);
        state.scrollTimeout = null;
      }
      sendResponse({ status: "stopped" });
    }
    return true;
  });
}

// Initialize the auto-scroller
initializeMessageListener();