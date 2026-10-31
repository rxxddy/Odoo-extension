/**
 * Messages from the popup.
 */
(function (ns) {
  "use strict";

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message) {
      return false;
    }

    switch (message.type) {
      case "ost:editor-status":
        sendResponse({
          found: ns.editor.editorPresent(),
          terminalActive: !!ns.editor.visibleTerminal(),
          tabLabel: ns.editor.activeTabLabel(),
        });
        return false;

      case "ost:editor-run":
        if (!ns.state.settings.enabled) {
          sendResponse({ ok: false, error: "extension is off" });
          return false;
        }
        ns.editor.runInTerminal(message.command, message.newTerminal).then(sendResponse);
        // Keep the channel open for the async reply.
        return true;

      case "ost:database":
        sendResponse({
          database: ns.environment.readDatabaseName(),
          host: ns.HOST,
          // The environment verdict is computed here, where the banners are
          // visible, so the popup can show it without recomputing it.
          environment: ns.state.env || globalThis.ostHostEnvironment(ns.HOST),
        });
        return false;

      default:
        return false;
    }
  });
})(globalThis.OstContent);
