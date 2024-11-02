const SAVE_BUTTON_ID = "saveTextBtn";
const SAVE_ACTION = "saveText";
const SAVE_ICON =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAEPSURBVHgBpZO9agJBFIXP3aRICJENaYRgSBeDCaxNXiAPEiwES20VLPUVBAvRQtFGbcRCwUIsbBREsBR/wHLf4Doz/qCu4rr7VXNn5hzOXOYSBLrX/0HgHBgGCDquwagxUcxcTaakxMwDW8JDCCYzBe8en15zojBwOw8EGPTi/WQ4RaTQ4AaGfn+6N+y38e57U+tGs43ZfIFI+F/Vs/kSxu/f0X1Lgp1Y4vE84zvwdfbsosGtWAwy2TxG48m+bjRb6Pb69g3iybQykZTKVbEuIJFM7eurBpKfgF81rFTZCHzbtxcrVgN3/0AlYJhwgcaEIRzCjLroAYUcpZAaoqgmR1KMZlAkqdkViqZ1pEZq1zYGWKqmSV/IAAAAAElFTkSuQmCC";
let popup; // Variable to hold the popup status

/**
 * Create and display a popup with a save button near the selected text.
 * @param {MouseEvent} event - The mouse event that triggered the popup.
 * @param {string} selectedText - The text that the user has selected.
 */
function createPopup(event, selectedText) {
  // Create the popup div
  popup = document.createElement("div");
  popup.innerHTML = `
  <img id=${SAVE_BUTTON_ID} src="${SAVE_ICON}" />
  `;
  stylePopup(popup, event); // Style the popup
  document.body.appendChild(popup); // Add the popup to the document body

  // Add click event listener to the save button
  const saveButton = document.getElementById(SAVE_BUTTON_ID);
  saveButton.addEventListener("click", () => saveQuoteAction(selectedText), {
    once: true,
  });

  // Function to remove the popup when clicking outside of it
  document.addEventListener("mousedown", (e) => removePopupOnClickOutside(e), {
    once: true,
  });
}

/**
 * Style the popup based on the mouse position.
 * @param {HTMLElement} popup - The popup element.
 * @param {MouseEvent} event - The mouse event to position the popup.
 */
function stylePopup(popup, event) {
  popup.style.position = "absolute";
  popup.style.top = `${event.pageY + 5}px`;
  popup.style.left = `${event.pageX + 10}px`;
  popup.style.background = "#4c3f3f";
  popup.style.padding = "5px";
  popup.style.borderRadius = "5px";
  popup.style.zIndex = "1000";
  popup.style.cursor = "pointer";
}

/**
 * Save action for the selected text and notify the user.
 * @param {string} text - The text to be saved.
 */
function saveQuoteAction(text) {
  let url = new URL(window.location.href);
  let params = new URLSearchParams(url.search);

  // Delete current url quote
  params.delete("quote");

  url.search = params.toString();
  url = url.toString();

  const quote = {
    id: window.crypto.randomUUID(),
    text,
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
    document.body.removeChild(popup); // Remove the popup after clicking
    popup = null; // Update popup status
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

// Focus on current quote
/* window.addEventListener("load", () => {
  const urlParams = new URLSearchParams(window.location.search);
  let quoteText = urlParams.get("quote");
  quoteText = decodeURIComponent(quoteText);

  highlightQuote(quoteText);
}); */

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

  const escapeRegExp = (text) => {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  };

  if (!quoteText) throw new Error("no quote passed"); // Throw an error if no quote is passed

  const escapedQuoteText = escapeRegExp(quoteText);
  const regex = new RegExp(escapedQuoteText, "g");

  // Create TreeWalker to traverse the DOM and find matching text nodes
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        if (regex.test(node.nodeValue)) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_REJECT;
      },
    }
  );

  // Remove any previous highlights
  const existingHighlights = document.querySelectorAll("span[data-save-quote]");
  existingHighlights.forEach((highlight) => {
    const parent = highlight.parentNode;
    parent.replaceChild(
      document.createTextNode(highlight.textContent),
      highlight
    );
  });

  let node;
  while ((node = walker.nextNode())) {
    const parent = node.parentNode;

    // Check if the text has already been highlighted
    if (parent && !parent.querySelector("span[data-save-quote]")) {
      const span = document.createElement("span");
      span.style.fontWeight = "bolder";
      span.style.background = "rgb(140 124 63 / 30%)";
      span.dataset.saveQuote = true;

      // Save the original text
      const originalText = node.nodeValue;

      // Replace the original text with highlighted text
      const highlightedText = originalText.replace(regex, (matchedText) => {
        span.textContent = matchedText; // Set the text of the span
        return span.outerHTML; // Output span for replacement in the text
      });

      // Replace the original text with the highlighted version
      parent.innerHTML = parent.innerHTML.replace(
        originalText,
        highlightedText
      );
    }
  }

  // Scroll to the highlighted element
  const highlightedElement = document.querySelector("span[data-save-quote]");
  highlightedElement?.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });
}

// Listen for messages from the background or popup scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "highlightQuote") {
    highlightQuote(request.quoteText);
  }
});
