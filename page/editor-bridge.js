/**
 * Ponte verso l'editor di Odoo.sh (JupyterLab), eseguito nel main world.
 *
 * Un content script vive in un mondo isolato: vede il DOM ma non gli oggetti
 * della pagina, quindi non puo' raggiungere ne' l'applicazione JupyterLab ne'
 * l'istanza xterm. Questo file viene iniettato come <script> nella pagina e
 * dialoga con il content script solo via postMessage.
 */
(function () {
  "use strict";

  const CHANNEL_IN = "ost-editor-request";
  const CHANNEL_OUT = "ost-editor-response";

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /**
   * Attende che una condizione diventi vera. Serve ovunque: creare un
   * terminale, montare xterm e far comparire il prompt sono tutti passaggi
   * asincroni, e inviare il comando prima che siano finiti e' esattamente il
   * motivo per cui il primo tentativo falliva sempre.
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
    // JupyterLab 4 espone `jupyterapp`, la serie 3 esponeva `jupyterlab`.
    return window.jupyterapp || window.jupyterlab || null;
  }

  /** Terminale in primo piano: quelli nascosti non hanno layout. */
  function visibleTerminal() {
    for (const node of document.querySelectorAll(".jp-Terminal")) {
      if (node.offsetParent !== null) {
        return node;
      }
    }
    return null;
  }

  /**
   * Sessione del terminale in primo piano. Il widget dell'area principale e'
   * spesso un contenitore, percio' si guarda anche dentro a `content`.
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
  // Creazione di un terminale
  // ------------------------------------------------------------------

  /**
   * Prima si prova il registro dei comandi di JupyterLab, che e' la via
   * pulita. Se l'applicazione non e' esposta sulla finestra si ripiega sul
   * percorso descritto dall'utente: il pulsante "+" apre il Launcher, e da li'
   * si clicca la scheda "Terminal".
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
        // Comando non disponibile in questa build: si passa al DOM.
      }
    }

    // Attenzione al selettore: nella barra degli strumenti non c'e' un
    // <button> ma un elemento personalizzato <jp-button>. Cercare "button"
    // non trovava nulla, ed e' il motivo per cui non accadeva niente finche'
    // non si cliccava il "+" a mano. Si parte dal comando, che e' il dato
    // piu' stabile, e si ripiega sull'etichetta.
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
  // Invio del comando
  // ------------------------------------------------------------------

  /**
   * xterm ignora tastiera e incollaggio finche' non ha ricevuto un vero
   * evento di puntatore: e' il motivo per cui il comando funzionava solo dopo
   * aver cliccato a mano dentro al terminale. Qui quel click viene simulato.
   */
  /**
   * Click completo su un elemento. `HTMLElement.click()` da solo non basta
   * con i componenti di JupyterLab, che in piu' punti reagiscono agli eventi
   * di puntatore invece che al solo evento di click sintetico.
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
   * xterm legge `keyCode`, che Chrome non accetta dall'inizializzatore di
   * KeyboardEvent: va ridefinito sull'evento gia' costruito.
   */
  function keyEvent(type, init) {
    const event = new KeyboardEvent(
      type,
      Object.assign({ bubbles: true, cancelable: true }, init)
    );
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
    textarea.dispatchEvent(
      keyEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13 })
    );
    return true;
  }

  async function run(command, options) {
    if (typeof command !== "string" || !command.trim()) {
      return { ok: false, error: "empty command" };
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

    // Si aspetta che xterm abbia montato il proprio campo di input, poi si
    // lascia alla shell il tempo di stampare il prompt: un comando inviato
    // prima del prompt viene semplicemente perso.
    await waitFor(() => node.querySelector("textarea.xterm-helper-textarea"), 8000);
    await sleep(created ? 1400 : 350);

    // Il fuoco va dato in ogni caso: anche quando si usa la sessione, il
    // terminale deve restare quello attivo per mostrare l'output.
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
  // Canale con il content script
  // ------------------------------------------------------------------

  function onRequest(event) {
    // Si accettano solo messaggi originati da questa stessa finestra.
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
        window.postMessage(
          Object.assign({ channel: CHANNEL_OUT, id: data.id }, result),
          window.location.origin
        );
      });
  }

  /*
   * Un solo ascoltatore per pagina. Senza questa guardia, una seconda
   * valutazione del file farebbe rispondere ogni istanza alla stessa
   * richiesta e il comando finirebbe nel terminale ripetuto piu' volte.
   */
  if (!window.__ostEditorBridge) {
    window.__ostEditorBridge = true;
    window.addEventListener("message", onRequest);
  }

  // La conferma va inviata comunque, anche quando l'ascoltatore c'era gia':
  // e' il segnale che il content script attende prima di spedire comandi.
  window.postMessage({ channel: CHANNEL_OUT, id: "ready", ok: true }, window.location.origin);
})();
