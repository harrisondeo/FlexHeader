console.log("FlexHeader: background.js");

function getAndApplyHeaderRules() {
  chrome.storage.sync.get("settings", async (result) => {
    let headers = [];

    if (result.settings) {
      // each page
      result.settings.forEach((page, i) => {
        if (page.enabled) {
          // each setting
          page.headers.forEach((header, i) => {
            if (header.headerEnabled) {
              headers.push({
                id: i + 1,
                priority: 1,
                action: {
                  type: "modifyHeaders",
                  requestHeaders: [
                    {
                      header: header.headerName,
                      operation: "set",
                      value: header.headerValue,
                    },
                  ],
                },
                condition: {
                  urlFilter: "|https*",
                  resourceTypes: [
                    "main_frame",
                    "sub_frame",
                    "stylesheet",
                    "script",
                    "image",
                    "font",
                    "object",
                    "xmlhttprequest",
                    "ping",
                    "csp_report",
                    "media",
                    "websocket",
                    "other",
                  ],
                },
              });
            }
          });
        }
      });
    }

    console.log("FlexHeader: headers", headers);

    const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
    console.log("FlexHeader: oldRules", oldRules);
    const oldRuleIds = oldRules ? oldRules.map((rule) => rule.id) : [];

    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: oldRuleIds,
      addRules: headers,
    });
  });
}

chrome.storage.onChanged.addListener(function (changes, namespace) {
  if ("settings" in changes) {
    getAndApplyHeaderRules();
  }
});

getAndApplyHeaderRules();
