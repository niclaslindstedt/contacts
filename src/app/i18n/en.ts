// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The bundled English catalog — also the source of the `Catalog` / message-key
// types every other language must satisfy. Grouped by surface; the runtime
// (`./index.ts`) flattens it to dotted keys (`menu.contacts`, …) that `t()`
// resolves.

import type { Widen } from "@niclaslindstedt/oss-framework/i18n";

export const en = {
  common: {
    close: "Close",
    cancel: "Cancel",
    save: "Save",
    clear: "Clear",
    resetToDefaults: "Reset to defaults",
  },
  import: {
    // The drag-and-drop import overlay + result banner.
    dropTitle: "Drop to import contacts",
    dropHint: "vCard (.vcf), CSV, or a JSON backup",
    done: "Imported {n} contacts",
    doneOne: "Imported 1 contact",
    none: "No contacts found in that file",
  },
  toast: {
    // The hovering "action taken — undo?" banner raised after an archive or a
    // delete, mirroring the import result banner.
    contactArchived: "Contact archived",
    contactDeleted: "Contact deleted",
    folderArchived: "Folder archived",
    folderDeleted: "Folder deleted",
    undo: "Undo",
  },
  menu: {
    namespaces: "Namespaces",
    switchToNamespace: "Switch to {name}",
    showNamespaces: "Show namespaces",
    hideNamespaces: "Hide namespaces",
    contacts: "Contacts",
    newContact: "New contact",
    newFolder: "New folder",
    newSubfolder: "New subfolder",
    subfolderName: "Subfolder name",
    folderName: "Folder name",
    renameFolder: "Rename folder",
    deleteFolder: "Delete folder",
    folderActions: "Folder actions",
    moveToFolder: "Move to folder…",
    moveToFolderMenu: "Move to folder",
    noFolder: "No folder",
    newContactIn: "New contact in {name}",
    newSubfolderIn: "New subfolder in {name}",
    collapseAllFolders: "Collapse all folders",
    expandAllFolders: "Expand all folders",
    collapseFooter: "Collapse footer",
    expandFooter: "Expand footer",
    contactName: "Contact name",
    renameContact: "Rename",
    deleteContact: "Delete",
    contactActions: "Contact actions",
    // In case of emergency (ICE) — the pinned section title and the badge on a
    // flagged contact row.
    emergency: "In case of emergency",
    iceContact: "Emergency contact",
    dropToArchive: "Drop here to archive",
    archive: "Archive",
    list: "List",
    favorites: "Favorites",
    undo: "Undo",
    redo: "Redo",
    search: "Search",
    donate: "Donate",
    about: "About",
    whatsNew: "What’s new",
    source: "Source code",
    checkUpdates: "Check for updates",
    checkingUpdates: "Checking for updates…",
    upToDate: "You’re up to date",
    updateAvailable: "Update available",
    updatesUnavailable: "Updates unavailable",
    updating: "Updating…",
    settings: "Settings",
  },
  changelog: {
    heading: "What’s new",
    empty: "No releases yet.",
    back: "Back",
  },
  archive: {
    title: "Archive",
    empty:
      "Nothing archived. Swipe a contact or folder right — or drag it onto Archive — to shelve it here.",
    folders: "Archived folders",
    contacts: "Archived contacts",
    restoreFolder: "Restore folder",
    restoreContact: "Restore contact",
    delete: "Delete",
    rowActions: "Archive actions",
  },
  favorites: {
    title: "Favorites",
    empty:
      "No favorites yet. Open a contact and tap the heart to add it to this shortlist.",
    // The drag handle on a Favorites row — drag to reorder the shortlist.
    reorder: "Drag to reorder {name}",
  },
  list: {
    title: "List",
    empty: "No contacts yet. Add one from the sidebar to see it here.",
    ungrouped: "No folder",
    noContactMethods: "No phone or email",
    select: "Select",
    selectAll: "Select all",
    selectNone: "Select none",
    selectContact: "Select {name}",
    selectedCount: "{n} selected",
    exitSelect: "Exit selection",
    copy: "Copy selected",
    export: "Export selected",
    exportVCard: "Export as vCard",
    exportCsv: "Export as CSV",
  },
  search: {
    title: "Search",
    placeholder: "Search names, numbers, emails…",
    clear: "Clear search",
    prompt: "Search your contacts by name, number, email, or notes.",
    hint: "Use * and ? for wildcards, or /regex/ for a pattern.",
    invalidRegex: "Invalid regular expression.",
    noResults: "No results for “{query}”.",
    matchesOne: "1 contact",
    matchesOther: "{n} contacts",
    inContact: "matched the name",
  },
  namespaces: {
    open: "Manage namespaces",
    heading: "Namespaces",
    blurb:
      "Each namespace is its own address book with its own contacts. Switch between them, or give one an icon and colour.",
    newAction: "New namespace",
    namePlaceholder: "Namespace name",
    nameLabel: "Namespace name",
    create: "Create",
    nameRequired: "A name is required",
    colorLabel: "Colour",
    glyphLabel: "Icon",
    glyphNone: "No icon",
    save: "Save",
    cancel: "Cancel",
    renameAction: "Rename",
    deleteAction: "Delete namespace",
    delete: "Delete",
    deleteConfirm:
      "Delete “{name}” and all of its contacts? This can't be undone.",
    switchTo: "Switch to {name}",
    defaultBadge: "Default",
  },
  contact: {
    unnamed: "New contact",
    renameContact: "Edit name",
    fullNamePlaceholder: "First and last name",
    editContact: "Edit contact",
    doneEditing: "Done",
    addFavorite: "Add to favorites",
    removeFavorite: "Remove from favorites",
    reachTitle: "Get in touch",
    phone: "Phone",
    email: "Email",
    emptyHint: "Nothing here yet. Add phone numbers, emails, and more.",
    addDetails: "Add details",
    copyCard: "Copy card",
    copied: "Copied",
    exportVCard: "Download vCard",
    appearance: "Contact photo and appearance",
    photo: "Photo",
    photos: "Photos",
    uploadPhoto: "Upload photo",
    addPhoto: "Add another photo",
    adjustPhoto: "Adjust photo",
    removePhoto: "Remove photo",
    viewPhoto: "View photo",
    // Short verbs for the compact action buttons — the full "…photo" strings
    // above stay as the accessible labels.
    adjust: "Adjust",
    remove: "Remove",
    // The photo gallery — several pictures per contact, one shown at a time.
    usePhoto: "Use this photo",
    currentPhoto: "Current photo",
    // The swipeable viewer's position readout / thumbnail count: "2 of 3".
    photoPosition: "{n} of {m}",
    showPhotoNumber: "Show photo {n}",
    // The overlay shown when an image is dragged onto the open contact.
    dropPhotoTitle: "Drop to set photo",
    dropPhotoHint: "Release to set this contact's photo",
    dropPhotoHintNamed: "Release to set {name}'s photo",
    cropTitle: "Position photo",
    cropHint:
      "Drag to move, and pinch or scroll to zoom. The circle is what shows.",
    zoom: "Zoom",
    savePhoto: "Save",
    colour: "Colour",
    icon: "Icon",
    defaultIcon: "Default icon",
    phones: "Phone numbers",
    addPhone: "Add phone number",
    phonePlaceholder: "Phone number",
    emails: "Email addresses",
    addEmail: "Add email address",
    emailPlaceholder: "Email address",
    removeRow: "Remove",
    // The private / work type a phone number or email carries.
    kindPrivate: "Private",
    kindWork: "Work",
    phoneKind: "Phone type",
    phoneCountry: "Country code",
    // The star on each phone row (shown when a card has more than one number)
    // that picks the primary — the single number the Favorites page shows.
    markPrimary: "Set as primary number",
    clearPrimary: "Clear primary number",
    // The badge on the primary number in the read view.
    primaryLabel: "Primary",
    emailKind: "Email type",
    details: "Details",
    firstName: "First name",
    lastName: "Last name",
    company: "Company",
    // Section title for the person-vs-company switch at the bottom of the card.
    cardType: "Card type",
    // The flip switch that turns a person card into a company card.
    companyToggle: "Company contact",
    companyToggleHint:
      "Titled by one company name and shown with a building icon. Person-only fields — the name, birthday, and important dates — are removed.",
    homepage: "Website",
    homepagePlaceholder: "https://example.com",
    address: "Address",
    addresses: "Addresses",
    addAddress: "Add address",
    addressTitle: "Title",
    addressTitlePlaceholder: "Home",
    removeAddress: "Remove address",
    street: "Street",
    zip: "Postal code",
    city: "City",
    openMaps: "Open in Maps",
    birthday: "Birthday",
    showAge: "Show age",
    ageValue: "{n} years old",
    yearsValue: "{n} years",
    birthdayToday: "Today",
    birthdayTomorrow: "Tomorrow",
    birthdayInDays: "in {n} days",
    addToCalendar: "Add birthday to calendar",
    birthdayEventTitle: "{name}'s birthday",
    // Extra important dates (name day, anniversary, …).
    importantDates: "Important dates",
    addImportantDate: "Add date",
    importantDate: "Date",
    importantDateLabel: "Occasion",
    importantDateLabelPlaceholder: "Anniversary",
    importantDateLabelRequired: "Give the occasion a name.",
    removeImportantDate: "Remove date",
    dateMonth: "Month",
    dateDay: "Day",
    dateYear: "Year",
    dateYearOptional: "Year (optional)",
    addDateToCalendar: "Add reminder to calendar",
    notes: "Notes",
    notesPlaceholder: "Anything worth remembering…",
    // Attachments: files clipped to a card (a menu, a contract, a scanned card).
    attachments: "Attachments",
    addAttachment: "Add file",
    attachmentReading: "Reading…",
    removeAttachment: "Remove file",
    attachmentDescription: "Description",
    attachmentDescriptionPlaceholder: "What is this file?",
    attachmentTooLarge: "Some files were too large to attach: {names}",
    viewAttachment: "View {name}",
    openAttachment: "Open in a new tab",
    downloadAttachment: "Download",
    // The in-case-of-emergency toggle, now at the bottom of edit mode.
    iceToggle: "Emergency contact",
    iceToggleHint:
      "Pins this card to the top of the menu so a first responder can reach it fast.",
    // Auto-archive: a self-filing schedule on the card.
    autoArchive: "Auto-archive",
    autoArchiveToggle: "Time limited contact",
    autoArchiveHint:
      "Pick a date and this card files itself away when you no longer need it.",
    autoArchiveDate: "On this date",
    autoArchiveAction: "Then",
    autoArchiveArchive: "Archive",
    autoArchiveDelete: "Delete",
    autoArchiveArchivesOn: "Archives itself on {date}",
    autoArchiveDeletesOn: "Deletes itself on {date}",
    archive: "Archive contact",
    delete: "Delete contact",
  },
  sync: {
    // The header status glyph (`SyncStatus`).
    saving: "Saving…",
    syncedTo: "Synced to {name}",
    saveUnsaved: "Unsaved changes — tap for details",
    failed: "Sync failed — tap for details",
    throttled: "Rate limited — tap for details",
    reauthRequired: "Reconnect needed — tap to fix",
    syncConflict: "Sync conflict — tap to resolve",
    offline: "Offline — editing a local copy",
    // The command centre (`SyncDetailsModal`).
    cloudSync: "Sync",
    status: "Status",
    backend: "Backend",
    fileLocation: "File location",
    encryptionLabel: "Encryption",
    encryptionOn: "On",
    encryptionOff: "Off",
    reloadFromBackend: "Reload from the backend",
    saveNow: "Save now",
    tryAgain: "Try again",
    reconnect: "Reconnect {name}",
    openIn: "Open in {name}",
    checkConnection: "Check connection",
    viewSyncLog: "View sync log",
    hideSyncLog: "Hide sync log",
    syncingNow: "Saving your changes…",
    failedHeading: "Sync failed",
    failedDetailFallback:
      "The last save to {name} didn't go through. Try again — and if it keeps failing, check your connection.",
    throttledHeading: "Rate limited",
    throttledDetail:
      "{name} is asking the app to slow down. Saving will resume automatically in a moment.",
    reauthHeading: "Reconnect needed",
    reauthDetail:
      "Your session with {name} has expired. Reconnect to keep saving.",
    conflictHeading: "Sync conflict",
    conflictDetail:
      "Another device saved a newer version. Reload from the backend to adopt it, or Save now to overwrite it with this device's copy.",
    pendingHeading: "Waiting to sync",
    pendingDetail: "Your latest edits aren't saved to {name} yet.",
    offlineHeading: "Offline",
    offlineDetail:
      "Can't reach {name} right now, so you're working on the copy saved on this device. Any changes are kept locally and sync automatically when you're back online.",
    checkPinging: "Reaching {name}…",
    checkStillOffline:
      "Still can't reach {name}. Your edits are saved on this device and will sync automatically once you're back online.",
    checkAuthExpired:
      "Your session with {name} has expired — reconnect to continue.",
  },
  cloudSetup: {
    // The connect-time replace-or-adopt prompt (`CloudSetupModal`).
    title: "{name} already has contacts",
    hint: "This device and {name} both hold contacts. Keep one — the other is replaced. This choice only happens now, while setting up sync.",
    thisDevice: "This device",
    counts: "{contacts} contacts · {folders} folders",
    useCloud: "Use the {name} copy",
    replace: "Replace {name} with this device",
  },
  achievements: {
    // The achievements tour chrome — the framework owns the modal, the app
    // owns the words. `counter` / `tierPoints` carry `{…}` placeholders the
    // renderer fills. See `buildCatalog` for the per-trophy strings below.
    modal: {
      title: "Achievements",
      intro:
        "Every feature is a trophy. Work down the tiers and unlock them by using the app.",
      locked: "Locked",
      learnMore: "Learn more",
      close: "Close",
      counter: "{unlocked} of {total} unlocked",
      tierPoints: "{earned} / {max} pts",
      tier: {
        beginner: {
          title: "Beginner",
          subtitle: "The first steps every address book takes.",
        },
        intermediate: {
          title: "Intermediate",
          subtitle: "Shaping the book around a real life.",
        },
        pro: {
          title: "Pro",
          subtitle: "Letting the app do the tidying for you.",
        },
        expert: {
          title: "Expert",
          subtitle: "Bending it to your own edge cases.",
        },
      },
    },
    unlock: {
      titleOne: "Achievement unlocked",
      titleOther: "{n} achievements unlocked",
      dismiss: "Nice",
      close: "Close",
    },
    trophy: {
      open: "Achievements",
      unseen: "{n} new",
    },
    // The catalog. Each id matches a `Spec` in `achievements.ts`; a `learnMore`
    // is present only where that spec sets `hasLearnMore`.
    catalog: {
      firstContact: {
        name: "First Contact",
        condition: "Name your first contact.",
        learnMore:
          "Tap New, type a name, press Enter. That single card is the loop the whole app is built around.",
      },
      wellConnected: {
        name: "Well Connected",
        condition: "Give a contact both a phone number and an email.",
      },
      collector: {
        name: "Collector",
        condition: "Keep five or more contacts.",
      },
      filingSystem: {
        name: "Filing System",
        condition: "Create a folder.",
      },
      subfolder: {
        name: "Nesting Instinct",
        condition: "Nest a folder inside another.",
        learnMore:
          "Drag one folder onto another to tuck it inside — folders nest to any depth, and archiving or moving a folder carries its whole subtree along.",
      },
      seeker: {
        name: "Seeker",
        condition: "Search your contacts.",
      },
      birthday: {
        name: "Many Happy Returns",
        condition: "Add a contact's birthday.",
      },
      importantDate: {
        name: "Save the Date",
        condition: "Add an important date beyond a birthday.",
      },
      address: {
        name: "You Are Here",
        condition: "Add a postal address to a contact.",
      },
      favorite: {
        name: "Held Dear",
        condition: "Star a contact as a favorite.",
        learnMore:
          "Tap the heart on a card or a list row and the contact joins your Favorites page — a hand-orderable shortlist of the people you reach for most.",
      },
      emergency: {
        name: "In Case of Emergency",
        condition: "Flag a contact for emergencies.",
      },
      company: {
        name: "Incorporated",
        condition: "Turn a card into a company contact.",
      },
      archivist: {
        name: "Cold Storage",
        condition: "Archive a contact.",
      },
      namespaces: {
        name: "Double Life",
        condition: "Create a second address book.",
        learnMore:
          "Namespaces are wholly separate address books — one for work, one for life — that you switch between and move contacts across from the side menu.",
      },
      photogenic: {
        name: "Photogenic",
        condition: "Give a contact a photo.",
        learnMore:
          "Open a card's avatar in the header and upload a picture — it shows in the side menu and travels with vCard exports.",
      },
      gallery: {
        name: "Picture Perfect",
        condition: "Give one contact more than one photo.",
      },
      madeItYours: {
        name: "Made It Yours",
        condition: "Give a contact an icon or colour.",
      },
      attachment: {
        name: "Paper Trail",
        condition: "Attach a file to a contact.",
        learnMore:
          "Clip a menu, a contract, or a scanned card to a contact — images preview as thumbnails, and on a connected drive every file is stored as a real, previewable file.",
      },
      synced: {
        name: "Cloud Walker",
        condition: "Sync to a folder, Dropbox, or Google Drive.",
        learnMore:
          "Point the app at a local folder or connect a cloud drive and it keeps an off-device copy in sync — photos and attachments filed beside the document as real files.",
      },
      backup: {
        name: "Just in Case",
        condition: "Take a backup of your address book.",
        learnMore:
          "Download a dated .zip of the whole address book — photos and attachments included — or, on a connected drive, keep timestamped snapshots you can restore any time.",
      },
      timeTraveler: {
        name: "Time Traveler",
        condition: "Undo a change.",
      },
      autoArchive: {
        name: "Time Capsule",
        condition: "Set a contact to archive itself on a date.",
        learnMore:
          "Give a contact a date and it files itself away — archived or deleted — when the day arrives, handy for someone you only need around for a while.",
      },
      exporter: {
        name: "Emigrant",
        condition: "Export your contacts.",
      },
      importer: {
        name: "Immigrant",
        condition: "Import contacts from a file.",
        learnMore:
          "Drag a .vcf straight from your phone's Contacts app onto the card — or use Import in Settings — to pour vCard, CSV, or JSON cards into the address book.",
      },
      encryption: {
        name: "Sealed",
        condition: "Encrypt your synced copy with a passphrase.",
        learnMore:
          "Wrap the cloud copy in an AES-GCM envelope keyed by a passphrase that never leaves memory — the drive holds only ciphertext.",
      },
    },
  },
  settings: {
    tabs: {
      general: "General",
      appearance: "Appearance",
      list: "List",
      format: "Format",
      storage: "Storage",
      developer: "Developer",
      logs: "Logs",
    },
    appearance: {
      backdropTitle: "Dialogs",
      backdropIntro:
        "How the page behind an open dialog looks. Adjust either and this Settings dialog previews the change against itself.",
      darknessLabel: "Backdrop dimming",
      darknessHint:
        "How far the page behind a dialog is darkened. More dimming keeps your focus on the dialog; none leaves the page in full view.",
      blurLabel: "Backdrop blur",
      blurHint:
        "How far the page behind a dialog is blurred. Off keeps it crisp.",
      levelNone: "None",
      levelSubtle: "Subtle",
      levelMedium: "Medium",
      darknessDark: "Dark",
      blurStrong: "Strong",
    },
    list: {
      intro: "How the overview List page shows each contact.",
      densityTitle: "Card size",
      densityCompact: "Compact",
      densitySpacious: "Spacious",
      densityHint:
        "Spacious rows draw a larger photo, so a contact's picture is easier to see; compact rows fit more contacts on screen.",
      contactMethodsTitle: "Contact methods",
      showPhone: "Show phone numbers",
      showPhoneHint:
        "List each contact's phone numbers under their name. Tap one to call.",
      priorityTitle: "Prefer number",
      priorityBoth: "Both",
      priorityHint:
        "Which number to show under a name. A contact with no number of the chosen type shows whatever it has — open the card if the wrong one appears.",
      showEmail: "Show email addresses",
      showEmailHint:
        "List each contact's email addresses under their name. Tap one to write.",
    },
    general: {
      intro: "General preferences for this device.",
      languageTitle: "Language",
      chooseLanguage: "Choose language",
      languageHint: "Translate the UI between English and Swedish.",
      achievementsTitle: "Achievements",
      disableAchievements: "Disable achievements",
      disableAchievementsHint:
        "Stop tracking achievements and hide the trophy button. Achievements you've already earned are kept.",
      sidebarTitle: "Sidebar",
      openSidebarWith: "Open sidebar with",
      sidebarHint:
        "Choose how to open the sidebar on this device — tap the floating button, or swipe in from the edge of the screen. Settings lives in the sidebar's footer.",
      foldersTitle: "Folders",
      folderSortLabel: "Sort folders",
      folderSortAlphabetical: "Alphabetically",
      folderSortManual: "Manually",
      folderSortHint:
        "Order the folders in the sidebar and the List either by name, or in your own order — in manual mode, drop a folder near another's top or bottom edge to reorder them. Drop it onto a folder to nest it inside as a subfolder. Folders always sit above the ungrouped contacts.",
      developerTitle: "Developer",
      developerMode: "Developer mode",
      developerModeHint:
        "Reveal the Developer tab with diagnostic tools. Stays on this device.",
      optionSwipe: "Right-swipe",
      optionButton: "Floating button",
    },
    format: {
      intro:
        "Formatting follows a country. Pick your country and phone numbers and postal codes are shown its way; the toggles fine-tune the details. These change the display only — what you typed is stored untouched.",
      previewLabel: "Sample:",
      previewOff: "Shown exactly as entered",
      countryTitle: "Country",
      countryHint:
        "Sets the style for phone numbers and postal codes. A number that carries its own country code (+1, +46) is formatted for that country automatically.",
      countryChange: "Change country",
      countryPickerTitle: "Choose country",
      countrySearch: "Search countries…",
      countryNoResults: 'No countries match "{query}"',
      phoneTitle: "Phone numbers",
      phoneEnable: "Format phone numbers",
      phoneEnableHint:
        "Group saved numbers your country's way. Off shows them exactly as typed. Editing a number always reveals what you entered.",
      phoneCountryCode: "Show country code",
      phoneCountryCodeHint: "Prefix the international calling code, like +46.",
      phoneLeadingZero: "Show leading zero",
      phoneLeadingZeroHint:
        "Show the national trunk digit — Sweden's (0) beside +46, or a plain leading 0. Ignored by countries without one.",
      postalTitle: "Postal codes",
      postalEnable: "Format postal codes",
      postalEnableHint:
        "Group postal / ZIP codes your country's way. Off shows them exactly as typed.",
      postalSpaces: "Group with spaces",
      postalSpacesHint:
        "Space the groups where the country allows it — Sweden's 123 45. Ignored where another separator is fixed.",
      dateTitle: "Date format",
      dateHint: "How the birthday date is shown.",
      country: {
        se: "Sweden",
        us: "United States",
        no: "Norway",
        dk: "Denmark",
        fi: "Finland",
        is: "Iceland",
        de: "Germany",
        gb: "United Kingdom",
        ie: "Ireland",
        fr: "France",
        nl: "Netherlands",
        be: "Belgium",
        ch: "Switzerland",
        at: "Austria",
        it: "Italy",
        es: "Spain",
        pt: "Portugal",
        lu: "Luxembourg",
        ca: "Canada",
        au: "Australia",
        nz: "New Zealand",
        jp: "Japan",
        kr: "South Korea",
        sg: "Singapore",
        cz: "Czechia",
        pl: "Poland",
        si: "Slovenia",
        ee: "Estonia",
        il: "Israel",
        gr: "Greece",
      },
      date: {
        iso: "ISO",
        us: "US",
        eu: "European",
        long: "Long",
      },
    },
    storage: {
      intro:
        "Where your contacts live. They are always saved on this device; connect a local folder or a cloud drive to keep an off-device copy in sync.",
      backendTitle: "Where your data lives",
      backendThisDevice: "This device",
      backendFolder: "Local folder",
      backendDropbox: "Dropbox",
      backendGdrive: "Google Drive",
      connect: "Connect {name}",
      connectedAs: "Connected — syncing to {name}.",
      disconnect: "Disconnect",
      folderHint:
        "Sync to a folder on this computer. Your contacts are written as a JSON document, with photos and attachments filed beside it as real image and document files — a browsable, git-trackable tree you can back up or edit with other tools.",
      folderChoose: "Choose a folder…",
      folderConnected: "Connected — syncing to a local folder.",
      folderReconnect: "Reconnect folder",
      folderReconnectNeeded:
        "This folder is no longer accessible — its permission was reset (a common browser behaviour between sessions). Reconnect to resume syncing.",
      missingKeyDropbox:
        "Dropbox sync needs a Dropbox app key baked into the build (VITE_DROPBOX_APP_KEY).",
      missingKeyGdrive:
        "Google Drive sync needs a Google OAuth client id baked into the build (VITE_GOOGLE_CLIENT_ID).",
      encryptionTitle: "Encryption at rest",
      encryptCloud: "Encrypt the cloud copy",
      encryptCloudHint:
        "Wrap the cloud backend with AES-GCM — what lands on the drive is an encrypted envelope keyed by your passphrase. The passphrase is held in memory only.",
      passphrase: "Passphrase",
      encrypt: "Set passphrase",
      encryptedUnlocked: "Encrypted — the passphrase is in memory.",
      lockedNotice:
        "The cloud copy is encrypted and the passphrase is gone after the reload. Enter it to resume syncing.",
      unlock: "Unlock",
      gateTitle: "Cloud copy is locked",
      gateHint: "Enter your passphrase to decrypt the synced document.",
      gateStatusAria: "Decrypting",
      gateDeriving: "Checking your passphrase…",
      gateDecrypting: "Decrypting your contacts…",
      gateWrong: "Wrong passphrase. Try again.",
      importTitle: "Import",
      importIntro:
        "Bring contacts in from another address book. Choose a file — or drag one straight onto the contact screen. vCard (.vcf) from iOS/Android/Outlook, an Outlook-style CSV, and the app's own JSON backup all work; several files can be imported at once.",
      importChoose: "Choose a file…",
      exportTitle: "Export",
      exportIntro:
        "Take your contacts anywhere. vCard imports directly into Outlook, iOS, and Android/Google Contacts; CSV matches Outlook's import columns; JSON is the app's own backup format.",
      exportVCard: "Export vCard (.vcf)",
      exportCsv: "Export CSV",
      exportJson: "Export JSON backup",
      exportEmpty: "Nothing to export yet — add a contact first.",
      backupsTitle: "Backups",
      backupsIntro:
        "Dated snapshots of your whole address book — every contact, folder, photo, and attachment — packed into a compressed .zip. Connect a local folder or cloud drive to keep them off-device, or download and restore one straight from disk.",
      backupsOffline:
        "Connect a local folder or a cloud drive (and turn encryption off) to keep dated backups off-device. You can still download and restore a backup from disk below.",
      backupExport: "Download backup (.zip)",
      backupImport: "Restore from file…",
    },
    backups: {
      title: "Backups",
      intro:
        "Timestamped snapshots written into your {provider} backups folder. Restoring one saves your current contacts as a safety net first.",
      backUpNow: "Back up now",
      browse: "Browse backups",
      loading: "Loading backups…",
      empty: "No backups yet — take one with “Back up now”.",
      counts: "{contacts} contacts · {folders} folders",
      download: "Download",
      delete: "Delete",
      restore: "Restore",
      restoreConfirmTitle: "Restore this backup?",
      restoreConfirmBody:
        "Your current contacts will be replaced by this snapshot. A safety-net backup of the current data is filed first, so you can roll this back.",
      deleteConfirmTitle: "Delete this backup?",
      deleteConfirmBody:
        "{name} will be permanently removed from the backups folder. This can't be undone.",
      importConfirmTitle: "Restore from this file?",
      importConfirmBody:
        "Your current contacts will be replaced by the backup you picked. If a backend is connected, a safety-net backup is filed first.",
      importConfirm: "Restore",
      imported: "Backup restored.",
      importBad: "That file isn't a contacts backup.",
      gone: "This backup is no longer on the backend.",
      error: "Backup failed: {message}",
    },
    developer: {
      intro: "Diagnostic tools. These stay on this device.",
      fakeDataTitle: "Fake data",
      fakeData: "Load fake data",
      fakeDataHint:
        "Swap your address book for a throwaway sample full of varied test contacts. It lives in memory only — nothing is saved, and reloading the page brings your real contacts back.",
      photosTitle: "Photos",
      reindexPhotos: "Reindex photos",
      reindexHint:
        "Rescan the connected drive's photos/ folder and reconnect any photo file that isn't linked to a contact — recovering lost photos, and adopting images you dropped in yourself under the photos/<name>-<contactId>-<photoId>.jpg pattern. Watch the Logs tab for the per-file detail.",
      reindexDone: "Reconnected {reconnected} photo(s); {total} now linked.",
      reindexNoBackend:
        "Connect a local folder, Dropbox, or Google Drive first — there are no photo files to reindex without one.",
      reindexEncrypted:
        "The cloud copy is encrypted, so photos live inside the envelope, not as separate files — there's nothing to reindex.",
      reindexEmpty: "The backend holds no document yet.",
      reindexError: "Reindex failed — see the Logs tab for details.",
      loggingTitle: "Logging",
      captureLogs: "Capture logs",
      captureLogsHint:
        "Record diagnostic log lines so the Logs tab can show them.",
      buildTitle: "Build",
      buildLabel: "build",
      commitLabel: "commit",
      modeLabel: "mode",
      displayLabel: "display",
      installedPwa: "installed PWA (standalone)",
      browserTab: "browser tab",
    },
    logs: {
      intro:
        "The in-app log buffer, rendered live from the framework's logging module.",
      logsTitle: "Logs",
    },
  },
} as const;

// The catalog shape every language must satisfy. `Widen` relaxes each leaf
// from its English literal to plain `string` so a translation can differ.
export type Catalog = Widen<typeof en>;
