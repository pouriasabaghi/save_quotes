// Chrome extension logging utility
const log = (data) =>
  chrome.runtime.sendMessage({
    action: "log",
    data,
  });

// Utility function to get data from chrome.storage
const getFromStorage = (name, callback) => {
  chrome.storage.local.get([name], function (result) {
    callback(result[name]);
  });
};

// Get the URL of the current active tab
function getCurrentTabUrl(callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs.length > 0) {
      const currentTab = tabs[0];
      callback(currentTab.url);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  let currentUrl;
  getCurrentTabUrl((url) => {
    currentUrl = url;
  });
  const quotesUl = document.querySelector("#quotes");

  // Load and display saved quotes from storage
  getFromStorage("quotes", (quotes) => {
    quotesUl.innerHTML =
      quotes && quotes.length
        ? generateQuoteList(quotes.reverse())
        : `<div class="intro">
              <p>You haven't saved any quotes yet.</p>
              <p>  It's super easy! Just highlight a part of the text you want, then click 'Save icon' on the popup, or right-click and choose 'Save quote' from the menu. Ta-da!</p>
           </div>`;

    addEventsToQuoteItems();
  });

  /**
   * Generates the HTML for the entire list of saved quotes
   * Reverses the array to show newest quotes first
   */
  function generateQuoteList(quotes) {
    return quotes
      .map((quote, index) => {
        const linkTag = createQuoteLink(quote);
        return createQuoteListItem(linkTag, quote);
      })
      .join("");
  }

  /**
   * Utility function to safely escape HTML special characters
   * Used for both code blocks and data attributes to prevent XSS and HTML injection
   */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Creates a link element for the quote
   * If we're on the same page as the quote, shows "Visit" link
   * Otherwise creates an external link to the quote's original page
   */
  function createQuoteLink(quote) {
    const isCurrentUrl = new URL(quote.url).href === currentUrl;

    if (isCurrentUrl) {
      return `<a data-quote="${escapeHtml(quote.text)}"  class="quotes--item-link" href="#">Visit</a>`;
    }

    return `<a data-quote="${escapeHtml(quote.text)}" class="quotes--item-link" target="_blank" href="${quote.url}">Visit</a>`;
  }

  /**
   * Creates a list item for a single quote
   * Handles different types of quotes (regular text and code)
   * Applies appropriate styling based on the quote type
   */
  function createQuoteListItem(linkTag, quote) {
    // Convert style object to CSS string
    const styleString = quote.style ? 
      Object.entries(quote.style)
        .map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`)
        .join(';')
      : '';

    // Handle different content types (code vs regular quote)
    const typeClass = quote.type || 'quote';
    const textContent = quote.type === 'code' 
      ? `<pre class="code-block"><code>${escapeHtml(quote.text)}</code></pre>`
      : `<p class="text-line-overflow">${quote.text}</p>`;

    return ` 
      <li class="quotes--item quotes--header-label">
            <div class="quotes--item-image">
            ${
              quote.icon
                ? ` <img src="${quote.icon}" />`
                : ` <span class='no-image'><img src="icon-48px.png" alt="save quote"/></span>`
            }    
              <div class="quotes--item-detail">
                <h3>${quote.siteName}</h3>
                <span>${quote.createdAt}</span>
              </div>
            </div>
            <div class="quotes--item-desc ${typeClass}-container">
                <div class="content-wrapper" style="${styleString}">
                    ${textContent}
                </div>
                ${linkTag}
            </div>
            <small role="button" class='delete-quote' data-id="${quote.id}">
                <img src="/delete.svg" alt="delete" />
            </small>
          </li>`;
  }

  /**
   * Add event listeners to quote items
   * Handles both highlighting quotes in the original page
   * and deleting quotes from storage
   */
  function addEventsToQuoteItems() {
    // Add click handlers for quote links
    const quotesItems = document.querySelectorAll(".quotes--item a");
    quotesItems?.forEach((item) =>
      item.addEventListener("click", handleHighlightAction)
    );

    // Highlight the selected quote in the original page
    function handleHighlightAction(e) {
      const li = e.target.closest("li");
      const quoteText = li.querySelector("[data-quote]").dataset.quote;
      
      // Send message to content script to highlight the quote
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "highlightQuote",
          quoteText: quoteText,
        });

        window.close();
      });
    }

    // Add click handlers for delete buttons
    const quotesDelete = document.querySelectorAll(
      ".quotes--item .delete-quote"
    );
    quotesDelete?.forEach((item) =>
      item.addEventListener("click", handleDeleteQuote)
    );

    // Handle quote deletion with confirmation
    function handleDeleteQuote(e) {
      if (!confirm("Are you sure?")) return;

      getFromStorage("quotes", (quotes) => {
        quotes = quotes.filter((quote) => quote.id != e.target.closest('[data-id]').dataset.id);
        chrome.storage.local.set({ quotes }, function () {
          e.target.closest("li").remove();
          if (quotes.length === 0) window.close();
        });
      });
    }
  }
});
