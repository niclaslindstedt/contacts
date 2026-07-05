# Addresses

A contact's postal address is three fields — **street**, **postal code**, and
**city** — rather than one free-form box, so it reads as a proper address and
exports into the right vCard `ADR` and CSV columns. Existing free-form addresses
are split into the new fields automatically on upgrade.

## Several titled addresses

A card can hold **more than one** address — a home, a cabin, a workplace. Each
carries a free-text **Title** (defaulting to the "Home" placeholder) above its
street / postal code / city fields, and each exports as its own `ADR` line typed
from that title.

## Tap to map

In read mode every address is a **link**: tapping it hands the address to your
maps app (or opens Google Maps in the browser), so a saved address is one tap
from directions. How the postal code itself is displayed follows your
[format settings](feature:formats).
