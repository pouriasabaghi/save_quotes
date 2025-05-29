// Chrome extension logging utility
const log = (data) =>
  chrome.runtime.sendMessage({
    action: "log",
    data,
  });

// Utility function to get data from chrome.storage with Promise
const getFromStorage = (name) => {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get([name], function (result) {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result[name]);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
};

// Get the URL of the current active tab with Promise
function getCurrentTabUrl() {
  return new Promise((resolve, reject) => {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else if (tabs.length > 0) {
          resolve(tabs[0].url);
        } else {
          reject(new Error('No active tab found'));
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Show error message to user
function showError(message, duration = 3000) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.textContent = message;
  document.body.appendChild(errorDiv);
  
  setTimeout(() => {
    errorDiv.remove();
  }, duration);
}

// Show success message to user
function showSuccess(message, duration = 3000) {
  const successDiv = document.createElement('div');
  successDiv.className = 'success-message';
  successDiv.textContent = message;
  document.body.appendChild(successDiv);
  
  setTimeout(() => {
    successDiv.remove();
  }, duration);
}

document.addEventListener("DOMContentLoaded", async () => {
  let currentUrl;
  try {
    currentUrl = await getCurrentTabUrl();
  } catch (error) {
    console.error('Error getting current tab URL:', error);
    showError('Error accessing tab information');
  }

  const quotesUl = document.querySelector("#quotes");

  // Function to render quotes
  function renderQuotes(quotes) {
    try {
      quotesUl.innerHTML = quotes && quotes.length
        ? generateQuoteList(quotes.reverse())
        : `<div class="intro">
              <p>You haven't saved any quotes yet.</p>
              <p>  It's super easy! Just highlight a part of the text you want, then click 'Save icon' on the popup, or right-click and choose 'Save quote' from the menu. Ta-da!</p>
           </div>`;

      addEventsToQuoteItems();
    } catch (error) {
      console.error('Error rendering quotes:', error);
      showError('Error displaying quotes');
    }
  }

  // Load and display saved quotes from storage
  async function loadQuotes() {
    try {
      const quotes = await getFromStorage("quotes");
      renderQuotes(quotes);
    } catch (error) {
      console.error('Error loading quotes:', error);
      showError('Error loading saved quotes');
    }
  }

  // Initial load
  await loadQuotes();

  // Settings functionality
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsPanel = document.getElementById('settingsPanel');
  const popupToggle = document.getElementById('popupEnabled');

  // Load settings from storage
  async function loadSettings() {
    try {
      const settings = await getFromStorage('settings') || { popupEnabled: true };
      popupToggle.checked = settings.popupEnabled;
      
      // Try to send settings to content script, but don't throw if it fails
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) {
          await new Promise((resolve) => {
            chrome.tabs.sendMessage(
              tabs[0].id,
              {
                action: "updateSettings",
                settings: settings
              },
              // Add response callback to handle potential errors
              (response) => {
                if (chrome.runtime.lastError) {
                  // Content script not ready/available - this is fine
                  console.log('Content script not ready yet:', chrome.runtime.lastError.message);
                }
                resolve();
              }
            );
          });
        }
      } catch (contentError) {
        // Ignore content script communication errors
        console.log('Could not update content script settings (this is normal if on extension page):', contentError);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      showError('Error loading settings');
    }
  }

  // Initial settings load
  await loadSettings();

  // Toggle settings panel
  settingsBtn.addEventListener('click', () => {
    settingsPanel.classList.toggle('hidden');
  });

  // Handle settings changes
  popupToggle.addEventListener('change', async (e) => {
    try {
      const settings = { popupEnabled: e.target.checked };
      
      // Save settings
      await chrome.storage.local.set({ settings });
      
      // Send settings update to content script
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        try {
          await new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: "updateSettings",
              settings: settings
            }, response => {
              if (chrome.runtime.lastError) {
                // This error is expected when the content script is not loaded
                // Just save the settings and don't show an error
                resolve();
              } else {
                resolve(response);
              }
            });
          });
          
          showSuccess('Settings saved successfully');
        } catch (err) {
          // Content script communication error, but settings were saved
          console.log('Settings saved but content script not updated:', err);
        }
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      showError('Error saving settings');
      e.target.checked = !e.target.checked; // Revert the toggle
    }
  });

  // Initialize filter buttons
  const filterButtons = document.querySelectorAll('.filter-btn');
  let currentFilter = 'all';

  // Add click handlers to filter buttons
  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      const filterType = button.dataset.type;
      
      // Update active button
      filterButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // Update current filter and apply it
      currentFilter = filterType;
      applyFilter();
    });
  });

  // Function to apply the current filter
  function applyFilter() {
    try {
      const items = document.querySelectorAll('.quotes--item');
      items.forEach(item => {
        const type = item.querySelector('.quotes--item-desc').classList[1].replace('-container', '');
        if (currentFilter === 'all' || type === currentFilter) {
          item.classList.remove('hidden');
        } else {
          item.classList.add('hidden');
        }
      });
    } catch (error) {
      console.error('Error applying filter:', error);
      showError('Error filtering quotes');
    }
  }

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
   * Safely encode text for use in HTML attributes
   * @param {string} str - The string to encode
   * @returns {string} - The encoded string
   */
  function encodeForAttribute(str) {
    return str.replace(/&/g, '&amp;')
              .replace(/'/g, '&apos;')
              .replace(/"/g, '&quot;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/\n/g, '&#10;')
              .replace(/\r/g, '&#13;');
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
    // Convert style string from quote style object
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
                <div class="edit-wrapper">
                    <textarea class="edit-textarea" data-original-text="${encodeForAttribute(quote.text)}">${quote.text}</textarea>
                    <div class="edit-actions">
                        <button class="cancel-edit-btn">Cancel</button>
                        <button class="save-edit-btn">Save</button>
                    </div>
                </div>
                <div class="action-buttons">
                    ${linkTag}
                    <button class="copy-btn" data-text="${encodeForAttribute(quote.text)}">
                        Copy
                    </button>
                    <button class="edit-btn">
                        Edit
                    </button>
                </div>
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

    // Add click handlers for copy buttons
    const copyButtons = document.querySelectorAll(".copy-btn");
    copyButtons?.forEach(button => {
      button.addEventListener("click", handleCopy);
    });

    // Add click handlers for edit buttons
    const editButtons = document.querySelectorAll(".edit-btn");
    editButtons?.forEach(button => {
      button.addEventListener("click", handleEdit);
    });

    // Add click handlers for cancel edit buttons
    const cancelEditButtons = document.querySelectorAll(".cancel-edit-btn");
    cancelEditButtons?.forEach(button => {
      button.addEventListener("click", handleCancelEdit);
    });

    // Add click handlers for save edit buttons
    const saveEditButtons = document.querySelectorAll(".save-edit-btn");
    saveEditButtons?.forEach(button => {
      button.addEventListener("click", handleSaveEdit);
    });

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

    // Handle copying text
    function handleCopy(e) {
      const text = e.target.dataset.text;
      // Decode HTML entities before copying
      const decodedText = text.replace(/&quot;/g, '"')
                             .replace(/&apos;/g, "'")
                             .replace(/&lt;/g, '<')
                             .replace(/&gt;/g, '>')
                             .replace(/&amp;/g, '&')
                             .replace(/&#10;/g, '\n')
                             .replace(/&#13;/g, '\r');

      navigator.clipboard.writeText(decodedText).then(() => {
        // Change button text temporarily to show feedback
        const button = e.target;
        const originalText = button.textContent;
        button.textContent = "Copied!";
        button.classList.add("copied");
        
        setTimeout(() => {
          button.textContent = originalText;
          button.classList.remove("copied");
        }, 2000);
      });
    }

    // Handle edit button click
    function handleEdit(e) {
      const quoteItem = e.target.closest(".quotes--item");
      quoteItem.querySelector(".quotes--item-desc").classList.add("edit-mode");
    }

    // Handle cancel edit
    function handleCancelEdit(e) {
      const quoteItem = e.target.closest(".quotes--item");
      const textarea = quoteItem.querySelector(".edit-textarea");
      const originalText = textarea.dataset.originalText;
      
      // Reset textarea content
      textarea.value = originalText;
      
      // Exit edit mode
      quoteItem.querySelector(".quotes--item-desc").classList.remove("edit-mode");
    }

    // Handle save edit
    async function handleSaveEdit(e) {
      try {
        const quoteItem = e.target.closest(".quotes--item");
        const quoteId = quoteItem.querySelector(".delete-quote").dataset.id;
        const textarea = quoteItem.querySelector(".edit-textarea");
        const newText = textarea.value.trim();
        
        if (newText.length < 10) {
          showError("Text must be at least 10 characters long");
          return;
        }

        // Get current quotes
        const quotes = await getFromStorage("quotes") || [];
        const quoteIndex = quotes.findIndex(q => q.id === quoteId);
        
        if (quoteIndex === -1) {
          throw new Error("Quote not found");
        }

        // Update the quote
        quotes[quoteIndex].text = newText;

        // Save to storage
        await new Promise((resolve, reject) => {
          chrome.storage.local.set({ quotes }, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        });

        // Update UI
        const contentWrapper = quoteItem.querySelector(".content-wrapper");
        const copyBtn = quoteItem.querySelector(".copy-btn");
        const visitLink = quoteItem.querySelector(".quotes--item-link");
        
        if (quotes[quoteIndex].type === 'code') {
          contentWrapper.innerHTML = `<pre class="code-block"><code>${escapeHtml(newText)}</code></pre>`;
        } else {
          contentWrapper.innerHTML = `<p class="text-line-overflow">${newText}</p>`;
        }
        
        copyBtn.dataset.text = newText;
        visitLink.dataset.quote = newText;
        textarea.dataset.originalText = newText;

        // Exit edit mode
        quoteItem.querySelector(".quotes--item-desc").classList.remove("edit-mode");
        
        showSuccess("Changes saved successfully");
      } catch (error) {
        console.error('Error saving changes:', error);
        showError('Error saving changes');
      }
    }

    // Add click handlers for delete buttons
    const deleteButtons = document.querySelectorAll(".delete-quote");
    deleteButtons?.forEach((button) =>
      button.addEventListener("click", async (e) => {
        try {
          if (!confirm("Are you sure?")) return;

          const quoteId = e.target.closest('[data-id]').dataset.id;
          const quotes = await getFromStorage("quotes") || [];
          const updatedQuotes = quotes.filter(quote => quote.id !== quoteId);
          
          await new Promise((resolve, reject) => {
            chrome.storage.local.set({ quotes: updatedQuotes }, () => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve();
              }
            });
          });

          // Remove the quote element from UI
          const quoteElement = e.target.closest("li");
          if (quoteElement) {
            quoteElement.remove();
          }

          showSuccess('Deleted successfully');

          // If no quotes left, show intro message
          if (updatedQuotes.length === 0) {
            renderQuotes([]);
          }
        } catch (error) {
          console.error('Error deleting quote:', error);
          showError('Error deleting quote');
        }
      })
    );
  }

  // Backup & Restore functionality
  const backupBtn = document.getElementById('backupBtn');
  const restoreInput = document.getElementById('restoreInput');
  const restoreBtn = document.getElementById('restoreBtn');

  backupBtn.addEventListener('click', async () => {
    try {
      // Get all data from storage
      const data = await new Promise((resolve, reject) => {
        chrome.storage.local.get(null, (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(result);
          }
        });
      });
      
      // Convert data to JSON string with proper formatting
      const backup = JSON.stringify(data, null, 2);
      
      // Create blob and download link
      const blob = new Blob([backup], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      
      // Set filename with current date
      const date = new Date().toISOString().split('T')[0];
      a.download = `quotes-backup-${date}.json`;
      a.href = url;
      
      // Trigger download
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showSuccess('Backup downloaded successfully');
    } catch (error) {
      console.error('Error creating backup:', error);
      showError('Error creating backup');
    }
  });

  // Enable/disable restore button based on textarea content
  restoreInput.addEventListener('input', () => {
    const jsonContent = restoreInput.value.trim();
    restoreBtn.disabled = jsonContent.length === 0;
  });

  // Handle restore button click
  restoreBtn.addEventListener('click', async () => {
    try {
      const jsonContent = restoreInput.value.trim();
      
      if (!jsonContent) {
        showError('Please paste your backup JSON first');
        return;
      }

      // Try to parse the JSON
      const newData = JSON.parse(jsonContent);
      
      // Validate backup data
      if (!newData.quotes || !Array.isArray(newData.quotes)) {
        throw new Error('Invalid backup format: missing or invalid quotes array');
      }

      // Get existing data
      const existingData = await new Promise((resolve, reject) => {
        chrome.storage.local.get(null, (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(result);
          }
        });
      });

      // Merge quotes: Add new quotes while avoiding duplicates
      const existingQuotes = existingData.quotes || [];
      const existingIds = new Set(existingQuotes.map(quote => quote.id));
      const newQuotes = newData.quotes.filter(quote => !existingIds.has(quote.id));
      const mergedQuotes = [...existingQuotes, ...newQuotes];

      // Merge settings if they exist in the backup
      const mergedSettings = {
        ...existingData.settings,
        ...newData.settings
      };

      // Save merged data
      await new Promise((resolve, reject) => {
        chrome.storage.local.set({
          quotes: mergedQuotes,
          settings: mergedSettings
        }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });

      // Update UI with merged data
      renderQuotes(mergedQuotes);
      
      // Update settings UI if needed
      if (newData.settings) {
        popupToggle.checked = mergedSettings.popupEnabled;
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) {
          try {
            await chrome.tabs.sendMessage(tabs[0].id, {
              action: "updateSettings",
              settings: mergedSettings
            });
          } catch (err) {
            console.log('Settings restored but content script not updated:', err);
          }
        }
      }

      // Clear the textarea
      restoreInput.value = '';
      restoreBtn.disabled = true;

      // Show success message with count of new items
      showSuccess(`Restored successfully! Added ${newQuotes.length} new quotes.`);
    } catch (error) {
      console.error('Error restoring backup:', error);
      showError(error.message || 'Invalid backup data. Please check the JSON format.');
    }
  });
});
