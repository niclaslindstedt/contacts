// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The English achievements copy — the tour, the unlock celebration, the trophy
// button, every trophy's name and condition, and the switch in Settings.
//
// It lives apart from `./en.ts` because only the website carries achievements
// (`../achievementsGate.ts`): `./index.ts` joins it onto the catalog under
// `achievements.*` in a website build and leaves it out of the phone and
// desktop builds, so none of these words reach those bundles.

import type { Widen } from "@niclaslindstedt/oss-framework/i18n";

export const enAchievements = {
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
    backtracker: {
      name: "Backtracker",
      condition: "Step back to an earlier contact with the Back button.",
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
      condition: "Give a contact an icon or color.",
    },
    attachment: {
      name: "Paper Trail",
      condition: "Attach a file to a contact.",
      learnMore:
        "Clip a menu, a contract, or a scanned card to a contact — images preview as thumbnails, and on a connected drive every file is stored as a real, previewable file.",
    },
    synced: {
      name: "Cloud Walker",
      condition: "Sync to a folder, Dropbox,.",
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
  // Settings → General's switch that turns achievements off (website only).
  settings: {
    title: "Achievements",
    disable: "Disable achievements",
    disableHint:
      "Stop tracking achievements and hide the trophy button. Achievements you've already earned are kept.",
  },
} as const;

// The shape the Swedish copy must satisfy.
export type AchievementsCopy = Widen<typeof enAchievements>;
