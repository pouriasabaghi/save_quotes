const SAVE_BUTTON_ID = "saveTextBtn";
const SAVE_ACTION = "saveText";
const SAVE_ICON =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAEPSURBVHgBpZO9agJBFIXP3aRICJENaYRgSBeDCaxNXiAPEiwES20VLPUVBAvRQtFGbcRCwUIsbBREsBR/wHLf4Doz/qCu4rr7VXNn5hzOXOYSBLrX/0HgHBgGCDquwagxUcxcTaakxMwDW8JDCCYzBe8en15zojBwOw8EGPTi/WQ4RaTQ4AaGfn+6N+y38e57U+tGs43ZfIFI+F/Vs/kSxu/f0X1Lgp1Y4vE84zvwdfbsosGtWAwy2TxG48m+bjRb6Pb69g3iybQykZTKVbEuIJFM7eurBpKfgF81rFTZCHzbtxcrVgN3/0AlYJhwgcaEIRzCjLroAYUcpZAaoqgmR1KMZlAkqdkViqZ1pEZq1zYGWKqmSV/IAAAAAElFTkSuQmCC";

// Define text types and their styles
const TEXT_TYPES = {
  note: {
    name: "Note",
    icon: "✎",
    style: {
      backgroundColor: "#fff",
    },
  },
  code: {
    name: "Code",
    icon: "{ }",
    style: {
      backgroundColor: "rgb(40 44 52 / 90%)",
      color: "#abb2bf",
      padding: "12px",
      borderRadius: "4px",
      fontFamily: "monospace",
      whiteSpace: "pre",
      fontSize: "14px",
      lineHeight: "1.5",
    },
  },
  quote: {
    name: "Quote",
    icon: "❝",
    style: {
      backgroundColor: "rgb(140 124 63 / 30%)",
      padding: "0",
      borderRadius: "0",
    },
  },
};

let popup; // Variable to hold the popup status

/**
 * Create and display a popup with options near the selected text.
 * @param {MouseEvent} event - The mouse event that triggered the popup.
 * @param {string} selectedText - The text that the user has selected.
 */
function createPopup(event, selectedText) {
  // Create the popup div
  popup = document.createElement("div");
  popup.style.position = "absolute";
  popup.style.top = `${event.pageY + 5}px`;
  popup.style.left = `${event.pageX + 10}px`;
  popup.style.background = "#4c3f3f";
  popup.style.padding = "5px";
  popup.style.borderRadius = "5px";
  popup.style.zIndex = "9";
  popup.style.display = "flex";
  popup.style.gap = "5px";
  popup.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";

  // Create buttons for each text type
  Object.entries(TEXT_TYPES).forEach(([type, config]) => {
    const button = document.createElement("button");
    button.id = `${SAVE_BUTTON_ID}-${type}`;
    button.style.background = "transparent";
    button.style.border = "none";
    button.style.padding = "5px 10px";
    button.style.cursor = "pointer";
    button.style.color = "white";
    button.style.display = "flex";
    button.style.alignItems = "center";
    button.style.gap = "5px";
    button.style.borderRadius = "3px";
    button.style.transition = "background-color 0.2s";

    // Icon
    const icon = document.createElement("span");
    icon.textContent = config.icon;
    icon.style.fontSize = "16px";

    // Text
    const text = document.createElement("span");
    text.textContent = config.name;
    text.style.fontSize = "12px";

    button.appendChild(icon);
    button.appendChild(text);

    // Hover effect
    button.addEventListener("mouseover", () => {
      button.style.backgroundColor = "rgba(255,255,255,0.1)";
    });
    button.addEventListener("mouseout", () => {
      button.style.backgroundColor = "transparent";
    });

    // Click event
    button.addEventListener(
      "click",
      () => saveQuoteAction(selectedText, type),
      {
        once: true,
      }
    );

    popup.appendChild(button);
  });

  document.body.appendChild(popup);

  // Function to remove the popup when clicking outside of it
  document.addEventListener("mousedown", (e) => removePopupOnClickOutside(e), {
    once: true,
  });
}

/**
 * Save action for the selected text and notify the user.
 * @param {string} text - The text to be saved.
 * @param {string} type - The type of text (quote, code, etc.).
 */
function saveQuoteAction(text, type = "quote") {
  // Validate text length
  if (text.length < 10) {
    // Create and style custom alert
    const alertDiv = document.createElement("div");
    alertDiv.style.position = "fixed";
    alertDiv.style.top = "20px";
    alertDiv.style.left = "50%";
    alertDiv.style.transform = "translateX(-50%)";
    alertDiv.style.backgroundColor = "#f44336";
    alertDiv.style.color = "white";
    alertDiv.style.padding = "15px 20px";
    alertDiv.style.borderRadius = "4px";
    alertDiv.style.zIndex = "10000";
    alertDiv.style.boxShadow = "0 2px 5px rgba(0,0,0,0.2)";
    alertDiv.style.animation = "fadeIn 0.3s ease-in-out";
    alertDiv.textContent = "Could you please select a longer text?";

    // Add fade in animation
    const style = document.createElement("style");
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; transform: translate(-50%, -20px); }
        to { opacity: 1; transform: translate(-50%, 0); }
      }
      @keyframes fadeOut {
        from { opacity: 1; transform: translate(-50%, 0); }
        to { opacity: 0; transform: translate(-50%, -20px); }
      }
    `;
    document.head.appendChild(style);

    // Add alert to page
    document.body.appendChild(alertDiv);

    // Remove alert after 3 seconds
    setTimeout(() => {
      alertDiv.style.animation = "fadeOut 0.3s ease-in-out";
      setTimeout(() => {
        document.body.removeChild(alertDiv);
        document.head.removeChild(style);
      }, 300);
    }, 3000);

    // Remove popup
    if (popup) {
      document.body.removeChild(popup);
      popup = null;
    }

    return;
  }

  let url = new URL(window.location.href);
  let params = new URLSearchParams(url.search);

  // Delete current url quote
  params.delete("quote");

  url.search = params.toString();
  url = url.toString();

  const quote = {
    id: window.crypto.randomUUID(),
    text,
    type,
    style: TEXT_TYPES[type].style,
    url,
    createdAt: new Date().toLocaleDateString("en-US", {
      year: "numeric",
      day: "numeric",
      month: "long",
    }),
    icon:
      document.querySelector("link[rel~='apple-touch-icon']")?.href ||
      document.querySelector("link[rel~='icon']")?.href ||
      document.querySelector("link[rel~='favicon']")?.href,
    site: window.location.hostname,
    siteName: window.location.hostname.replace("www.", ""),
  };

  chrome.runtime.sendMessage({ action: SAVE_ACTION, quote });

  if (popup) {
    document.body.removeChild(popup);
    popup = null;
  }
}

/**
 * Remove the popup if the user clicks outside of it.
 * @param {MouseEvent} e - The mouse event.
 */
function removePopupOnClickOutside(e) {
  if (!popup?.contains(e.target) && e.target.id !== SAVE_BUTTON_ID) {
    if (popup) {
      document.body.removeChild(popup);
      popup = null; // Update popup status
    }
  }
}

// Event listener for mouseup events
document.addEventListener("mouseup", (event) => {
  const selectedText = window.getSelection().toString().trim();
  if (selectedText && !popup) {
    createPopup(event, selectedText); // Create and display the popup
  }
});

window.addEventListener("load", () => {
  const currentUrl = window.location.href;

  chrome.storage.local.get(["quotes"], (result) => {
    const quotes = result["quotes"];

    const quoteText = quotes?.find(({ url }) => {
      return new URL(url).href === currentUrl;
    })?.text;

    quoteText && highlightQuote(quoteText);
  });
});

function highlightQuote(quoteText) {
  const isPdf =
    document.querySelector('embed[type="application/pdf"]') ||
    document.querySelector('iframe[src$=".pdf"]');

  // Exit if the page is a PDF document
  if (isPdf) return;

  if (!quoteText) throw new Error("no quote passed");

  // Remove any previous highlights
  const existingHighlights = document.querySelectorAll(".save-quote-highlight");
  existingHighlights.forEach((h) => h.remove());

  // Clear any existing selection
  window.getSelection().removeAllRanges();

  // Try to find the text
  const found = window.find(quoteText, false, false, true, false, true, false);

  if (found) {
    // Get the selection
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);

    // Create highlight overlays for the selection
    function createHighlightOverlays() {
      const rects = range.getClientRects();
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;
      const highlights = [];

      // Remove existing highlights
      document
        .querySelectorAll(".save-quote-highlight")
        .forEach((h) => h.remove());

      // Create new highlights
      for (const rect of rects) {
        const highlight = document.createElement("div");
        highlight.className = "save-quote-highlight";
        highlight.style.position = "absolute";
        highlight.style.backgroundColor = "rgb(140 124 63 / 30%)";
        highlight.style.pointerEvents = "none";
        highlight.style.zIndex = "9";

        // Position the highlight
        highlight.style.left = `${rect.left + scrollX}px`;
        highlight.style.top = `${rect.top + scrollY}px`;
        highlight.style.width = `${rect.width}px`;
        highlight.style.height = `${rect.height}px`;

        document.body.appendChild(highlight);
        highlights.push(highlight);
      }

      return highlights;
    }

    // Create initial highlights
    const highlights = createHighlightOverlays();

    if (highlights.length > 0) {
      // Scroll to the first highlight
      requestAnimationFrame(() => {
        const rect = highlights[0].getBoundingClientRect();
        window.scrollTo({
          top: rect.top + window.scrollY - window.innerHeight / 2,
          behavior: "smooth",
        });
      });

      // Update highlights on resize
      const resizeObserver = new ResizeObserver(() => {
        createHighlightOverlays();
      });
      resizeObserver.observe(document.body);

      // Update highlights on scroll
      let scrollTimeout;
      window.addEventListener(
        "scroll",
        () => {
          if (scrollTimeout) {
            clearTimeout(scrollTimeout);
          }
          scrollTimeout = setTimeout(() => {
            createHighlightOverlays();
          }, 100);
        },
        { passive: true }
      );
    }

    // Clear the selection after creating highlights
    window.getSelection().removeAllRanges();
  }
}

// Listen for messages from the background or popup scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "highlightQuote") {
    highlightQuote(request.quoteText);
  }
});
