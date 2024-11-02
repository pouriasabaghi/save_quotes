// Log to extension console
const log = (data) =>
  chrome.runtime.sendMessage({
    action: "log",
    data,
  });

// Get from user storage
const getFromStorage = (name, callback) => {
  chrome.storage.local.get([name], function (result) {
    callback(result[name]);
  });
};

// Function to get the current tab's URL
function getCurrentTabUrl(callback) {
  // Use chrome.tabs.query to get the active tab
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs.length > 0) {
      // Get the URL of the active tab
      const currentTab = tabs[0];
      callback(currentTab.url); // Call the callback function with the tab's URL
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  let currentUrl;
  getCurrentTabUrl((url) => {
    currentUrl = url;
  });
  const quotesUl = document.querySelector("#quotes");

  getFromStorage("quotes", (quotes) => {
    quotesUl.innerHTML =
      quotes && quotes.length
        ? generateQuoteList(quotes.reverse())
        : `<div class="intro">
              <p>You haven’t saved any quotes yet.</p>
              <p>  It’s super easy! Just highlight a part of the text you want, then click ‘Save icon’ on the popup, or right-click and choose ‘Save quote’ from the menu. Ta-da!</p>
           </div>`;

    addEventsToQuoteItems();
  });

  /**
   * Generates an HTML list of quotes.
   * @param {Array} quotes - The array of quote objects.
   * @returns {string} - The generated HTML string for the quote list.
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
   * Creates the HTML for a quote link.
   * @param {Object} quote - The quote object containing text and URL.
   * @returns {string} - The generated HTML string for the quote link.
   */
  function createQuoteLink(quote) {
    const isCurrentUrl = new URL(quote.url).href === currentUrl;

    if (isCurrentUrl) {
      return `<a data-quote="${quote.text}"  class="quotes--item-link" href="#">Scroll to Quote</a>`;
    }

    return `<a data-quote="${quote.text}" class="quotes--item-link" target="_blank" href="${quote.url}">Check Quote</a>`;
  }

  /**
   * Creates the HTML for a list item containing a quote.
   * @param {string} linkTag - The HTML string for the quote link.
   * @param {Object} quote - The quote object containing text and URL.
   * @returns {string} - The generated HTML string for the list item.
   */
  function createQuoteListItem(linkTag, quote) {
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
            <div class="quotes--item-desc">
                <p class="text-line-overflow">${quote.text}</p>
                ${linkTag}
           
            </div>
                 <small role="button" class='delete-quote' data-id="${
                   quote.id
                 }">
                 <img src="/delete.svg" alt="delete" />
                 </small>
          </li>`;
  }

  function addEventsToQuoteItems() {
    const quotesItems = document.querySelectorAll(".quotes--item a");
    quotesItems?.forEach((item) =>
      item.addEventListener("click", handleHighlightAction)
    );

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

    const quotesDelete = document.querySelectorAll(
      ".quotes--item .delete-quote"
    );
    quotesDelete?.forEach((item) =>
      item.addEventListener("click", handleDeleteQuote)
    );

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
