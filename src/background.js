console.log("FlexHeader: background.js");

async function getSettings() {
  let headers = [];

  chrome.storage.sync.get("settings", async (result) => {
    if (result.settings) {
      result.settings.forEach((setting, i) => {
        if (setting.headerEnabled) {
          headers.push({
            id: i + 1,
            priority: 1,
            action: {
              type: "modifyHeaders",
              requestHeaders: [
                {
                  header: setting.headerName,
                  operation: "set",
                  value: setting.headerValue,
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

    return headers;
  });

  return headers;
}

console.log(await getSettings());

let headers = [];
chrome.storage.sync.get("settings", async (result) => {
  if (result.settings) {
    result.settings.forEach((setting, i) => {
      if (setting.headerEnabled) {
        headers.push({
          id: i + 1,
          priority: 1,
          action: {
            type: "modifyHeaders",
            requestHeaders: [
              {
                header: setting.headerName,
                operation: "set",
                value: setting.headerValue,
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

  console.log("FlexHeader: headers", headers);

  const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
  const oldRuleIds = oldRules.map((rule) => rule.id);

  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: oldRuleIds,
    addRules: headers,
  });
});
