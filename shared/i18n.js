/**
 * Multilingua del popup.
 *
 * `OST_LANGUAGES` e' l'elenco mostrato nel selettore. La bandiera e' un piccolo
 * SVG inline, non un'emoji: su Windows i caratteri emoji "bandiera" (coppie di
 * regional indicator) spesso non hanno un glifo a colori nel font di sistema,
 * e Chrome ripiega silenziosamente sul codice ISO scritto in lettere (e' cio'
 * che si vedeva nello screenshot — "GB", "IT", "DE" invece delle bandiere).
 * Un SVG disegnato a mano non dipende dal font del sistema operativo: appare
 * identico ovunque.
 *
 * `OST_I18N` e' il dizionario vero e proprio: inglese, italiano, tedesco e
 * francese sono popolati, le lingue restanti sono ancora oggetti vuoti pronti
 * da riempire in seguito. Grazie al fallback in `t()` (in popup.js), una
 * lingua ancora vuota mostra il testo inglese invece di lasciare l'interfaccia
 * con chiavi grezze o buchi.
 */
(function () {
  "use strict";

  const flagGB =
    '<svg viewBox="0 0 20 14" aria-hidden="true">' +
    '<rect width="20" height="14" fill="#00247d"/>' +
    '<path d="M0 0 L20 14 M20 0 L0 14" stroke="#fff" stroke-width="3"/>' +
    '<path d="M0 0 L20 14 M20 0 L0 14" stroke="#cf142b" stroke-width="1.2"/>' +
    '<path d="M10 0 V14 M0 7 H20" stroke="#fff" stroke-width="4.6"/>' +
    '<path d="M10 0 V14 M0 7 H20" stroke="#cf142b" stroke-width="2.4"/>' +
    "</svg>";

  const flagIT =
    '<svg viewBox="0 0 20 14" aria-hidden="true">' +
    '<rect width="20" height="14" fill="#fff"/>' +
    '<rect width="6.67" height="14" fill="#009246"/>' +
    '<rect x="13.33" width="6.67" height="14" fill="#ce2b37"/>' +
    "</svg>";

  const flagDE =
    '<svg viewBox="0 0 20 14" aria-hidden="true">' +
    '<rect width="20" height="4.67" fill="#000"/>' +
    '<rect y="4.67" width="20" height="4.67" fill="#dd0000"/>' +
    '<rect y="9.33" width="20" height="4.67" fill="#ffce00"/>' +
    "</svg>";

  const flagFR =
    '<svg viewBox="0 0 20 14" aria-hidden="true">' +
    '<rect width="20" height="14" fill="#fff"/>' +
    '<rect width="6.67" height="14" fill="#0055a4"/>' +
    '<rect x="13.33" width="6.67" height="14" fill="#ef4135"/>' +
    "</svg>";

  const flagES =
    '<svg viewBox="0 0 20 14" aria-hidden="true">' +
    '<rect width="20" height="14" fill="#aa151b"/>' +
    '<rect y="3.5" width="20" height="7" fill="#f1bf00"/>' +
    "</svg>";

  const flagNL =
    '<svg viewBox="0 0 20 14" aria-hidden="true">' +
    '<rect width="20" height="4.67" fill="#ae1c28"/>' +
    '<rect y="4.67" width="20" height="4.67" fill="#fff"/>' +
    '<rect y="9.33" width="20" height="4.67" fill="#21468b"/>' +
    "</svg>";

  const flagPT =
    '<svg viewBox="0 0 20 14" aria-hidden="true">' +
    '<rect width="20" height="14" fill="#ff0000"/>' +
    '<rect width="8" height="14" fill="#046a38"/>' +
    "</svg>";

  globalThis.OST_LANGUAGES = [
    { code: "en", label: "English", flag: flagGB },
    { code: "it", label: "Italiano", flag: flagIT },
    { code: "de", label: "Deutsch", flag: flagDE },
    { code: "fr", label: "Français", flag: flagFR },
    { code: "es", label: "Español", flag: flagES },
    { code: "nl", label: "Nederlands", flag: flagNL },
    { code: "pt", label: "Português", flag: flagPT },
  ];

  globalThis.OST_I18N = {
    en: {
      "meta.title": "UI Enhancer for Odoo",

      "header.account.alt": "Account",
      "header.db.none": "no Odoo page",
      "header.db.copy": "Copy database name",
      "header.enabled.title": "Turn everything on or off",
      "header.enabled.aria": "Enable the extension",

      "pro.chip.title": "View your PRO status",
      "pro.label": "PRO",

      "tabs.appearance": "Appearance",
      "tabs.developer": "Developer",
      "tabs.language.title": "Language",

      "pro.modal.title": "Welcome aboard, beta tester!",
      "pro.modal.body":
        "Thank you for helping us test the extension. As a thank-you, we're gifting you a <strong>PRO subscription</strong> for as long as the beta lasts — completely free.",
      "pro.modal.note": "A PRO feature switches on with this colour instead of the usual one — that's how you'll spot it.",
      "pro.modal.fine": "*We'll give you at least 30 days' notice before the beta, and this subscription, ever ends.",
      "pro.modal.button": "I understood",

      "recognize.hint": "This page wasn't detected as Odoo. Is it one?",
      "recognize.button": "Enable here",

      "icons.title": "App icons",
      "icons.preview.caption": "Sales",
      "icons.field.background": "Background",
      "icons.field.border": "Border",
      "icons.field.effect": "Effect",
      "icons.size.label": "Artwork size",
      "icons.size.large": "Large",
      "icons.size.medium": "Medium",
      "icons.size.small": "Small",
      "icons.corners.label": "Corners",
      "icons.corners.aria": "Enable rounded corners",
      "icons.labeltheme.label": "Label theme",
      "icons.labeltheme.auto": "Auto — leave Odoo's own colours",
      "icons.labeltheme.light": "Light text — for dark wallpapers",
      "icons.labeltheme.dark": "Dark text — for light wallpapers",
      "icons.hideNames.label": "Hide app names",
      "icons.hideNames.hint": "Drops the labels and enlarges the icons.",

      "wallpaper.title": "Wallpaper",
      "wallpaper.url.placeholder": "Paste an image link…",
      "wallpaper.url.add": "Add",
      "wallpaper.upload.button": "Upload photo or video",
      "wallpaper.folder.link": "Link a folder",
      "wallpaper.folder.sync.title": "Check the folder for new files",
      "wallpaper.folder.sync.aria": "Sync folder",
      "wallpaper.folder.unlink": "Unlink folder",
      "wallpaper.tint.enable.title": "Use a solid colour or gradient as the wallpaper",
      "wallpaper.tint.title": "Solid or gradient",
      "wallpaper.tint.solid": "Solid",
      "wallpaper.tint.gradient": "Gradient",
      "wallpaper.tint.collapse": "Collapse",
      "wallpaper.tint.colour1": "Colour 1",
      "wallpaper.tint.colour2": "Colour 2",
      "wallpaper.tint.angle": "Angle",
      "wallpaper.logo.title": "Logo",
      "wallpaper.logo.upload": "Upload logo",
      "wallpaper.logo.remove": "Remove",
      "wallpaper.logo.size": "Size",
      "wallpaper.logo.horizontal": "Horizontal",
      "wallpaper.logo.vertical": "Vertical",
      "wallpaper.darken": "Darken",
      "wallpaper.blur": "Blur",

      "scope.domain": "Appearance saved for {host}",
      "scope.default": "Appearance applies to every new project",

      "dev.noise.title": "On-page noise",
      "dev.noise.trial.label": "Hide the trial banner",
      "dev.noise.trial.hint": "Removes the \"database will be deleted\" notice and its overlay.",
      "dev.noise.neutralize.label": "Hide the neutralized-database banner",
      "dev.noise.neutralize.hint": "The red strip warning that this database sends no real e-mail.",

      "dev.tools.title": "Tools",
      "dev.tools.debug.label": "Open in developer mode",
      "dev.tools.debug.hint": "Reloads once with <code>?debug=1</code> when it isn't already on.",
      "dev.tools.copyfields.label": "Copy field names on click",
      "dev.tools.copyfields.hint": "Click a field label to copy its technical name. Needs developer mode.",
      "dev.tools.shellui.label": "Shell interface tweaks",
      "dev.tools.shellui.hint":
        "On Odoo.sh's editor: adds an <code>odoo-bin shell</code> item to the menu bar, and quick \"Zip folder\" / \"Update module\" commands in the file browser.",

      "dev.badge.title": "Environment badge",
      "dev.badge.corner.tl": "Top left",
      "dev.badge.corner.tr": "Top right",
      "dev.badge.corner.bl": "Bottom left",
      "dev.badge.corner.br": "Bottom right",
      "dev.badge.textsize": "Text size",
      "dev.badge.colorauto.title": "Colour by environment",
      "dev.badge.colorcustom.title": "Custom colour",
      "dev.badge.neverhost.label": "Never show it on this domain",
      "dev.badge.neverhost.hintOdoo": "Never show it on {host}",
      "dev.badge.neverhost.hintOther": "Available on Odoo project domains only.",

      "library.title": "Wallpapers",
      "library.back": "Back",
      "library.empty": "Images you pick are kept here. Add one from the wallpaper section.",
      "library.count": "{n} saved",

      "footer.discord": "Need help? Join our Discord",
      "footer.reset": "Reset all",
      "footer.saved": "Saved",
    },

    it: {
      "header.account.alt": "Account",
      "header.db.none": "nessuna pagina Odoo",
      "header.db.copy": "Copia il nome del database",
      "header.enabled.title": "Attiva o disattiva tutto",
      "header.enabled.aria": "Attiva l'estensione",

      "pro.chip.title": "Visualizza il tuo stato PRO",
      "pro.label": "PRO",

      "tabs.appearance": "Aspetto",
      "tabs.developer": "Sviluppatore",
      "tabs.language.title": "Lingua",

      "pro.modal.title": "Benvenuto a bordo, beta tester!",
      "pro.modal.body":
        "Grazie per averci aiutato a testare l'estensione. Come ringraziamento, ti regaliamo un <strong>abbonamento PRO</strong> per tutta la durata della beta, completamente gratis.",
      "pro.modal.note": "Una funzione PRO si attiva con questo colore invece del solito: è così che la riconoscerai.",
      "pro.modal.fine": "*Ti avviseremo con almeno 30 giorni di anticipo prima che la beta, e questo abbonamento, terminino.",
      "pro.modal.button": "Ho capito",

      "recognize.hint": "Questa pagina non è stata riconosciuta come Odoo. Lo è?",
      "recognize.button": "Attiva qui",

      "icons.title": "Icone delle app",
      "icons.preview.caption": "Vendite",
      "icons.field.background": "Sfondo",
      "icons.field.border": "Bordo",
      "icons.field.effect": "Effetto",
      "icons.size.label": "Dimensione dell'immagine",
      "icons.size.large": "Grande",
      "icons.size.medium": "Media",
      "icons.size.small": "Piccola",
      "icons.corners.label": "Angoli",
      "icons.corners.aria": "Attiva gli angoli arrotondati",
      "icons.labeltheme.label": "Tema delle etichette",
      "icons.labeltheme.auto": "Auto — lascia i colori originali di Odoo",
      "icons.labeltheme.light": "Testo chiaro — per sfondi scuri",
      "icons.labeltheme.dark": "Testo scuro — per sfondi chiari",
      "icons.hideNames.label": "Nascondi i nomi delle app",
      "icons.hideNames.hint": "Rimuove le etichette e ingrandisce le icone.",

      "wallpaper.title": "Sfondo",
      "wallpaper.url.placeholder": "Incolla il link di un'immagine…",
      "wallpaper.url.add": "Aggiungi",
      "wallpaper.upload.button": "Carica foto o video",
      "wallpaper.folder.link": "Collega una cartella",
      "wallpaper.folder.sync.title": "Controlla la cartella per nuovi file",
      "wallpaper.folder.sync.aria": "Sincronizza la cartella",
      "wallpaper.folder.unlink": "Scollega la cartella",
      "wallpaper.tint.enable.title": "Usa un colore pieno o una sfumatura come sfondo",
      "wallpaper.tint.title": "Colore pieno o sfumatura",
      "wallpaper.tint.solid": "Pieno",
      "wallpaper.tint.gradient": "Sfumatura",
      "wallpaper.tint.collapse": "Comprimi",
      "wallpaper.tint.colour1": "Colore 1",
      "wallpaper.tint.colour2": "Colore 2",
      "wallpaper.tint.angle": "Angolo",
      "wallpaper.logo.title": "Logo",
      "wallpaper.logo.upload": "Carica il logo",
      "wallpaper.logo.remove": "Rimuovi",
      "wallpaper.logo.size": "Dimensione",
      "wallpaper.logo.horizontal": "Orizzontale",
      "wallpaper.logo.vertical": "Verticale",
      "wallpaper.darken": "Scurisci",
      "wallpaper.blur": "Sfoca",

      "scope.domain": "Aspetto salvato per {host}",
      "scope.default": "L'aspetto si applica a ogni nuovo progetto",

      "dev.noise.title": "Elementi di disturbo sulla pagina",
      "dev.noise.trial.label": "Nascondi il banner di prova",
      "dev.noise.trial.hint": "Rimuove l'avviso \"il database verrà eliminato\" e il suo overlay.",
      "dev.noise.neutralize.label": "Nascondi il banner di database neutralizzato",
      "dev.noise.neutralize.hint": "La striscia rossa che avvisa che questo database non invia e-mail reali.",

      "dev.tools.title": "Strumenti",
      "dev.tools.debug.label": "Apri in modalità sviluppatore",
      "dev.tools.debug.hint": "Ricarica una volta con <code>?debug=1</code> se non è già attivo.",
      "dev.tools.copyfields.label": "Copia i nomi dei campi al clic",
      "dev.tools.copyfields.hint": "Clicca l'etichetta di un campo per copiarne il nome tecnico. Richiede la modalità sviluppatore.",
      "dev.tools.shellui.label": "Personalizzazioni dell'interfaccia della shell",
      "dev.tools.shellui.hint":
        "Nell'editor di Odoo.sh: aggiunge una voce <code>odoo-bin shell</code> alla barra dei menu e i comandi rapidi \"Comprimi cartella\" / \"Aggiorna modulo\" nel file browser.",

      "dev.badge.title": "Badge dell'ambiente",
      "dev.badge.corner.tl": "In alto a sinistra",
      "dev.badge.corner.tr": "In alto a destra",
      "dev.badge.corner.bl": "In basso a sinistra",
      "dev.badge.corner.br": "In basso a destra",
      "dev.badge.textsize": "Dimensione del testo",
      "dev.badge.colorauto.title": "Colore in base all'ambiente",
      "dev.badge.colorcustom.title": "Colore personalizzato",
      "dev.badge.neverhost.label": "Non mostrarlo mai su questo dominio",
      "dev.badge.neverhost.hintOdoo": "Non mostrarlo mai su {host}",
      "dev.badge.neverhost.hintOther": "Disponibile solo sui domini dei progetti Odoo.",

      "library.title": "Sfondi",
      "library.back": "Indietro",
      "library.empty": "Le immagini che scegli restano qui. Aggiungine una dalla sezione sfondo.",
      "library.count": "{n} salvati",

      "footer.discord": "Serve aiuto? Unisciti al nostro Discord",
      "footer.reset": "Reimposta tutto",
      "footer.saved": "Salvato",
    },

    de: {
      "header.account.alt": "Konto",
      "header.db.none": "keine Odoo-Seite",
      "header.db.copy": "Datenbanknamen kopieren",
      "header.enabled.title": "Alles ein- oder ausschalten",
      "header.enabled.aria": "Erweiterung aktivieren",

      "pro.chip.title": "Deinen PRO-Status ansehen",
      "pro.label": "PRO",

      "tabs.appearance": "Erscheinungsbild",
      "tabs.developer": "Entwickler",
      "tabs.language.title": "Sprache",

      "pro.modal.title": "Willkommen an Bord, Beta-Tester!",
      "pro.modal.body":
        "Danke, dass du uns beim Testen der Erweiterung hilfst. Als Dankeschön schenken wir dir ein <strong>PRO-Abonnement</strong> für die gesamte Dauer der Beta-Phase — völlig kostenlos.",
      "pro.modal.note": "Eine PRO-Funktion schaltet sich mit dieser Farbe statt der üblichen ein — so erkennst du sie.",
      "pro.modal.fine": "*Wir informieren dich mindestens 30 Tage im Voraus, bevor die Beta-Phase und damit dieses Abonnement enden.",
      "pro.modal.button": "Verstanden",

      "recognize.hint": "Diese Seite wurde nicht als Odoo erkannt. Ist sie es?",
      "recognize.button": "Hier aktivieren",

      "icons.title": "App-Symbole",
      "icons.preview.caption": "Verkauf",
      "icons.field.background": "Hintergrund",
      "icons.field.border": "Rahmen",
      "icons.field.effect": "Effekt",
      "icons.size.label": "Bildgröße",
      "icons.size.large": "Groß",
      "icons.size.medium": "Mittel",
      "icons.size.small": "Klein",
      "icons.corners.label": "Ecken",
      "icons.corners.aria": "Abgerundete Ecken aktivieren",
      "icons.labeltheme.label": "Beschriftungsdesign",
      "icons.labeltheme.auto": "Auto — Odoos eigene Farben beibehalten",
      "icons.labeltheme.light": "Heller Text — für dunkle Hintergründe",
      "icons.labeltheme.dark": "Dunkler Text — für helle Hintergründe",
      "icons.hideNames.label": "App-Namen ausblenden",
      "icons.hideNames.hint": "Entfernt die Beschriftungen und vergrößert die Symbole.",

      "wallpaper.title": "Hintergrundbild",
      "wallpaper.url.placeholder": "Bildlink einfügen…",
      "wallpaper.url.add": "Hinzufügen",
      "wallpaper.upload.button": "Foto oder Video hochladen",
      "wallpaper.folder.link": "Ordner verknüpfen",
      "wallpaper.folder.sync.title": "Ordner auf neue Dateien prüfen",
      "wallpaper.folder.sync.aria": "Ordner synchronisieren",
      "wallpaper.folder.unlink": "Ordner trennen",
      "wallpaper.tint.enable.title": "Eine Farbe oder einen Verlauf als Hintergrund verwenden",
      "wallpaper.tint.title": "Farbe oder Verlauf",
      "wallpaper.tint.solid": "Einfarbig",
      "wallpaper.tint.gradient": "Verlauf",
      "wallpaper.tint.collapse": "Einklappen",
      "wallpaper.tint.colour1": "Farbe 1",
      "wallpaper.tint.colour2": "Farbe 2",
      "wallpaper.tint.angle": "Winkel",
      "wallpaper.logo.title": "Logo",
      "wallpaper.logo.upload": "Logo hochladen",
      "wallpaper.logo.remove": "Entfernen",
      "wallpaper.logo.size": "Größe",
      "wallpaper.logo.horizontal": "Horizontal",
      "wallpaper.logo.vertical": "Vertikal",
      "wallpaper.darken": "Abdunkeln",
      "wallpaper.blur": "Weichzeichnen",

      "scope.domain": "Erscheinungsbild gespeichert für {host}",
      "scope.default": "Das Erscheinungsbild gilt für jedes neue Projekt",

      "dev.noise.title": "Störende Elemente auf der Seite",
      "dev.noise.trial.label": "Testbanner ausblenden",
      "dev.noise.trial.hint": "Entfernt den Hinweis „Datenbank wird gelöscht“ und dessen Overlay.",
      "dev.noise.neutralize.label": "Banner für neutralisierte Datenbank ausblenden",
      "dev.noise.neutralize.hint": "Der rote Warnhinweis, dass diese Datenbank keine echten E-Mails versendet.",

      "dev.tools.title": "Werkzeuge",
      "dev.tools.debug.label": "Im Entwicklermodus öffnen",
      "dev.tools.debug.hint": "Lädt einmal mit <code>?debug=1</code> neu, falls noch nicht aktiv.",
      "dev.tools.copyfields.label": "Feldnamen per Klick kopieren",
      "dev.tools.copyfields.hint": "Klicke auf die Beschriftung eines Feldes, um seinen technischen Namen zu kopieren. Erfordert den Entwicklermodus.",
      "dev.tools.shellui.label": "Anpassungen der Shell-Oberfläche",
      "dev.tools.shellui.hint":
        "Im Odoo.sh-Editor: fügt einen <code>odoo-bin shell</code>-Eintrag zur Menüleiste hinzu, sowie die Schnellbefehle „Ordner zippen“ / „Modul aktualisieren“ im Dateibrowser.",

      "dev.badge.title": "Umgebungs-Badge",
      "dev.badge.corner.tl": "Oben links",
      "dev.badge.corner.tr": "Oben rechts",
      "dev.badge.corner.bl": "Unten links",
      "dev.badge.corner.br": "Unten rechts",
      "dev.badge.textsize": "Textgröße",
      "dev.badge.colorauto.title": "Farbe je nach Umgebung",
      "dev.badge.colorcustom.title": "Benutzerdefinierte Farbe",
      "dev.badge.neverhost.label": "Nie auf dieser Domain anzeigen",
      "dev.badge.neverhost.hintOdoo": "Nie auf {host} anzeigen",
      "dev.badge.neverhost.hintOther": "Nur auf Odoo-Projektdomains verfügbar.",

      "library.title": "Hintergrundbilder",
      "library.back": "Zurück",
      "library.empty": "Ausgewählte Bilder werden hier aufbewahrt. Füge eines im Bereich Hintergrundbild hinzu.",
      "library.count": "{n} gespeichert",

      "footer.discord": "Brauchst du Hilfe? Tritt unserem Discord bei",
      "footer.reset": "Alles zurücksetzen",
      "footer.saved": "Gespeichert",
    },

    fr: {
      "header.account.alt": "Compte",
      "header.db.none": "aucune page Odoo",
      "header.db.copy": "Copier le nom de la base de données",
      "header.enabled.title": "Tout activer ou désactiver",
      "header.enabled.aria": "Activer l'extension",

      "pro.chip.title": "Afficher votre statut PRO",
      "pro.label": "PRO",

      "tabs.appearance": "Apparence",
      "tabs.developer": "Développeur",
      "tabs.language.title": "Langue",

      "pro.modal.title": "Bienvenue à bord, testeur bêta !",
      "pro.modal.body":
        "Merci de nous aider à tester l'extension. En guise de remerciement, nous vous offrons un <strong>abonnement PRO</strong> pendant toute la durée de la bêta, entièrement gratuit.",
      "pro.modal.note": "Une fonctionnalité PRO s'active avec cette couleur au lieu de la couleur habituelle — c'est comme ça que vous la reconnaîtrez.",
      "pro.modal.fine": "*Nous vous préviendrons au moins 30 jours à l'avance avant que la bêta, et cet abonnement, ne prennent fin.",
      "pro.modal.button": "J'ai compris",

      "recognize.hint": "Cette page n'a pas été détectée comme étant Odoo. En est-ce une ?",
      "recognize.button": "Activer ici",

      "icons.title": "Icônes des applications",
      "icons.preview.caption": "Ventes",
      "icons.field.background": "Arrière-plan",
      "icons.field.border": "Bordure",
      "icons.field.effect": "Effet",
      "icons.size.label": "Taille de l'illustration",
      "icons.size.large": "Grande",
      "icons.size.medium": "Moyenne",
      "icons.size.small": "Petite",
      "icons.corners.label": "Coins",
      "icons.corners.aria": "Activer les coins arrondis",
      "icons.labeltheme.label": "Thème des étiquettes",
      "icons.labeltheme.auto": "Auto — conserver les couleurs propres à Odoo",
      "icons.labeltheme.light": "Texte clair — pour les fonds d'écran sombres",
      "icons.labeltheme.dark": "Texte foncé — pour les fonds d'écran clairs",
      "icons.hideNames.label": "Masquer les noms des applications",
      "icons.hideNames.hint": "Supprime les étiquettes et agrandit les icônes.",

      "wallpaper.title": "Fond d'écran",
      "wallpaper.url.placeholder": "Collez un lien d'image…",
      "wallpaper.url.add": "Ajouter",
      "wallpaper.upload.button": "Importer une photo ou une vidéo",
      "wallpaper.folder.link": "Lier un dossier",
      "wallpaper.folder.sync.title": "Vérifier le dossier pour de nouveaux fichiers",
      "wallpaper.folder.sync.aria": "Synchroniser le dossier",
      "wallpaper.folder.unlink": "Dissocier le dossier",
      "wallpaper.tint.enable.title": "Utiliser une couleur unie ou un dégradé comme fond d'écran",
      "wallpaper.tint.title": "Couleur unie ou dégradé",
      "wallpaper.tint.solid": "Uni",
      "wallpaper.tint.gradient": "Dégradé",
      "wallpaper.tint.collapse": "Réduire",
      "wallpaper.tint.colour1": "Couleur 1",
      "wallpaper.tint.colour2": "Couleur 2",
      "wallpaper.tint.angle": "Angle",
      "wallpaper.logo.title": "Logo",
      "wallpaper.logo.upload": "Importer un logo",
      "wallpaper.logo.remove": "Supprimer",
      "wallpaper.logo.size": "Taille",
      "wallpaper.logo.horizontal": "Horizontal",
      "wallpaper.logo.vertical": "Vertical",
      "wallpaper.darken": "Assombrir",
      "wallpaper.blur": "Flou",

      "scope.domain": "Apparence enregistrée pour {host}",
      "scope.default": "L'apparence s'applique à chaque nouveau projet",

      "dev.noise.title": "Éléments perturbateurs sur la page",
      "dev.noise.trial.label": "Masquer la bannière d'essai",
      "dev.noise.trial.hint": "Supprime l'avis « la base de données sera supprimée » et son overlay.",
      "dev.noise.neutralize.label": "Masquer la bannière de base de données neutralisée",
      "dev.noise.neutralize.hint": "Le bandeau rouge indiquant que cette base de données n'envoie pas de vrais e-mails.",

      "dev.tools.title": "Outils",
      "dev.tools.debug.label": "Ouvrir en mode développeur",
      "dev.tools.debug.hint": "Recharge une fois avec <code>?debug=1</code> si ce n'est pas déjà activé.",
      "dev.tools.copyfields.label": "Copier les noms de champs au clic",
      "dev.tools.copyfields.hint": "Cliquez sur l'étiquette d'un champ pour copier son nom technique. Nécessite le mode développeur.",
      "dev.tools.shellui.label": "Personnalisations de l'interface du shell",
      "dev.tools.shellui.hint":
        "Dans l'éditeur d'Odoo.sh : ajoute un élément <code>odoo-bin shell</code> à la barre de menus, ainsi que des commandes rapides « Compresser le dossier » / « Mettre à jour le module » dans l'explorateur de fichiers.",

      "dev.badge.title": "Badge d'environnement",
      "dev.badge.corner.tl": "En haut à gauche",
      "dev.badge.corner.tr": "En haut à droite",
      "dev.badge.corner.bl": "En bas à gauche",
      "dev.badge.corner.br": "En bas à droite",
      "dev.badge.textsize": "Taille du texte",
      "dev.badge.colorauto.title": "Couleur selon l'environnement",
      "dev.badge.colorcustom.title": "Couleur personnalisée",
      "dev.badge.neverhost.label": "Ne jamais l'afficher sur ce domaine",
      "dev.badge.neverhost.hintOdoo": "Ne jamais l'afficher sur {host}",
      "dev.badge.neverhost.hintOther": "Disponible uniquement sur les domaines de projets Odoo.",

      "library.title": "Fonds d'écran",
      "library.back": "Retour",
      "library.empty": "Les images que vous choisissez sont conservées ici. Ajoutez-en une depuis la section fond d'écran.",
      "library.count": "{n} enregistrés",

      "footer.discord": "Besoin d'aide ? Rejoignez notre Discord",
      "footer.reset": "Tout réinitialiser",
      "footer.saved": "Enregistré",
    },

    // Da riempire in un secondo momento: finche' restano vuote, t() ripiega
    // automaticamente sull'inglese qui sopra.
    es: {
      "header.account.alt": "Cuenta",
      "header.db.none": "sin página de Odoo",
      "header.db.copy": "Copiar el nombre de la base de datos",
      "header.enabled.title": "Activar o desactivar todo",
      "header.enabled.aria": "Activar la extensión",

      "pro.chip.title": "Ver tu estado PRO",
      "pro.label": "PRO",

      "tabs.appearance": "Apariencia",
      "tabs.developer": "Desarrollador",
      "tabs.language.title": "Idioma",

      "pro.modal.title": "¡Bienvenido a bordo, beta tester!",
      "pro.modal.body":
        "Gracias por ayudarnos a probar la extensión. Como agradecimiento, te regalamos una <strong>suscripción PRO</strong> mientras dure la beta, totalmente gratis.",
      "pro.modal.note": "Una función PRO se activa con este color en lugar del habitual: así la reconocerás.",
      "pro.modal.fine": "*Te avisaremos con al menos 30 días de antelación antes de que la beta, y esta suscripción, terminen.",
      "pro.modal.button": "Entendido",

      "recognize.hint": "Esta página no se detectó como Odoo. ¿Lo es?",
      "recognize.button": "Activar aquí",

      "icons.title": "Iconos de las aplicaciones",
      "icons.preview.caption": "Ventas",
      "icons.field.background": "Fondo",
      "icons.field.border": "Borde",
      "icons.field.effect": "Efecto",
      "icons.size.label": "Tamaño de la imagen",
      "icons.size.large": "Grande",
      "icons.size.medium": "Mediano",
      "icons.size.small": "Pequeño",
      "icons.corners.label": "Esquinas",
      "icons.corners.aria": "Activar esquinas redondeadas",
      "icons.labeltheme.label": "Tema de las etiquetas",
      "icons.labeltheme.auto": "Auto — mantener los colores propios de Odoo",
      "icons.labeltheme.light": "Texto claro — para fondos oscuros",
      "icons.labeltheme.dark": "Texto oscuro — para fondos claros",
      "icons.hideNames.label": "Ocultar nombres de las apps",
      "icons.hideNames.hint": "Quita las etiquetas y agranda los iconos.",

      "wallpaper.title": "Fondo de pantalla",
      "wallpaper.url.placeholder": "Pega el enlace de una imagen…",
      "wallpaper.url.add": "Añadir",
      "wallpaper.upload.button": "Subir foto o vídeo",
      "wallpaper.folder.link": "Vincular una carpeta",
      "wallpaper.folder.sync.title": "Buscar archivos nuevos en la carpeta",
      "wallpaper.folder.sync.aria": "Sincronizar carpeta",
      "wallpaper.folder.unlink": "Desvincular carpeta",
      "wallpaper.tint.enable.title": "Usar un color sólido o un degradado como fondo de pantalla",
      "wallpaper.tint.title": "Color sólido o degradado",
      "wallpaper.tint.solid": "Sólido",
      "wallpaper.tint.gradient": "Degradado",
      "wallpaper.tint.collapse": "Contraer",
      "wallpaper.tint.colour1": "Color 1",
      "wallpaper.tint.colour2": "Color 2",
      "wallpaper.tint.angle": "Ángulo",
      "wallpaper.logo.title": "Logo",
      "wallpaper.logo.upload": "Subir logo",
      "wallpaper.logo.remove": "Quitar",
      "wallpaper.logo.size": "Tamaño",
      "wallpaper.logo.horizontal": "Horizontal",
      "wallpaper.logo.vertical": "Vertical",
      "wallpaper.darken": "Oscurecer",
      "wallpaper.blur": "Desenfoque",

      "scope.domain": "Apariencia guardada para {host}",
      "scope.default": "La apariencia se aplica a cada proyecto nuevo",

      "dev.noise.title": "Ruido en la página",
      "dev.noise.trial.label": "Ocultar el banner de prueba",
      "dev.noise.trial.hint": "Elimina el aviso \"la base de datos se eliminará\" y su superposición.",
      "dev.noise.neutralize.label": "Ocultar el banner de base de datos neutralizada",
      "dev.noise.neutralize.hint": "La franja roja que avisa de que esta base de datos no envía correos reales.",

      "dev.tools.title": "Herramientas",
      "dev.tools.debug.label": "Abrir en modo desarrollador",
      "dev.tools.debug.hint": "Recarga una vez con <code>?debug=1</code> si aún no está activado.",
      "dev.tools.copyfields.label": "Copiar nombres de campo al hacer clic",
      "dev.tools.copyfields.hint": "Haz clic en la etiqueta de un campo para copiar su nombre técnico. Requiere el modo desarrollador.",
      "dev.tools.shellui.label": "Ajustes de la interfaz de la shell",
      "dev.tools.shellui.hint":
        "En el editor de Odoo.sh: añade un elemento <code>odoo-bin shell</code> a la barra de menús, y los comandos rápidos \"Comprimir carpeta\" / \"Actualizar módulo\" en el explorador de archivos.",

      "dev.badge.title": "Insignia de entorno",
      "dev.badge.corner.tl": "Arriba a la izquierda",
      "dev.badge.corner.tr": "Arriba a la derecha",
      "dev.badge.corner.bl": "Abajo a la izquierda",
      "dev.badge.corner.br": "Abajo a la derecha",
      "dev.badge.textsize": "Tamaño del texto",
      "dev.badge.colorauto.title": "Color según el entorno",
      "dev.badge.colorcustom.title": "Color personalizado",
      "dev.badge.neverhost.label": "No mostrarlo nunca en este dominio",
      "dev.badge.neverhost.hintOdoo": "No mostrarlo nunca en {host}",
      "dev.badge.neverhost.hintOther": "Disponible solo en dominios de proyectos Odoo.",

      "library.title": "Fondos de pantalla",
      "library.back": "Atrás",
      "library.empty": "Las imágenes que elijas se guardan aquí. Añade una desde la sección de fondo de pantalla.",
      "library.count": "{n} guardados",

      "footer.discord": "¿Necesitas ayuda? Únete a nuestro Discord",
      "footer.reset": "Restablecer todo",
      "footer.saved": "Guardado",
    },

    nl: {
      "header.account.alt": "Account",
      "header.db.none": "geen Odoo-pagina",
      "header.db.copy": "Databasenaam kopiëren",
      "header.enabled.title": "Alles in- of uitschakelen",
      "header.enabled.aria": "Extensie inschakelen",

      "pro.chip.title": "Bekijk je PRO-status",
      "pro.label": "PRO",

      "tabs.appearance": "Uiterlijk",
      "tabs.developer": "Ontwikkelaar",
      "tabs.language.title": "Taal",

      "pro.modal.title": "Welkom aan boord, betatester!",
      "pro.modal.body":
        "Bedankt dat je ons helpt de extensie te testen. Als bedankje geven we je een <strong>PRO-abonnement</strong> voor de duur van de bèta — helemaal gratis.",
      "pro.modal.note": "Een PRO-functie schakelt in met deze kleur in plaats van de gebruikelijke — zo herken je hem.",
      "pro.modal.fine": "*We laten je minstens 30 dagen van tevoren weten voordat de bèta, en dit abonnement, ooit eindigen.",
      "pro.modal.button": "Begrepen",

      "recognize.hint": "Deze pagina werd niet herkend als Odoo. Is het er een?",
      "recognize.button": "Hier inschakelen",

      "icons.title": "App-iconen",
      "icons.preview.caption": "Verkoop",
      "icons.field.background": "Achtergrond",
      "icons.field.border": "Rand",
      "icons.field.effect": "Effect",
      "icons.size.label": "Afbeeldingsgrootte",
      "icons.size.large": "Groot",
      "icons.size.medium": "Middel",
      "icons.size.small": "Klein",
      "icons.corners.label": "Hoeken",
      "icons.corners.aria": "Afgeronde hoeken inschakelen",
      "icons.labeltheme.label": "Labelthema",
      "icons.labeltheme.auto": "Auto — Odoo's eigen kleuren behouden",
      "icons.labeltheme.light": "Lichte tekst — voor donkere achtergronden",
      "icons.labeltheme.dark": "Donkere tekst — voor lichte achtergronden",
      "icons.hideNames.label": "App-namen verbergen",
      "icons.hideNames.hint": "Verwijdert de labels en vergroot de iconen.",

      "wallpaper.title": "Achtergrond",
      "wallpaper.url.placeholder": "Plak een afbeeldingslink…",
      "wallpaper.url.add": "Toevoegen",
      "wallpaper.upload.button": "Foto of video uploaden",
      "wallpaper.folder.link": "Map koppelen",
      "wallpaper.folder.sync.title": "Map controleren op nieuwe bestanden",
      "wallpaper.folder.sync.aria": "Map synchroniseren",
      "wallpaper.folder.unlink": "Map ontkoppelen",
      "wallpaper.tint.enable.title": "Een effen kleur of verloop als achtergrond gebruiken",
      "wallpaper.tint.title": "Effen kleur of verloop",
      "wallpaper.tint.solid": "Effen",
      "wallpaper.tint.gradient": "Verloop",
      "wallpaper.tint.collapse": "Inklappen",
      "wallpaper.tint.colour1": "Kleur 1",
      "wallpaper.tint.colour2": "Kleur 2",
      "wallpaper.tint.angle": "Hoek",
      "wallpaper.logo.title": "Logo",
      "wallpaper.logo.upload": "Logo uploaden",
      "wallpaper.logo.remove": "Verwijderen",
      "wallpaper.logo.size": "Grootte",
      "wallpaper.logo.horizontal": "Horizontaal",
      "wallpaper.logo.vertical": "Verticaal",
      "wallpaper.darken": "Verdonkeren",
      "wallpaper.blur": "Vervagen",

      "scope.domain": "Uiterlijk opgeslagen voor {host}",
      "scope.default": "Het uiterlijk geldt voor elk nieuw project",

      "dev.noise.title": "Storende elementen op de pagina",
      "dev.noise.trial.label": "Proefbanner verbergen",
      "dev.noise.trial.hint": "Verwijdert de melding \"database wordt verwijderd\" en de overlay ervan.",
      "dev.noise.neutralize.label": "Banner voor geneutraliseerde database verbergen",
      "dev.noise.neutralize.hint": "De rode balk die waarschuwt dat deze database geen echte e-mail verstuurt.",

      "dev.tools.title": "Hulpmiddelen",
      "dev.tools.debug.label": "Openen in ontwikkelaarsmodus",
      "dev.tools.debug.hint": "Herlaadt eenmalig met <code>?debug=1</code> als dat nog niet aanstaat.",
      "dev.tools.copyfields.label": "Veldnamen kopiëren bij klikken",
      "dev.tools.copyfields.hint": "Klik op het label van een veld om de technische naam te kopiëren. Vereist ontwikkelaarsmodus.",
      "dev.tools.shellui.label": "Aanpassingen aan de shell-interface",
      "dev.tools.shellui.hint":
        "In de editor van Odoo.sh: voegt een <code>odoo-bin shell</code>-item toe aan de menubalk, plus snelle opdrachten \"Map zippen\" / \"Module bijwerken\" in de bestandsbrowser.",

      "dev.badge.title": "Omgevingsbadge",
      "dev.badge.corner.tl": "Linksboven",
      "dev.badge.corner.tr": "Rechtsboven",
      "dev.badge.corner.bl": "Linksonder",
      "dev.badge.corner.br": "Rechtsonder",
      "dev.badge.textsize": "Tekstgrootte",
      "dev.badge.colorauto.title": "Kleur op basis van omgeving",
      "dev.badge.colorcustom.title": "Aangepaste kleur",
      "dev.badge.neverhost.label": "Nooit tonen op dit domein",
      "dev.badge.neverhost.hintOdoo": "Nooit tonen op {host}",
      "dev.badge.neverhost.hintOther": "Alleen beschikbaar op Odoo-projectdomeinen.",

      "library.title": "Achtergronden",
      "library.back": "Terug",
      "library.empty": "Afbeeldingen die je kiest, worden hier bewaard. Voeg er een toe vanuit het onderdeel Achtergrond.",
      "library.count": "{n} opgeslagen",

      "footer.discord": "Hulp nodig? Word lid van onze Discord",
      "footer.reset": "Alles resetten",
      "footer.saved": "Opgeslagen",
    },

    pt: {
      "header.account.alt": "Conta",
      "header.db.none": "nenhuma página do Odoo",
      "header.db.copy": "Copiar o nome da base de dados",
      "header.enabled.title": "Ativar ou desativar tudo",
      "header.enabled.aria": "Ativar a extensão",

      "pro.chip.title": "Ver o teu estado PRO",
      "pro.label": "PRO",

      "tabs.appearance": "Aparência",
      "tabs.developer": "Programador",
      "tabs.language.title": "Idioma",

      "pro.modal.title": "Bem-vindo a bordo, beta tester!",
      "pro.modal.body":
        "Obrigado por nos ajudares a testar a extensão. Como agradecimento, oferecemos-te uma <strong>subscrição PRO</strong> durante toda a beta — totalmente grátis.",
      "pro.modal.note": "Uma funcionalidade PRO liga-se com esta cor em vez da habitual — é assim que a vais reconhecer.",
      "pro.modal.fine": "*Vamos avisar-te com pelo menos 30 dias de antecedência antes de a beta, e esta subscrição, terminarem.",
      "pro.modal.button": "Entendi",

      "recognize.hint": "Esta página não foi detetada como Odoo. É uma?",
      "recognize.button": "Ativar aqui",

      "icons.title": "Ícones das aplicações",
      "icons.preview.caption": "Vendas",
      "icons.field.background": "Fundo",
      "icons.field.border": "Contorno",
      "icons.field.effect": "Efeito",
      "icons.size.label": "Tamanho da imagem",
      "icons.size.large": "Grande",
      "icons.size.medium": "Médio",
      "icons.size.small": "Pequeno",
      "icons.corners.label": "Cantos",
      "icons.corners.aria": "Ativar cantos arredondados",
      "icons.labeltheme.label": "Tema das etiquetas",
      "icons.labeltheme.auto": "Automático — manter as cores originais do Odoo",
      "icons.labeltheme.light": "Texto claro — para fundos escuros",
      "icons.labeltheme.dark": "Texto escuro — para fundos claros",
      "icons.hideNames.label": "Ocultar nomes das aplicações",
      "icons.hideNames.hint": "Remove as etiquetas e aumenta os ícones.",

      "wallpaper.title": "Fundo de ecrã",
      "wallpaper.url.placeholder": "Cola o link de uma imagem…",
      "wallpaper.url.add": "Adicionar",
      "wallpaper.upload.button": "Carregar foto ou vídeo",
      "wallpaper.folder.link": "Associar uma pasta",
      "wallpaper.folder.sync.title": "Verificar a pasta em busca de novos ficheiros",
      "wallpaper.folder.sync.aria": "Sincronizar pasta",
      "wallpaper.folder.unlink": "Desassociar pasta",
      "wallpaper.tint.enable.title": "Usar uma cor sólida ou gradiente como fundo de ecrã",
      "wallpaper.tint.title": "Cor sólida ou gradiente",
      "wallpaper.tint.solid": "Sólida",
      "wallpaper.tint.gradient": "Gradiente",
      "wallpaper.tint.collapse": "Recolher",
      "wallpaper.tint.colour1": "Cor 1",
      "wallpaper.tint.colour2": "Cor 2",
      "wallpaper.tint.angle": "Ângulo",
      "wallpaper.logo.title": "Logótipo",
      "wallpaper.logo.upload": "Carregar logótipo",
      "wallpaper.logo.remove": "Remover",
      "wallpaper.logo.size": "Tamanho",
      "wallpaper.logo.horizontal": "Horizontal",
      "wallpaper.logo.vertical": "Vertical",
      "wallpaper.darken": "Escurecer",
      "wallpaper.blur": "Desfoque",

      "scope.domain": "Aparência guardada para {host}",
      "scope.default": "A aparência aplica-se a cada novo projeto",

      "dev.noise.title": "Ruído na página",
      "dev.noise.trial.label": "Ocultar o banner de teste",
      "dev.noise.trial.hint": "Remove o aviso \"a base de dados vai ser eliminada\" e a respetiva sobreposição.",
      "dev.noise.neutralize.label": "Ocultar o banner de base de dados neutralizada",
      "dev.noise.neutralize.hint": "A faixa vermelha que avisa que esta base de dados não envia e-mails reais.",

      "dev.tools.title": "Ferramentas",
      "dev.tools.debug.label": "Abrir em modo de programador",
      "dev.tools.debug.hint": "Recarrega uma vez com <code>?debug=1</code> caso ainda não esteja ativo.",
      "dev.tools.copyfields.label": "Copiar nomes de campo ao clicar",
      "dev.tools.copyfields.hint": "Clica na etiqueta de um campo para copiar o seu nome técnico. Requer o modo de programador.",
      "dev.tools.shellui.label": "Personalizações da interface da shell",
      "dev.tools.shellui.hint":
        "No editor do Odoo.sh: adiciona um item <code>odoo-bin shell</code> à barra de menus, e comandos rápidos \"Comprimir pasta\" / \"Atualizar módulo\" no explorador de ficheiros.",

      "dev.badge.title": "Etiqueta de ambiente",
      "dev.badge.corner.tl": "Superior esquerdo",
      "dev.badge.corner.tr": "Superior direito",
      "dev.badge.corner.bl": "Inferior esquerdo",
      "dev.badge.corner.br": "Inferior direito",
      "dev.badge.textsize": "Tamanho do texto",
      "dev.badge.colorauto.title": "Cor consoante o ambiente",
      "dev.badge.colorcustom.title": "Cor personalizada",
      "dev.badge.neverhost.label": "Nunca mostrar neste domínio",
      "dev.badge.neverhost.hintOdoo": "Nunca mostrar em {host}",
      "dev.badge.neverhost.hintOther": "Disponível apenas em domínios de projetos Odoo.",

      "library.title": "Fundos de ecrã",
      "library.back": "Voltar",
      "library.empty": "As imagens que escolheres ficam guardadas aqui. Adiciona uma a partir da secção de fundo de ecrã.",
      "library.count": "{n} guardados",

      "footer.discord": "Precisas de ajuda? Junta-te ao nosso Discord",
      "footer.reset": "Repor tudo",
      "footer.saved": "Guardado",
    },
  };
})();