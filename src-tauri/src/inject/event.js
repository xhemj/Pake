const shortcuts = {
  "[": () => window.history.back(),
  "]": () => window.history.forward(),
  "-": () => zoomOut(),
  "=": () => zoomIn(),
  "+": () => zoomIn(),
  0: () => setZoom("100%"),
  r: () => window.location.reload(),
  ArrowUp: () => scrollTo(0, 0),
  ArrowDown: () => scrollTo(0, document.body.scrollHeight),
};

function setZoom(zoom) {
  const html = document.getElementsByTagName("html")[0];
  html.style.zoom = zoom;
  window.localStorage.setItem("htmlZoom", zoom);
}

function zoomCommon(zoomChange) {
  const currentZoom = window.localStorage.getItem("htmlZoom") || "100%";
  setZoom(zoomChange(currentZoom));
}

function zoomIn() {
  zoomCommon((currentZoom) => `${Math.min(parseInt(currentZoom) + 10, 200)}%`);
}

function zoomOut() {
  zoomCommon((currentZoom) => `${Math.max(parseInt(currentZoom) - 10, 30)}%`);
}

function handleShortcut(event) {
  if (shortcuts[event.key]) {
    event.preventDefault();
    shortcuts[event.key]();
  }
}

// Configuration constants
const DOWNLOADABLE_FILE_EXTENSIONS = {
  documents: [
    "pdf",
    "doc",
    "docx",
    "xls",
    "xlsx",
    "ppt",
    "pptx",
    "txt",
    "rtf",
    "odt",
    "ods",
    "odp",
    "pages",
    "numbers",
    "key",
    "epub",
    "mobi",
  ],
  archives: [
    "zip",
    "rar",
    "7z",
    "tar",
    "gz",
    "gzip",
    "bz2",
    "xz",
    "lzma",
    "deb",
    "rpm",
    "pkg",
    "msi",
    "exe",
    "dmg",
    "apk",
    "ipa",
  ],
  data: [
    "json",
    "xml",
    "csv",
    "sql",
    "db",
    "sqlite",
    "yaml",
    "yml",
    "toml",
    "ini",
    "cfg",
    "conf",
    "log",
  ],
  code: [
    "js",
    "ts",
    "jsx",
    "tsx",
    "css",
    "scss",
    "sass",
    "less",
    "html",
    "htm",
    "php",
    "py",
    "java",
    "cpp",
    "c",
    "h",
    "cs",
    "rb",
    "go",
    "rs",
    "swift",
    "kt",
    "scala",
    "sh",
    "bat",
    "ps1",
  ],
  fonts: ["ttf", "otf", "woff", "woff2", "eot"],
  design: ["ai", "psd", "sketch", "fig", "xd"],
  system: [
    "iso",
    "img",
    "bin",
    "torrent",
    "jar",
    "war",
    "indd",
    "fla",
    "swf",
    "raw",
  ],
};

const ALL_DOWNLOADABLE_EXTENSIONS = Object.values(
  DOWNLOADABLE_FILE_EXTENSIONS,
).flat();

const DOWNLOAD_PATH_PATTERNS = [
  "/download/",
  "/files/",
  "/attachments/",
  "/assets/",
  "/releases/",
  "/dist/",
];

// Language detection utilities
function getUserLanguage() {
  return navigator.language || navigator.userLanguage;
}

function isChineseLanguage(language = getUserLanguage()) {
  return (
    language &&
    (language.startsWith("zh") ||
      language.includes("CN") ||
      language.includes("TW") ||
      language.includes("HK"))
  );
}

// Unified file detection - replaces both isDownloadLink and isFileLink
function isDownloadableFile(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();

    // Get file extension
    const extension = pathname.substring(pathname.lastIndexOf(".") + 1);

    const fileExtensions = ALL_DOWNLOADABLE_EXTENSIONS;

    return (
      fileExtensions.includes(extension) ||
      // Check for download hints
      urlObj.searchParams.has("download") ||
      urlObj.searchParams.has("attachment") ||
      // Check for common download paths
      DOWNLOAD_PATH_PATTERNS.some((pattern) => pathname.includes(pattern))
    );
  } catch (e) {
    return false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const tauri = window.__TAURI__;
  const appWindow = tauri.window.getCurrentWindow();
  const invoke = tauri.core.invoke;

  if (!document.getElementById("pake-top-dom")) {
    const topDom = document.createElement("div");
    topDom.id = "pake-top-dom";
    document.body.appendChild(topDom);
  }

  const domEl = document.getElementById("pake-top-dom");

  domEl.addEventListener("touchstart", () => {
    appWindow.startDragging();
  });

  domEl.addEventListener("mousedown", (e) => {
    e.preventDefault();
    if (e.buttons === 1 && e.detail !== 2) {
      appWindow.startDragging();
    }
  });

  domEl.addEventListener("dblclick", () => {
    appWindow.isFullscreen().then((fullscreen) => {
      appWindow.setFullscreen(!fullscreen);
    });
  });

  if (window["pakeConfig"]?.disabled_web_shortcuts !== true) {
    document.addEventListener("keyup", (event) => {
      if (/windows|linux/i.test(navigator.userAgent) && event.ctrlKey) {
        handleShortcut(event);
      }
      if (/macintosh|mac os x/i.test(navigator.userAgent) && event.metaKey) {
        handleShortcut(event);
      }
    });
  }

  // Collect blob urls to blob by overriding window.URL.createObjectURL
  function collectUrlToBlobs() {
    const backupCreateObjectURL = window.URL.createObjectURL;
    window.blobToUrlCaches = new Map();
    window.URL.createObjectURL = (blob) => {
      const url = backupCreateObjectURL.call(window.URL, blob);
      window.blobToUrlCaches.set(url, blob);
      return url;
    };
  }

  function convertBlobUrlToBinary(blobUrl) {
    return new Promise((resolve) => {
      const blob = window.blobToUrlCaches.get(blobUrl);
      const reader = new FileReader();

      reader.readAsArrayBuffer(blob);
      reader.onload = () => {
        resolve(Array.from(new Uint8Array(reader.result)));
      };
    });
  }

  function downloadFromDataUri(dataURI, filename) {
    const byteString = atob(dataURI.split(",")[1]);
    // write the bytes of the string to an ArrayBuffer
    const bufferArray = new ArrayBuffer(byteString.length);

    // create a view into the buffer
    const binary = new Uint8Array(bufferArray);

    // set the bytes of the buffer to the correct values
    for (let i = 0; i < byteString.length; i++) {
      binary[i] = byteString.charCodeAt(i);
    }

    // write the ArrayBuffer to a binary, and you're done
    const userLanguage = navigator.language || navigator.userLanguage;
    invoke("download_file_by_binary", {
      params: {
        filename,
        binary: Array.from(binary),
        language: userLanguage,
      },
    });
  }

  function downloadFromBlobUrl(blobUrl, filename) {
    convertBlobUrlToBinary(blobUrl).then((binary) => {
      const userLanguage = navigator.language || navigator.userLanguage;
      invoke("download_file_by_binary", {
        params: {
          filename,
          binary,
          language: userLanguage,
        },
      });
    });
  }

  // detect blob download by createElement("a")
  function detectDownloadByCreateAnchor() {
    const createEle = document.createElement;
    document.createElement = (el) => {
      if (el !== "a") return createEle.call(document, el);
      const anchorEle = createEle.call(document, el);

      // use addEventListener to avoid overriding the original click event.
      anchorEle.addEventListener(
        "click",
        (e) => {
          const url = anchorEle.href;
          const filename = anchorEle.download || getFilenameFromUrl(url);
          if (window.blobToUrlCaches.has(url)) {
            downloadFromBlobUrl(url, filename);
            // case: download from dataURL -> convert dataURL ->
          } else if (url.startsWith("data:")) {
            downloadFromDataUri(url, filename);
          }
        },
        true,
      );

      return anchorEle;
    };
  }

  // process special download protocol['data:','blob:']
  const isSpecialDownload = (url) =>
    ["blob", "data"].some((protocol) => url.startsWith(protocol));

  const isDownloadRequired = (url, anchorElement, e) =>
    anchorElement.download || e.metaKey || e.ctrlKey || isDownloadableFile(url);

  const handleExternalLink = (url) => {
    invoke("plugin:shell|open", {
      path: url,
    });
  };

  // Check if URL belongs to the same domain (including subdomains)
  const isSameDomain = (url) => {
    try {
      const linkUrl = new URL(url);
      const currentUrl = new URL(window.location.href);

      if (linkUrl.hostname === currentUrl.hostname) return true;

      // Extract root domain (e.g., bilibili.com from www.bilibili.com)
      const getRootDomain = (hostname) => {
        const parts = hostname.split(".");
        return parts.length >= 2 ? parts.slice(-2).join(".") : hostname;
      };

      return (
        getRootDomain(currentUrl.hostname) === getRootDomain(linkUrl.hostname)
      );
    } catch (e) {
      return false;
    }
  };

  const detectAnchorElementClick = (e) => {
    const anchorElement = e.target.closest("a");

    if (anchorElement && anchorElement.href) {
      const target = anchorElement.target;
      const hrefUrl = new URL(anchorElement.href);
      const absoluteUrl = hrefUrl.href;
      let filename = anchorElement.download || getFilenameFromUrl(absoluteUrl);

      // Handle _blank links: same domain navigates in-app, cross-domain opens new window
      if (target === "_blank") {
        e.preventDefault();
        e.stopImmediatePropagation();

        if (isSameDomain(absoluteUrl)) {
          window.location.href = absoluteUrl;
        } else {
          const newWindow = originalWindowOpen.call(
            window,
            absoluteUrl,
            "_blank",
            "width=1200,height=800,scrollbars=yes,resizable=yes",
          );
          if (!newWindow) handleExternalLink(absoluteUrl);
        }
        return;
      }

      if (target === "_new") {
        e.preventDefault();
        handleExternalLink(absoluteUrl);
        return;
      }

      // Process download links for Rust to handle.
      if (
        isDownloadRequired(absoluteUrl, anchorElement, e) &&
        !isSpecialDownload(absoluteUrl)
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const userLanguage = getUserLanguage();
        invoke("download_file", {
          params: { url: absoluteUrl, filename, language: userLanguage },
        });
        return;
      }

      // Handle regular links: same domain allows normal navigation, cross-domain opens new window
      if (!target || target === "_self") {
        if (!isSameDomain(absoluteUrl)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          const newWindow = originalWindowOpen.call(
            window,
            absoluteUrl,
            "_blank",
            "width=1200,height=800,scrollbars=yes,resizable=yes",
          );
          if (!newWindow) handleExternalLink(absoluteUrl);
        }
      }
    }
  };

  // Prevent some special websites from executing in advance, before the click event is triggered.
  document.addEventListener("click", detectAnchorElementClick, true);

  collectUrlToBlobs();
  detectDownloadByCreateAnchor();

  // Rewrite the window.open function.
  const originalWindowOpen = window.open;
  window.open = function (url, name, specs) {
    // Apple login and google login
    if (name === "AppleAuthentication") {
      //do nothing
    } else if (
      specs &&
      (specs.includes("height=") || specs.includes("width="))
    ) {
      location.href = url;
    } else {
      const baseUrl = window.location.origin + window.location.pathname;
      const hrefUrl = new URL(url, baseUrl);
      const absoluteUrl = hrefUrl.href;

      // Apply same domain logic as anchor links
      if (isSameDomain(absoluteUrl)) {
        // Same domain: navigate in app or open new window based on specs
        if (name === "_blank" || !name) {
          return originalWindowOpen.call(
            window,
            absoluteUrl,
            "_blank",
            "width=1200,height=800,scrollbars=yes,resizable=yes",
          );
        } else {
          location.href = absoluteUrl;
        }
      } else {
        // Cross domain: open in external browser
        handleExternalLink(absoluteUrl);
      }
    }
    // Call the original window.open function to maintain its normal functionality.
    return originalWindowOpen.call(window, url, name, specs);
  };

  // Set the default zoom, There are problems with Loop without using try-catch.
  try {
    setDefaultZoom();
  } catch (e) {
    console.log(e);
  }

  // Fix Chinese input method "Enter" on Safari
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Process") e.stopPropagation();
    },
    true,
  );

  // Language detection and texts
  const isChinese = isChineseLanguage();

  const menuTexts = {
    // Media operations
    downloadImage: isChinese ? "下载图片" : "Download Image",
    downloadVideo: isChinese ? "下载视频" : "Download Video",
    downloadFile: isChinese ? "下载文件" : "Download File",
    copyAddress: isChinese ? "复制地址" : "Copy Address",
    openInBrowser: isChinese ? "浏览器打开" : "Open in Browser",
  };

  // Menu theme configuration
  const MENU_THEMES = {
    dark: {
      menu: {
        background: "#2d2d2d",
        border: "1px solid #404040",
        color: "#ffffff",
        shadow: "0 4px 16px rgba(0, 0, 0, 0.4)",
      },
      item: {
        divider: "#404040",
        hoverBg: "#404040",
      },
    },
    light: {
      menu: {
        background: "#ffffff",
        border: "1px solid #e0e0e0",
        color: "#333333",
        shadow: "0 4px 16px rgba(0, 0, 0, 0.15)",
      },
      item: {
        divider: "#f0f0f0",
        hoverBg: "#d0d0d0",
      },
    },
  };

  // Theme detection and menu styles
  function getTheme() {
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    return prefersDark ? "dark" : "light";
  }

  function getMenuStyles(theme = getTheme()) {
    return MENU_THEMES[theme] || MENU_THEMES.light;
  }

  // Menu configuration constants
  const MENU_CONFIG = {
    id: "pake-context-menu",
    minWidth: "120px", // Compact width for better UX
    borderRadius: "6px", // Slightly more rounded for modern look
    fontSize: "13px",
    zIndex: "999999",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    // Menu item dimensions
    itemPadding: "8px 16px", // Increased vertical padding for better comfort
    itemLineHeight: "1.2",
    itemBorderRadius: "3px", // Subtle rounded corners for menu items
    itemTransition: "background-color 0.1s ease",
  };

  // Create custom context menu
  function createContextMenu() {
    const contextMenu = document.createElement("div");
    contextMenu.id = MENU_CONFIG.id;
    const styles = getMenuStyles();

    contextMenu.style.cssText = `
      position: fixed;
      background: ${styles.menu.background};
      border: ${styles.menu.border};
      border-radius: ${MENU_CONFIG.borderRadius};
      box-shadow: ${styles.menu.shadow};
      padding: 4px 0;
      min-width: ${MENU_CONFIG.minWidth};
      font-family: ${MENU_CONFIG.fontFamily};
      font-size: ${MENU_CONFIG.fontSize};
      color: ${styles.menu.color};
      z-index: ${MENU_CONFIG.zIndex};
      display: none;
      user-select: none;
    `;
    document.body.appendChild(contextMenu);
    return contextMenu;
  }

  function createMenuItem(text, onClick, divider = false) {
    const item = document.createElement("div");
    const styles = getMenuStyles();

    item.style.cssText = `
      padding: ${MENU_CONFIG.itemPadding};
      cursor: pointer;
      user-select: none;
      font-weight: 400;
      line-height: ${MENU_CONFIG.itemLineHeight};
      transition: ${MENU_CONFIG.itemTransition};
      white-space: nowrap;
      border-radius: ${MENU_CONFIG.itemBorderRadius};
      margin: 2px 4px;
      border-bottom: ${divider ? `1px solid ${styles.item.divider}` : "none"};
    `;
    item.textContent = text;

    item.addEventListener("mouseenter", () => {
      item.style.backgroundColor = styles.item.hoverBg;
    });

    item.addEventListener("mouseleave", () => {
      item.style.backgroundColor = "transparent";
    });

    item.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
      hideContextMenu();
    });

    return item;
  }

  function showContextMenu(x, y, items) {
    let contextMenu = document.getElementById(MENU_CONFIG.id);

    // Always recreate menu to ensure theme is up-to-date
    if (contextMenu) {
      contextMenu.remove();
    }
    contextMenu = createContextMenu();

    items.forEach((item) => {
      contextMenu.appendChild(item);
    });

    contextMenu.style.left = x + "px";
    contextMenu.style.top = y + "px";
    contextMenu.style.display = "block";

    // Adjust position if menu goes off screen
    const rect = contextMenu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      contextMenu.style.left = x - rect.width + "px";
    }
    if (rect.bottom > window.innerHeight) {
      contextMenu.style.top = y - rect.height + "px";
    }
  }

  function hideContextMenu() {
    const contextMenu = document.getElementById(MENU_CONFIG.id);
    if (contextMenu) {
      contextMenu.style.display = "none";
    }
  }

  function downloadImage(imageUrl) {
    // Convert relative URLs to absolute
    if (imageUrl.startsWith("/")) {
      imageUrl = window.location.origin + imageUrl;
    } else if (imageUrl.startsWith("./")) {
      imageUrl = new URL(imageUrl, window.location.href).href;
    } else if (
      !imageUrl.startsWith("http") &&
      !imageUrl.startsWith("data:") &&
      !imageUrl.startsWith("blob:")
    ) {
      imageUrl = new URL(imageUrl, window.location.href).href;
    }

    // Generate filename from URL
    const filename = getFilenameFromUrl(imageUrl) || "image";

    // Handle different URL types
    if (imageUrl.startsWith("data:")) {
      downloadFromDataUri(imageUrl, filename);
    } else if (imageUrl.startsWith("blob:")) {
      if (window.blobToUrlCaches && window.blobToUrlCaches.has(imageUrl)) {
        downloadFromBlobUrl(imageUrl, filename);
      }
    } else {
      // Regular HTTP(S) image
      const userLanguage = navigator.language || navigator.userLanguage;
      invoke("download_file", {
        params: {
          url: imageUrl,
          filename: filename,
          language: userLanguage,
        },
      });
    }
  }

  // Check if element is media (image or video)
  function getMediaInfo(target) {
    // Check for img tags
    if (target.tagName.toLowerCase() === "img") {
      return { isMedia: true, url: target.src, type: "image" };
    }

    // Check for video tags
    if (target.tagName.toLowerCase() === "video") {
      return {
        isMedia: true,
        url: target.src || target.currentSrc,
        type: "video",
      };
    }

    // Check for elements with background images
    if (target.style && target.style.backgroundImage) {
      const bgImage = target.style.backgroundImage;
      const urlMatch = bgImage.match(/url\(["']?([^"')]+)["']?\)/);
      if (urlMatch) {
        return { isMedia: true, url: urlMatch[1], type: "image" };
      }
    }

    // Check for parent elements with background images
    const parentWithBg = target.closest('[style*="background-image"]');
    if (parentWithBg) {
      const bgImage = parentWithBg.style.backgroundImage;
      const urlMatch = bgImage.match(/url\(["']?([^"')]+)["']?\)/);
      if (urlMatch) {
        return { isMedia: true, url: urlMatch[1], type: "image" };
      }
    }

    return { isMedia: false, url: "", type: "" };
  }

  // Simplified menu builder
  function buildMenuItems(type, data) {
    const userLanguage = navigator.language || navigator.userLanguage;
    const items = [];

    switch (type) {
      case "media":
        const downloadText =
          data.type === "image"
            ? menuTexts.downloadImage
            : menuTexts.downloadVideo;
        items.push(
          createMenuItem(downloadText, () => downloadImage(data.url)),
          createMenuItem(menuTexts.copyAddress, () =>
            navigator.clipboard.writeText(data.url),
          ),
          createMenuItem(menuTexts.openInBrowser, () =>
            invoke("plugin:shell|open", { path: data.url }),
          ),
        );
        break;

      case "link":
        if (data.isFile) {
          items.push(
            createMenuItem(menuTexts.downloadFile, () => {
              const filename = getFilenameFromUrl(data.url);
              invoke("download_file", {
                params: { url: data.url, filename, language: userLanguage },
              });
            }),
          );
        }
        items.push(
          createMenuItem(menuTexts.copyAddress, () =>
            navigator.clipboard.writeText(data.url),
          ),
          createMenuItem(menuTexts.openInBrowser, () =>
            invoke("plugin:shell|open", { path: data.url }),
          ),
        );
        break;
    }

    return items;
  }

  // Handle right-click context menu
  document.addEventListener(
    "contextmenu",
    function (event) {
      const target = event.target;

      // Check for media elements (images/videos)
      const mediaInfo = getMediaInfo(target);

      // Check for links (but not if it's media)
      const linkElement = target.closest("a");
      const isLink = linkElement && linkElement.href && !mediaInfo.isMedia;

      // Only show custom menu for media or links
      if (mediaInfo.isMedia || isLink) {
        event.preventDefault();
        event.stopPropagation();

        let menuItems = [];

        if (mediaInfo.isMedia) {
          menuItems = buildMenuItems("media", mediaInfo);
        } else if (isLink) {
          const linkUrl = linkElement.href;
          menuItems = buildMenuItems("link", {
            url: linkUrl,
            isFile: isDownloadableFile(linkUrl),
          });
        }

        showContextMenu(event.clientX, event.clientY, menuItems);
      }
      // For all other elements, let browser's default context menu handle it
    },
    true,
  );

  // Hide context menu when clicking elsewhere
  document.addEventListener("click", hideContextMenu);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      hideContextMenu();
    }
  });
});

document.addEventListener("DOMContentLoaded", function () {
  let permVal = "granted";
  window.Notification = function (title, options) {
    const { invoke } = window.__TAURI__.core;
    const body = options?.body || "";
    let icon = options?.icon || "";

    // If the icon is a relative path, convert to full path using URI
    if (icon.startsWith("/")) {
      icon = window.location.origin + icon;
    }

    invoke("send_notification", {
      params: {
        title,
        body,
        icon,
      },
    });
  };

  window.Notification.requestPermission = async () => "granted";

  Object.defineProperty(window.Notification, "permission", {
    enumerable: true,
    get: () => permVal,
    set: (v) => {
      permVal = v;
    },
  });
});

function setDefaultZoom() {
  const htmlZoom = window.localStorage.getItem("htmlZoom");
  if (htmlZoom) {
    setZoom(htmlZoom);
  }
}

function getFilenameFromUrl(url) {
  try {
    const urlPath = new URL(url).pathname;
    let filename = urlPath.substring(urlPath.lastIndexOf("/") + 1);

    // If no filename or no extension, generate one
    if (!filename || !filename.includes(".")) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

      // Detect image type from URL or data URI
      if (url.startsWith("data:image/")) {
        const mimeType = url.substring(11, url.indexOf(";"));
        filename = `image-${timestamp}.${mimeType}`;
      } else {
        // Default to common image extensions based on common patterns
        if (url.includes("jpg") || url.includes("jpeg")) {
          filename = `image-${timestamp}.jpg`;
        } else if (url.includes("png")) {
          filename = `image-${timestamp}.png`;
        } else if (url.includes("gif")) {
          filename = `image-${timestamp}.gif`;
        } else if (url.includes("webp")) {
          filename = `image-${timestamp}.webp`;
        } else if (url.includes("svg")) {
          filename = `image-${timestamp}.svg`;
        } else {
          filename = `image-${timestamp}.png`; // default
        }
      }
    }

    return filename;
  } catch (e) {
    // Fallback for invalid URLs
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `image-${timestamp}.png`;
  }
}
