---
type: Added
title: Private/work types, multiple titled addresses, and important dates
---

Contact cards gained three related pieces of structure. Every **phone number and
email address now carries a type** — Private or Work — chosen from a small
dropdown in edit mode and shown as the row's label in read mode. A card can hold
**more than one postal address**, each with a free-text **title** (a home, a
cabin, a workplace; the field defaults to the "Home" placeholder). And beyond the
birthday you can add any number of **important dates** — a name day, an
anniversary — each with a free-text occasion and a date that's either a full date
or **day and month only** (leave the year blank). Like the birthday, each
important date shows a countdown chip; tapping it hands a yearly reminder to your
calendar, titled with the occasion and the contact's name (e.g. "Anniversary
Sarah Connor"). Existing single addresses are carried forward automatically. On
export, the types map onto the standard vCard `TEL`/`EMAIL`/`ADR` TYPEs and
full-date important dates ride as grouped `X-ABDATE` items; the JSON backup keeps
everything at full fidelity.
