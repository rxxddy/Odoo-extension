/**
 * Popup shell: header with the power switch, the tab bar and the active panel.
 */
(function (ns) {
  "use strict";

  const { store, actions } = ns;
  const { t, h, svg } = ns.ui;

  const TABS = [
    { id: "wallpaper", icon: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 15l5-5 4 4 3-3 6 6"/><circle cx="15.5" cy="8.5" r="1.5"/>' },
    { id: "icons", icon: '<rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><path d="M17 13.5l3.5 3.5-3.5 3.5-3.5-3.5z"/>' },
    { id: "logos", icon: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>' },
    { id: "workspace", icon: '<path d="M4 5h16v10H4zM9 19h6M12 15v4"/>' },
    { id: "developer", icon: '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>', dev: true },
    { id: "settings", icon: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/>' },
  ];


  const root = document.getElementById("app");
  let activeTab = "wallpaper";
  let renderedTab = null;

  function visibleTabs() {
    return TABS.filter((tab) => !tab.dev || store.settings.developerSection);
  }

  function dbLine() {
    const { tab } = store;
    const name = tab.database || (store.profileHost !== globalThis.OST_DEFAULT_HOST ? store.profileHost : "");
    if (!name) {
      return h("div", { class: "title-db" }, h("span", { class: "db-name" }, t("hd.noOdoo")));
    }
    const env = tab.environment;
    return h(
      "div",
      { class: "title-db", title: name },
      env ? h("span", { class: "env env-" + env.toLowerCase() }, env) : null,
      h("span", { class: "db-name" }, name)
    );
  }

  function header() {
    const on = store.settings.enabled;
    return h(
      "header",
      { class: "hd" },
      h("img", { class: "mark", src: "../../assets/icons/icon48.png", alt: "" }),
      h("div", { class: "title" }, h("div", { class: "title-name" }, "UI Enhancer"), dbLine()),
      h(
        "label",
        { class: "power" },
        h("span", null, on ? t("hd.on") : t("hd.off")),
        ns.ui.toggle(on, (v) => actions.setSettings({ enabled: v }), t("hd.enabled"))
      )
    );
  }

  function tabBar() {
    const tabs = visibleTabs();
    const index = Math.max(0, tabs.findIndex((tab) => tab.id === activeTab));
    const nav = h(
      "nav",
      { class: "tabs", role: "tablist" },
      tabs.map((tab) =>
        h(
          "button",
          {
            type: "button",
            role: "tab",
            class: "tab" + (tab.id === activeTab ? " on" : ""),
            title: t("tab." + tab.id),
            "aria-label": t("tab." + tab.id),
            "aria-selected": String(tab.id === activeTab),
            onclick: () => selectTab(tab.id),
          },
          svg(tab.icon, 16),
          h("span", { class: "tab-label" }, t("tab." + tab.id))
        )
      ),
      h("span", { class: "tabs-ink", "aria-hidden": "true" })
    );
    nav.style.setProperty("--n", tabs.length);
    nav.style.setProperty("--i", index);
    return nav;
  }

  function selectTab(id) {
    activeTab = id;
    actions.setSettings({ lastTab: id });
  }

  function render() {
    // The developer tab disappears when its switch is turned off.
    if (!visibleTabs().some((tab) => tab.id === activeTab)) {
      activeTab = "settings";
    }
    const previousView = root.querySelector(".view");
    const scrollTop = previousView && renderedTab === activeTab ? previousView.scrollTop : 0;

    // Keep the tab bar node between renders so its ink can slide.
    const oldBar = root.querySelector(".tabs");
    const bar = tabBar();

    ns.ui.resetSections();
    const panel = ns.panels[activeTab]();
    if (renderedTab !== activeTab) {
      panel.classList.add("enter");
    }
    const paused = store.settings.enabled ? null : h("div", { class: "paused" }, t("hd.paused"));
    const view = h("main", { class: "view" }, paused ? h("div", { class: "panel" }, paused, panel) : panel);

    root.textContent = "";
    root.append(header(), oldBar || bar, view);
    if (oldBar) {
      // Children are rebuilt (labels, highlight), the container stays.
      oldBar.replaceChildren(...bar.childNodes);
      oldBar.style.setProperty("--n", bar.style.getPropertyValue("--n"));
      requestAnimationFrame(() => oldBar.style.setProperty("--i", bar.style.getPropertyValue("--i")));
    }
    view.scrollTop = scrollTop;
    renderedTab = activeTab;
  }

  async function start() {
    await actions.load();
    activeTab = store.settings.lastTab;
    document.documentElement.lang = store.settings.language;
    actions.subscribe(render);
    render();
    ns.media.restoreFolder();
  }

  start();
})(globalThis.OstPopup);
