chrome.storage.local.clear(function () {
    console.log("All data cleared from chrome.storage.local.");
  });
  
  // Create context menu
  chrome.runtime.onInstalled.addListener(function () {
    chrome.contextMenus.create({
      id: "saveQuoteContextMenu",
      title: "Save Quote",
      contexts: ["selection"],
    });
  });
  
  // Event listener for context menu item click
  chrome.contextMenus.onClicked.addListener(function (info, tab) {
    if (info.menuItemId === "saveQuoteContextMenu") {
      // Check if there's selected text
      if (info.selectionText) {
        const site =
          new URL(tab.url).hostname.split(".").length > 2
            ? new URL(tab.url).hostname.split(".").slice(-2).join(".")
            : new URL(tab.url).hostname;
  
        const quote = {
          id:new Date().getTime(),
          text: info.selectionText,
          url: info.frameUrl,
          createdAt: new Date().toLocaleDateString("en-US", {
            year: "numeric",
            day: "numeric",
            month: "long",
          }),
          icon: null,
          site,
          siteName: site.replace("www.", ""),
        };
        console.log(quote);
  
        saveQuote(quote);
      }
    }
  });
  
  // Event listener for messages from content script
  chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === "saveText") {
      // Call the function to save the quote
      saveQuote(request.quote);
      sendResponse({ success: true }); // Send a success response back
    }
  });
  
  // Function to save the quote
  function saveQuote(quote) {
    // Retrieve existing quotes from chrome.storage or initialize an empty array
    chrome.storage.local.get(["quotes"], function (result) {
      let savedQuotes = result.quotes || []; // If no quotes exist, initialize an empty array
  
      // Add the new quote to the array
      savedQuotes.push(quote);
  
      // Save the updated array back to chrome.storage
      chrome.storage.local.set({ quotes: savedQuotes }, function () {
        notifyUser("Your quote has been saved");
      });
    });
  }
  
  // Notify user quote saved
  function notifyUser(message) {
    chrome.notifications.create(
      {
        type: "basic",
        iconUrl: "icon-128px.png",
        title: "Quote Saved",
        message: message,
        priority: 1,
      },
      function (notificationId) {
        if (chrome.runtime.lastError) {
          console.error(
            "Error creating notification:",
            chrome.runtime.lastError.message
          );
        }
      }
    );
  }
  
  // For logging from other scripts
  chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === "log") {
      console.log(request.data);
    }
  });
  