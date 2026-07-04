---
type: Added
title: A website field and a company switch
---

Contacts gained a **Website** field — add a homepage and it shows as a
tap-to-open link on the card, and exports as the vCard `URL` so other address
books pick it up.

A new **This is a company** switch (in a card's edit view) turns a person card
into a **company** card: it's identified by a single company name instead of a
first and last name, wears a building icon in place of a monogram, and exports
as an organisation (`X-ABShowAs:COMPANY`) so it lands as a company — not
"Firstname Lastname" — in the address book you send it to.
