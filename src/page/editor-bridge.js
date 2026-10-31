/**
 * Bridge to the Odoo.sh editor (JupyterLab). Runs in the page's main world.
 *
 * A content script lives in an isolated world: it sees the DOM but not the
 * page's objects, so it cannot reach the JupyterLab app or the xterm
 * instance. This file is injected as a <script> and talks to the content
 * script over postMessage only.
 */
(function () {
  "use strict";

  const CHANNEL_IN = "ost-editor-request";
  const CHANNEL_OUT = "ost-editor-response";

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /**
   * Waits for a condition to become true. Needed everywhere: creating a
   * terminal, mounting xterm and getting a prompt are all async steps, and
   * sending the command before they finish is why the first attempt used to
   * fail every time.
   */
  async function waitFor(fn, timeout, step) {
    const end = Date.now() + (timeout || 10000);
    while (Date.now() < end) {
      let value = null;
      try {
        value = fn();
      } catch (err) {
        value = null;
      }
      if (value) {
        return value;
      }
      await sleep(step || 120);
    }
    return null;
  }

  function jupyterApp() {
    // JupyterLab 4 exposes `jupyterapp`, the 3.x series exposed `jupyterlab`.
    return window.jupyterapp || window.jupyterlab || null;
  }

  /** Foreground terminal. Hidden ones have no layout. */
  function visibleTerminal() {
    for (const node of document.querySelectorAll(".jp-Terminal")) {
      if (node.offsetParent !== null) {
        return node;
      }
    }
    return null;
  }

  /**
   * Session of the foreground terminal. The main-area widget is often a
   * wrapper, so look inside `content` as well.
   */
  function currentTerminalSession() {
    const app = jupyterApp();
    const widget = app && app.shell && app.shell.currentWidget;
    if (!widget) {
      return null;
    }
    const session = widget.session || (widget.content && widget.content.session);
    return session && typeof session.send === "function" ? session : null;
  }

  // ------------------------------------------------------------------
  // Opening a terminal
  // ------------------------------------------------------------------

  /**
   * Try the JupyterLab command registry first, which is the clean way. If
   * the app is not exposed on window, fall back to the manual path: the "+"
   * button opens the Launcher, then click its "Terminal" card.
   */
  async function createTerminal() {
    const app = jupyterApp();
    if (app && app.commands && typeof app.commands.execute === "function") {
      try {
        await app.commands.execute("terminal:create-new");
        const node = await waitFor(visibleTerminal, 12000);
        if (node) {
          return node;
        }
      } catch (err) {
        // Command not available in this build, fall through to the DOM.
      }
    }

    // The toolbar has no <button> here but a <jp-button> custom element, so
    // querying "button" matched nothing and nothing happened until the "+"
    // was clicked by hand. Start from the command attribute, the most stable
    // hook, and fall back to the label.
    const launcher =
      document.querySelector('[data-command="launcher:create"]') ||
      document.querySelector('[aria-label^="New Launcher"]');
    if (launcher) {
      clickElement(launcher);
    }

    const card = await waitFor(
      () =>
        Array.from(document.querySelectorAll(".jp-LauncherCard")).find((c) => {
          const title = c.getAttribute("title") || "";
          return /terminal/i.test(title) || /terminal/i.test(c.textContent || "");
        }),
      6000
    );
    if (!card) {
      return null;
    }
    clickElement(card);
    return await waitFor(visibleTerminal, 12000);
  }

  // ------------------------------------------------------------------
  // Sending the command
  // ------------------------------------------------------------------

  /**
   * Full click on an element. A bare `HTMLElement.click()` is not enough for
   * JupyterLab components, which in several places react to pointer events
   * rather than the synthetic click alone.
   */
  function clickElement(target) {
    const box = target.getBoundingClientRect();
    const init = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      button: 0,
      clientX: box.left + box.width / 2,
      clientY: box.top + box.height / 2,
    };
    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
      const Ctor = type.startsWith("pointer") && window.PointerEvent ? PointerEvent : MouseEvent;
      target.dispatchEvent(new Ctor(type, init));
    }
    if (typeof target.click === "function") {
      target.click();
    }
  }

  /**
   * xterm ignores keyboard and paste until it has seen a real pointer event,
   * which is why the command only worked after clicking inside the terminal
   * by hand. The click is simulated here.
   */
  function focusTerminal(node) {
    const screen = node.querySelector(".xterm-screen") || node;
    const box = screen.getBoundingClientRect();
    const init = {
      bubbles: true,
      cancelable: true,
      view: window,
      button: 0,
      clientX: box.left + box.width / 2,
      clientY: box.top + box.height / 2,
    };
    screen.dispatchEvent(new MouseEvent("mousedown", init));
    screen.dispatchEvent(new MouseEvent("mouseup", init));
    screen.dispatchEvent(new MouseEvent("click", init));

    const textarea = node.querySelector("textarea.xterm-helper-textarea");
    if (textarea) {
      textarea.focus();
    }
    return textarea;
  }

  /**
   * xterm reads `keyCode`, which Chrome does not accept in the KeyboardEvent
   * initialiser, so it has to be redefined on the built event.
   */
  function keyEvent(type, init) {
    const event = new KeyboardEvent(type, Object.assign({ bubbles: true, cancelable: true }, init));
    for (const prop of ["keyCode", "which"]) {
      if (init[prop] !== undefined) {
        Object.defineProperty(event, prop, { get: () => init[prop] });
      }
    }
    return event;
  }

  function sendViaPaste(node, command) {
    const textarea = focusTerminal(node);
    if (!textarea) {
      return false;
    }
    const transfer = new DataTransfer();
    transfer.setData("text/plain", command);
    textarea.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: transfer,
        bubbles: true,
        cancelable: true,
      })
    );
    textarea.dispatchEvent(keyEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13 }));
    return true;
  }

  /**
   * This file runs in the main world, so any page script can post a message
   * on the channel and, unfiltered, type arbitrary commands into the user's
   * terminal. Only the shapes the extension itself generates are
   * accepted. Single-quoted arguments allow only the '\'' escape and no
   * control characters.
   */
  const QUOTED = "'(?:[^'\\x00-\\x1f]|'\\\\'')*'";
  const ALLOWED_COMMANDS = [
    /^odoo-bin shell$/,
    /^psql$/,
    new RegExp("^unzip " + QUOTED + "$"),
    new RegExp("^zip -r " + QUOTED + " " + QUOTED + "$"),
    /^odoo-bin -[ui] [\w.-]+ --st$/,
  ];

  function isAllowedCommand(command) {
    return ALLOWED_COMMANDS.some((re) => re.test(command));
  }

  async function run(command, options) {
    if (typeof command !== "string" || !command.trim()) {
      return { ok: false, error: "empty command" };
    }
    if (!isAllowedCommand(command)) {
      return { ok: false, error: "command not allowed" };
    }
    const opts = options || {};
    let node = visibleTerminal();
    let created = false;

    if (!node || opts.newTerminal) {
      node = (await createTerminal()) || visibleTerminal();
      created = true;
    }
    if (!node) {
      return { ok: false, error: "couldn't open a terminal" };
    }

    // Wait for xterm to mount its input, then give the shell time to print
    // its prompt: a command sent before the prompt is simply lost.
    await waitFor(() => node.querySelector("textarea.xterm-helper-textarea"), 8000);
    await sleep(created ? 1400 : 350);

    // Focus in every case: even when sending through the session, the
    // terminal must stay the active one so its output is visible.
    focusTerminal(node);
    await sleep(120);

    const session = currentTerminalSession();
    if (session) {
      session.send({ type: "stdin", content: [command + "\r"] });
      return { ok: true, how: "session" };
    }
    if (sendViaPaste(node, command)) {
      return { ok: true, how: "paste" };
    }
    return { ok: false, error: "no terminal input" };
  }

  // ------------------------------------------------------------------
  // Channel with the content script
  // ------------------------------------------------------------------

  function onRequest(event) {
    // Accept only messages that originate from this very window.
    if (event.source !== window) {
      return;
    }
    const data = event.data;
    if (!data || data.channel !== CHANNEL_IN) {
      return;
    }
    run(data.command, { newTerminal: !!data.newTerminal })
      .catch((err) => ({ ok: false, error: String((err && err.message) || err) }))
      .then((result) => {
        window.postMessage(Object.assign({ channel: CHANNEL_OUT, id: data.id }, result), window.location.origin);
      });
  }

  // One listener per page. Without this guard a second evaluation of the file
  // would make every instance answer the same request and the command would
  // land in the terminal several times.
  if (!window.__ostEditorBridge) {
    window.__ostEditorBridge = true;
    window.addEventListener("message", onRequest);
  }

  // Always confirm, even when the listener was already there: it is the
  // signal the content script waits for before sending commands.
  window.postMessage({ channel: CHANNEL_OUT, id: "ready", ok: true }, window.location.origin);
})();
