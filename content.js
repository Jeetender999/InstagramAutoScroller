class InstagramAutoScroll {
    constructor() {
        this.mainContainer = null;
        this.articles = [];
        this.currentIndex = 0;
        this.scrollTimeout = null;
        this.shouldStop = false;
        this.isProcessingScroll = false;
        this.lastProcessedIndex = -1;
        this.debounceTimeout = null;
        this.observer = null;
        this.isRunning = false;
        
        // Bind methods
        this.initializeStartingPosition = this.initializeStartingPosition.bind(this);
        this.startScrolling = this.startScrolling.bind(this);
        this.handleManualScroll = this.handleManualScroll.bind(this);
        
        // Initialize listeners
        this.initializeMessageListener();
      }
  
    delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }
  
    getVisibilityRatio(el) {
      const rect = el.getBoundingClientRect();
      const windowHeight = window.innerHeight || document.documentElement.clientHeight;
      
      if (rect.bottom < 0 || rect.top > windowHeight) {
        return 0;
      }
  
      const visibleHeight = Math.min(rect.bottom, windowHeight) - Math.max(rect.top, 0);
      return visibleHeight / rect.height;
    }
  
    isFullyVisible(el) {
      return this.getVisibilityRatio(el) > 0.9;
    }
  
    findMostVisibleArticle() {
      let maxVisibility = 0;
      let visibleArticle = null;
      let visibleIndex = -1;
  
      this.articles.forEach((article, index) => {
        const visibilityRatio = this.getVisibilityRatio(article);
        if (visibilityRatio > maxVisibility && visibilityRatio > 0.3) {
          maxVisibility = visibilityRatio;
          visibleArticle = article;
          visibleIndex = index;
        }
      });
  
      return { article: visibleArticle, index: visibleIndex, visibility: maxVisibility };
    }
  
    async initializeStartingPosition() {
      await this.delay(500);
      const { article, index, visibility } = this.findMostVisibleArticle();
  
      if (index === -1 || !article) {
        console.log("No visible article found, starting from beginning");
        return 0;
      }
  
      await this.delay(200);
      const verificationResult = this.findMostVisibleArticle();
      
      if (verificationResult.index === index) {
        console.log(`Starting from post ${index + 1} (${(visibility * 100).toFixed(1)}% visible)`);
        
        const mediaElement = article.querySelector('video.x1lliihq.x5yr21d.xh8yej3') || 
                            article.querySelector('img.x5yr21d.xu96u03.x10l6tqk.x13vifvy.x87ps6o.xh8yej3');
        
        if (mediaElement) {
          mediaElement.scrollIntoView({ behavior: "smooth", block: "center" });
          await this.delay(500);
        }
        
        return index;
      }
      
      console.log("Position unstable, starting from beginning");
      return 0;
    }
  
    async scrollToMedia(mediaElement, expectedIndex) {
      if (!mediaElement) return false;
  
      mediaElement.scrollIntoView({ behavior: "smooth", block: "center" });
      await this.delay(500);
  
      for (let i = 0; i < 5; i++) {
        const currentArticle = this.findMostVisibleArticle().article;
        const actualIndex = this.articles.indexOf(currentArticle);
  
        if (actualIndex !== expectedIndex) {
          console.log(`Scroll sync error detected! Expected: ${expectedIndex + 1}, Actual: ${actualIndex + 1}`);
          this.currentIndex = expectedIndex;
          return false;
        }
  
        if (this.isFullyVisible(mediaElement)) {
          return true;
        }
  
        mediaElement.scrollIntoView({ behavior: "smooth", block: "center" });
        await this.delay(300);
      }
  
      return this.isFullyVisible(mediaElement);
    }
  
    async handleManualScroll() {
      if (this.isProcessingScroll) return;
      this.isProcessingScroll = true;
  
      if (this.scrollTimeout) {
        clearTimeout(this.scrollTimeout);
        this.scrollTimeout = null;
      }
  
      await this.delay(500);
  
      const { article: visibleArticle, index: newIndex } = this.findMostVisibleArticle();
      
      if (!visibleArticle || newIndex === -1) {
        this.isProcessingScroll = false;
        return;
      }
  
      if (newIndex !== this.lastProcessedIndex) {
        await this.delay(200);
        const { index: verificationIndex } = this.findMostVisibleArticle();
  
        if (newIndex === verificationIndex) {
          this.lastProcessedIndex = newIndex;
          this.shouldStop = true;
          this.currentIndex = newIndex;
  
          const video = visibleArticle.querySelector('video.x1lliihq.x5yr21d.xh8yej3');
          const mediaType = video ? "Video" : "Image";
  
          console.log(`Manual scroll detected! Resetting index to ${this.currentIndex + 1}`);
          console.log(`Current post type: ${mediaType}`);
  
          await this.delay(500);
          this.startScrolling();
        }
      }
  
      this.isProcessingScroll = false;
    }
  
    initializeObserver() {
      this.observer = new MutationObserver(mutations => {
        let newArticles = [];
  
        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            if (node.nodeName === "ARTICLE" && !this.articles.includes(node)) {
              newArticles.push(node);
            }
          });
        });
  
        if (newArticles.length > 0) {
          this.articles.push(...newArticles);
          console.log("New posts detected. Total articles:", this.articles.length);
        }
  
        if (this.debounceTimeout) {
          clearTimeout(this.debounceTimeout);
        }
  
        this.debounceTimeout = setTimeout(async () => {
          const { article: visibleArticle, index: visibleIndex } = this.findMostVisibleArticle();
          if (visibleArticle && visibleIndex !== this.currentIndex) {
            await this.handleManualScroll();
          }
        }, 300);
      });
    }
  
    async startScrolling() {
      this.shouldStop = false;
  
      while (!this.shouldStop) {
        if (this.currentIndex >= this.articles.length) {
          console.log("Waiting for new posts to load...");
          await this.delay(2000);
          continue;
        }
  
        const article = this.articles[this.currentIndex];
        const video = article.querySelector('video.x1lliihq.x5yr21d.xh8yej3');
        const image = article.querySelector('img.x5yr21d.xu96u03.x10l6tqk.x13vifvy.x87ps6o.xh8yej3');
  
        let mediaElement = video || image;
        if (!mediaElement) {
          this.currentIndex++;
          continue;
        }
  
        let mediaType = video ? "Video" : "Image";
        let waitTime = 3000;
  
        if (video) {
          if (video.readyState >= 2) {
            waitTime = video.duration ? video.duration * 1000 : 5000;
          } else {
            waitTime = await new Promise(resolve => {
              video.addEventListener("loadedmetadata", () => {
                resolve(video.duration ? video.duration * 1000 : 5000);
              }, { once: true });
              
              setTimeout(() => resolve(5000), 5000);
            });
          }
        }
  
        console.log(`Attempting to view Post ${this.currentIndex + 1}: ${mediaType}`);
        console.log("MEDIA ELEMENT", mediaElement)
        const scrollSuccess = await this.scrollToMedia(mediaElement, this.currentIndex);
        
        if (!scrollSuccess) {
          console.log(`Failed to properly scroll to post ${this.currentIndex + 1}, retrying...`);
          await this.delay(1000);
          continue;
        }
  
        console.log(`Successfully viewing Post ${this.currentIndex + 1}: ${mediaType} - Waiting ${waitTime / 1000} seconds`);
  
        if (!this.shouldStop) {
          await new Promise(resolve => {
            this.scrollTimeout = setTimeout(resolve, waitTime);
          });
  
          if (!this.shouldStop) {
            const { article: finalArticle } = this.findMostVisibleArticle();
            if (finalArticle === article) {
              this.currentIndex++;
            } else {
              console.log("Position shifted during wait, readjusting...");
              this.currentIndex = this.articles.indexOf(finalArticle);
            }
          }
        }
      }
    }
  
    async initialize() {
      this.mainContainer = document.querySelector('.x9f619.xjbqb8w.x78zum5.x168nmei.x13lgxp2.x5pf9jr.xo71vjh.x1uhb9sk.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.xdt5ytf.xqjyukv.x6s0dn4.x1oa3qoh.x1nhvcw1');
  
      if (!this.mainContainer) {
        console.error("Main container not found!");
        return false;
      }
  
      this.articles = Array.from(this.mainContainer.querySelectorAll('article'));
      console.log("Initial Articles Found:", this.articles.length);
      
      this.initializeObserver();
      this.observer.observe(this.mainContainer, { childList: true, subtree: true });
      
      this.currentIndex = await this.initializeStartingPosition();
      return true;
    }
  
    initializeMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
          if (request.action === "start" && !this.isRunning) {
            this.isRunning = true;
            this.initialize().then(initialized => {
              if (initialized) {
                this.startScrolling();
              }
            });
            sendResponse({ status: "started" });
          } else if (request.action === "stop") {
            this.isRunning = false;
            this.shouldStop = true;
            if (this.scrollTimeout) {
              clearTimeout(this.scrollTimeout);
              this.scrollTimeout = null;
            }
            sendResponse({ status: "stopped" });
          }
          return true; // Keep the message channel open for async response
        });
      }
    
      // Ping method to check if content script is loaded
      ping() {
        return true;
      }
    }
    
    // Initialize and export instance for testing connection
    const autoScroller = new InstagramAutoScroll();
    window.autoScroller = autoScroller; // For debugging
    
    // Send ready message to background script
    chrome.runtime.sendMessage({ action: "contentScriptReady" });