// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The Swedish achievements copy — website only, like the English
// (`./enAchievements.ts`); code-split with the Swedish catalog.

import type { AchievementsCopy } from "./enAchievements.ts";

export const svAchievements: AchievementsCopy = {
  modal: {
    title: "Utmärkelser",
    intro:
      "Varje funktion är en trofé. Arbeta dig ner genom nivåerna och lås upp dem genom att använda appen.",
    locked: "Låst",
    learnMore: "Läs mer",
    close: "Stäng",
    counter: "{unlocked} av {total} upplåsta",
    tierPoints: "{earned} / {max} p",
    tier: {
      beginner: {
        title: "Nybörjare",
        subtitle: "De första stegen varje adressbok tar.",
      },
      intermediate: {
        title: "Van",
        subtitle: "Forma boken efter ett verkligt liv.",
      },
      pro: {
        title: "Proffs",
        subtitle: "Låt appen sköta städningen åt dig.",
      },
      expert: {
        title: "Expert",
        subtitle: "Böj den efter dina egna specialfall.",
      },
    },
  },
  unlock: {
    titleOne: "Utmärkelse upplåst",
    titleOther: "{n} utmärkelser upplåsta",
    dismiss: "Snyggt",
    close: "Stäng",
  },
  trophy: {
    open: "Utmärkelser",
    unseen: "{n} nya",
  },
  catalog: {
    firstContact: {
      name: "Första kontakten",
      condition: "Namnge din första kontakt.",
      learnMore:
        "Tryck på Ny, skriv ett namn och tryck på Enter. Det enda kortet är kärnan som hela appen byggts kring.",
    },
    wellConnected: {
      name: "Väl förbunden",
      condition: "Ge en kontakt både ett telefonnummer och en e-postadress.",
    },
    collector: {
      name: "Samlare",
      condition: "Ha fem eller fler kontakter.",
    },
    filingSystem: {
      name: "Ordningsmänniska",
      condition: "Skapa en mapp.",
    },
    subfolder: {
      name: "Lådor i lådor",
      condition: "Lägg en mapp inuti en annan.",
      learnMore:
        "Dra en mapp till en annan för att lägga den inuti — mappar kan kapslas hur djupt som helst, och att arkivera eller flytta en mapp tar med hela underträdet.",
    },
    seeker: {
      name: "Sökaren",
      condition: "Sök bland dina kontakter.",
    },
    backtracker: {
      name: "Bakåtsträvaren",
      condition: "Gå tillbaka till en tidigare kontakt med bakåtknappen.",
    },
    birthday: {
      name: "Grattis på dagen",
      condition: "Lägg till en kontakts födelsedag.",
    },
    importantDate: {
      name: "Att minnas",
      condition: "Lägg till ett viktigt datum utöver födelsedagen.",
    },
    address: {
      name: "Du är här",
      condition: "Lägg till en postadress till en kontakt.",
    },
    favorite: {
      name: "Hjärtefråga",
      condition: "Stjärnmärk en kontakt som favorit.",
      learnMore:
        "Tryck på hjärtat på ett kort eller en listrad så hamnar kontakten på din Favoriter-sida — en handordnad kortlista med personerna du oftast söker.",
    },
    emergency: {
      name: "I nödfall",
      condition: "Flagga en kontakt för nödsituationer.",
    },
    company: {
      name: "Bolagiserad",
      condition: "Gör ett kort till en företagskontakt.",
    },
    archivist: {
      name: "Kylförvaring",
      condition: "Arkivera en kontakt.",
    },
    namespaces: {
      name: "Dubbelliv",
      condition: "Skapa en andra adressbok.",
      learnMore:
        "Namnrymder är helt separata adressböcker — en för jobbet, en för livet — som du växlar mellan och flyttar kontakter emellan från sidomenyn.",
    },
    photogenic: {
      name: "Fotogenisk",
      condition: "Ge en kontakt ett foto.",
      learnMore:
        "Öppna kortets avatar i rubriken och ladda upp en bild — den visas i sidomenyn och följer med i vCard-exporter.",
    },
    gallery: {
      name: "Perfekt bild",
      condition: "Ge en och samma kontakt fler än ett foto.",
    },
    madeItYours: {
      name: "Personlig prägel",
      condition: "Ge en kontakt en ikon eller färg.",
    },
    attachment: {
      name: "Pappersspår",
      condition: "Bifoga en fil till en kontakt.",
      learnMore:
        "Fäst en meny, ett avtal eller ett inskannat visitkort på en kontakt — bilder förhandsvisas som miniatyrer, och på en ansluten enhet sparas varje fil som en riktig, förhandsvisningsbar fil.",
    },
    synced: {
      name: "Molnvandrare",
      condition: "Synka till en mapp, Dropbox eller Dropbox.",
      learnMore:
        "Peka appen mot en lokal mapp eller anslut en molnenhet så håller den en kopia synkad utanför enheten — foton och bilagor sparas bredvid dokumentet som riktiga filer.",
    },
    backup: {
      name: "För säkerhets skull",
      condition: "Ta en säkerhetskopia av din adressbok.",
      learnMore:
        "Ladda ner en daterad .zip av hela adressboken — foton och bilagor inkluderade — eller behåll tidsstämplade ögonblicksbilder på en ansluten enhet som du kan återställa när som helst.",
    },
    timeTraveler: {
      name: "Tidsresenär",
      condition: "Ångra en ändring.",
    },
    autoArchive: {
      name: "Tidskapsel",
      condition: "Ställ in en kontakt att arkivera sig själv ett visst datum.",
      learnMore:
        "Ge en kontakt ett datum så arkiverar den sig själv — arkiveras eller raderas — när dagen kommer, praktiskt för någon du bara behöver ha en tid.",
    },
    exporter: {
      name: "Emigrant",
      condition: "Exportera dina kontakter.",
    },
    importer: {
      name: "Immigrant",
      condition: "Importera kontakter från en fil.",
      learnMore:
        "Dra en .vcf direkt från telefonens Kontakter-app till kortet — eller använd Importera i Inställningar — för att ösa in vCard-, CSV- eller JSON-kort i adressboken.",
    },
    encryption: {
      name: "Förseglad",
      condition: "Kryptera din synkade kopia med en lösenfras.",
      learnMore:
        "Slå in molnkopian i ett AES-GCM-kuvert med en lösenfras som aldrig lämnar minnet — enheten lagrar bara chiffertext.",
    },
  },
  // Settings → General's switch that turns achievements off (website only).
  settings: {
    title: "Prestationer",
    disable: "Inaktivera prestationer",
    disableHint:
      "Sluta spåra prestationer och dölj trofé-knappen. Prestationer du redan tjänat in behålls.",
  },
};
