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
  // Initialize state variables
  let currentQuotes = [];
  let currentFilter = 'all';
  let currentLabels = [];

  // Initialize DOM elements
  const quotesUl = document.querySelector("#quotes");
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  const searchContainer = document.querySelector('.search-container');
  const labelsList = document.getElementById('labelsList');
  const newLabelInput = document.getElementById('newLabelInput');
  const addLabelBtn = document.getElementById('addLabelBtn');
  const labelColorsDiv = document.querySelector('.label-colors');
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsPanel = document.getElementById('settingsPanel');
  const popupToggle = document.getElementById('popupEnabled');
  const backupBtn = document.getElementById('backupBtn');
  const restoreInput = document.getElementById('restoreInput');
  const restoreBtn = document.getElementById('restoreBtn');

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

  // Predefined colors for labels
  const LABEL_COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
    '#FFEEAD', '#D4A5A5', '#9B59B6', '#3498DB',
    '#E67E22', '#2ECC71', '#F1C40F', '#34495E'
  ];

  let currentUrl;
  try {
    currentUrl = await getCurrentTabUrl();
  } catch (error) {
    console.error('Error getting current tab URL:', error);
    showError('Error accessing tab information');
  }

  // Toggle search box
  searchBtn.addEventListener('click', () => {
    searchContainer.classList.toggle('hidden');
    if (!searchContainer.classList.contains('hidden')) {
      searchInput.focus();
    }
  });

  // Debounce function for search
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Function to filter and search quotes
  function filterAndSearchQuotes() {
    const searchTerm = searchInput.value.toLowerCase();
    let filteredQuotes = [...currentQuotes];

    // Apply type filter if active
    const activeTypeFilter = document.querySelector('.filter-btn.active').dataset.type;
    if (activeTypeFilter !== 'all') {
      filteredQuotes = filteredQuotes.filter(quote => quote.type === activeTypeFilter);
    }

    // Apply search term filter
    if (searchTerm) {
      filteredQuotes = filteredQuotes.filter(quote => 
        quote.text.toLowerCase().includes(searchTerm) ||
        quote.siteName.toLowerCase().includes(searchTerm) ||
        quote.site.toLowerCase().includes(searchTerm)
      );
    }

    // Render filtered quotes without reversing since they're already in the right order
    if (filteredQuotes.length === 0) {
      quotesUl.innerHTML = '<div class="no-results">No matching quotes found</div>';
    } else {
      renderQuotes(filteredQuotes, false);
    }
  }

  // Function to render quotes
  function renderQuotes(quotes, reverse = false) {
    try {
      // Only reverse if explicitly requested
      const quotesToRender = reverse ? [...quotes].reverse() : quotes;
      
      quotesUl.innerHTML = quotes && quotes.length
        ? generateQuoteList(quotesToRender)
        : `<div class="intro">
              <p>You haven't saved any quotes yet.</p>
              <p>It's super easy! Just highlight a part of the text you want, then click 'Save icon' on the popup, or right-click and choose 'Save quote' from the menu. Ta-da!</p>
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
      const quotes = await getFromStorage("quotes") || [];
      // Store quotes in reverse order initially
      currentQuotes = [...quotes].reverse();
      // Load labels first to ensure they're available when rendering quotes
      await loadLabels();
      // Don't reverse again since currentQuotes is already reversed
      renderQuotes(currentQuotes, false);
    } catch (error) {
      console.error('Error loading quotes:', error);
      showError('Error loading saved quotes');
    }
  }

  // Load labels from storage
  async function loadLabels() {
    try {
      const labels = await getFromStorage("labels") || [];
      currentLabels = labels;
      renderLabels();
    } catch (error) {
      console.error('Error loading labels:', error);
      showError('Error loading labels');
    }
  }

  // Initial load
  await loadQuotes();

  // Settings functionality
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

  // Add click handlers to filter buttons
  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      const filterType = button.dataset.type;
      
      // Update active button
      filterButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // Update current filter and apply it
      currentFilter = filterType;
      filterAndSearchQuotes();
    });
  });

  // Search functionality
  const searchField = document.getElementById('searchField');
  const dateFilter = document.getElementById('dateFilter');

  // Function to highlight matching text
  function highlightMatches(text, searchTerm) {
    if (!searchTerm) return text;
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return text.replace(regex, '<span class="highlight-match">$1</span>');
  }

  // Function to check if a date is within a specific range
  function isDateInRange(dateStr, range) {
    const date = new Date(dateStr);
    const now = new Date();
    
    switch (range) {
      case 'today':
        return date.toDateString() === now.toDateString();
      case 'week':
        const weekAgo = new Date(now.setDate(now.getDate() - 7));
        return date >= weekAgo;
      case 'month':
        const monthAgo = new Date(now.setMonth(now.getMonth() - 1));
        return date >= monthAgo;
      case 'year':
        const yearAgo = new Date(now.setFullYear(now.getFullYear() - 1));
        return date >= yearAgo;
      default:
        return true;
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

    const quoteLabels = quote.labels || [];
    const labelsHtml = quoteLabels.length ? `
      <div class="quote-labels">
        ${quoteLabels.map(labelId => {
          const label = currentLabels.find(l => l.id === labelId);
          if (!label) return '';
          return `<span class="quote-label" style="background-color: ${label.color}">${label.name}</span>`;
        }).join('')}
      </div>
    ` : '';

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
                    ${labelsHtml}
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
                    <button class="label-btn" data-quote-id="${quote.id}">
                        Labels
                    </button>
                </div>
            </div>
            <small role="button" class='delete-quote' data-id="${quote.id}">
                <img src="/delete.svg" alt="delete" />
            </small>
          </li>`;
  }

  // Render color options
  function renderColorOptions() {
    if (!labelColorsDiv) return;
    labelColorsDiv.innerHTML = LABEL_COLORS.map((color, index) => `
      <div class="color-option${index === 0 ? ' selected' : ''}" 
           data-color="${color}" 
           style="background-color: ${color}">
      </div>
    `).join('');
  }

  // Initial render of color options
  renderColorOptions();

  // Color selection handling
  labelColorsDiv?.addEventListener('click', (e) => {
    const colorOption = e.target.closest('.color-option');
    if (colorOption) {
      document.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
      colorOption.classList.add('selected');
    }
  });

  // Enable/disable add label button based on input
  newLabelInput?.addEventListener('input', () => {
    const labelName = newLabelInput.value.trim();
    addLabelBtn.disabled = labelName.length === 0;
  });

  // Add new label
  addLabelBtn?.addEventListener('click', async () => {
    const labelName = newLabelInput.value.trim();
    const selectedColor = document.querySelector('.color-option.selected')?.dataset.color;
    
    if (!selectedColor) {
      showError('Please select a color');
      return;
    }
    
    if (labelName) {
      try {
        // Check for duplicate names
        if (currentLabels.some(label => label.name.toLowerCase() === labelName.toLowerCase())) {
          showError('A label with this name already exists');
          return;
        }

        const newLabel = {
          id: window.crypto.randomUUID(),
          name: labelName,
          color: selectedColor
        };

        currentLabels = [...currentLabels, newLabel];
        await chrome.storage.local.set({ labels: currentLabels });
        
        renderLabels();
        newLabelInput.value = '';
        addLabelBtn.disabled = true;
        showSuccess('Label added successfully');
      } catch (error) {
        console.error('Error adding label:', error);
        showError('Error adding label');
      }
    }
  });

  // Render labels
  function renderLabels() {
    if (!labelsList) return;
    
    labelsList.innerHTML = currentLabels.map(label => `
      <div class="label-item" style="background-color: ${label.color}" data-label-id="${label.id}">
        ${label.name}
        <span class="delete-label" data-label-id="${label.id}">×</span>
      </div>
    `).join('');

    // Add click handlers for labels
    document.querySelectorAll('.label-item').forEach(labelItem => {
      labelItem.addEventListener('click', (e) => {
        if (!e.target.classList.contains('delete-label')) {
          const labelId = labelItem.dataset.labelId;
          // Here you can add functionality for when a label is clicked
          console.log('Label clicked:', labelId);
        }
      });
    });

    // Add delete handlers
    document.querySelectorAll('.delete-label').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const labelId = e.target.dataset.labelId;
        
        if (confirm('Are you sure? This will remove the label from all quotes.')) {
          try {
            // Remove label from all quotes
            const updatedQuotes = currentQuotes.map(quote => ({
              ...quote,
              labels: (quote.labels || []).filter(id => id !== labelId)
            }));

            // Update storage
            currentLabels = currentLabels.filter(label => label.id !== labelId);
            currentQuotes = updatedQuotes;
            
            await chrome.storage.local.set({ 
              labels: currentLabels,
              quotes: updatedQuotes
            });

            renderLabels();
            renderQuotes(currentQuotes);
            showSuccess('Label deleted successfully');
          } catch (error) {
            console.error('Error deleting label:', error);
            showError('Error deleting label');
          }
        }
      });
    });
  }

  // Add label selector functionality
  function addLabelSelectorEvents() {
    const labelButtons = document.querySelectorAll('.label-btn');
    labelButtons?.forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const quoteId = e.target.dataset.quoteId;
        const quote = currentQuotes.find(q => q.id === quoteId);
        if (!quote) return;
        
        const quoteLabels = quote.labels || [];
        
        // Remove any existing selector
        const existingSelector = document.querySelector('.label-selector-content');
        if (existingSelector) {
          existingSelector.remove();
        }
        
        // Create label selector dropdown
        const selectorContent = document.createElement('div');
        selectorContent.className = 'label-selector-content show';
        selectorContent.innerHTML = currentLabels.map(label => `
          <div class="label-selector-item" data-label-id="${label.id}">
            <span class="color-dot" style="background-color: ${label.color}">
              <span class="label-name">${label.name}</span>
            </span>
            ${quoteLabels.includes(label.id) ? '✓' : ''}
          </div>
        `).join('');

        // Position and show dropdown
        const buttonRect = button.getBoundingClientRect();
        selectorContent.style.top = `${buttonRect.bottom + window.scrollY + 5}px`;
        selectorContent.style.left = `${buttonRect.left + window.scrollX}px`;
        document.body.appendChild(selectorContent);
        
        // Handle label selection
        selectorContent.addEventListener('click', async (e) => {
          const item = e.target.closest('.label-selector-item');
          if (item) {
            const labelId = item.dataset.labelId;
            const labelIndex = quoteLabels.indexOf(labelId);
            
            try {
              // Toggle label
              if (labelIndex === -1) {
                quoteLabels.push(labelId);
              } else {
                quoteLabels.splice(labelIndex, 1);
              }

              // Find quote index to maintain position
              const quoteIndex = currentQuotes.findIndex(q => q.id === quoteId);
              if (quoteIndex !== -1) {
                // Update quote in place
                currentQuotes[quoteIndex] = {
                  ...quote,
                  labels: quoteLabels
                };

                // Save to storage - reverse the order back to original before saving
                await chrome.storage.local.set({ 
                  quotes: [...currentQuotes].reverse() 
                });
                
                // Re-render quotes without reversing
                filterAndSearchQuotes();
              }

              selectorContent.remove();
            } catch (error) {
              console.error('Error updating quote labels:', error);
              showError('Error updating labels');
            }
          }
        });

        // Close dropdown when clicking outside
        const closeDropdown = (e) => {
          if (!selectorContent.contains(e.target) && !button.contains(e.target)) {
            selectorContent.remove();
            document.removeEventListener('click', closeDropdown);
          }
        };
        
        // Delay adding the click listener to prevent immediate closing
        setTimeout(() => {
          document.addEventListener('click', closeDropdown);
        }, 0);
      });
    });
  }

  // Add label selector events to quote items
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

    // Add click handlers for text expand/collapse
    const expandButtons = document.querySelectorAll(".expand-btn");
    expandButtons?.forEach(button => {
      // Check if text needs expand button
      const textElement = button.closest('.text-container').querySelector('.text-line-overflow');
      const contentWrapper = button.closest('.content-wrapper');
      
      // Check if text is shorter than the container
      if (textElement.scrollHeight <= textElement.clientHeight) {
        contentWrapper.classList.add('short-text');
        return;
      }

      button.addEventListener("click", handleExpandCollapse);
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
          contentWrapper.innerHTML = `
            <div class="text-container">
              <p class="text-line-overflow">${newText}</p>
              <button class="expand-btn">
                <span class="text">Show More</span>
                <span class="icon">▼</span>
              </button>
            </div>
          `;
          
          // Re-add event listener for expand button
          const expandButton = contentWrapper.querySelector('.expand-btn');
          const textElement = contentWrapper.querySelector('.text-line-overflow');
          
          if (textElement.scrollHeight <= textElement.clientHeight) {
            contentWrapper.classList.add('short-text');
          } else {
            expandButton.addEventListener("click", handleExpandCollapse);
          }
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

    // Handle text expand/collapse
    function handleExpandCollapse(e) {
      const button = e.currentTarget;
      const textElement = button.closest('.text-container').querySelector('.text-line-overflow');
      const isExpanded = textElement.classList.contains('expanded');
      
      // Toggle expanded state
      textElement.classList.toggle('expanded');
      button.classList.toggle('expanded');
      
      // Update button text
      const textSpan = button.querySelector('.text');
      textSpan.textContent = isExpanded ? 'Show More' : 'Show Less';
    }

    // Add click handlers for delete buttons
    const deleteButtons = document.querySelectorAll(".delete-quote");
    deleteButtons?.forEach((button) =>
      button.addEventListener("click", async (e) => {
        try {
          if (!confirm("Are you sure?")) return;

          const quoteId = e.target.closest('[data-id]').dataset.id;
          const quotes = await getFromStorage("quotes") || [];
          const updatedQuotes = quotes.filter(quote => quote.id != quoteId);
          console.log(quotes, updatedQuotes);
          
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

    addLabelSelectorEvents();
  }

  // Backup & Restore functionality
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

  // Add event listeners for search and filters
  searchInput.addEventListener('input', debounce(filterAndSearchQuotes, 300));
});
