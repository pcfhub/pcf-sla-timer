---
title: Canvas apps
description: Adding SLA Timer to a canvas app or custom page.
order: 3
---

# Using it in a canvas app

:::steps
1. From **Insert → Get more components**, open the **Code** tab and import
   **SLA Timer**.
2. Place it from **Insert → Code components**.
3. Bind the properties below.
:::

## Wiring the properties

| Property | Value |
| --- | --- |
| Deadline | `ThisItem.'Resolve By'` |
| Warning threshold (minutes) | `60` |
| Display | `"remaining"` |

In a gallery over cases, that is the whole configuration:

```powerfx
// On the gallery's Items
Filter(Cases, Status = "Active")
```

For a single record on a form, take the date from the form's item rather than
from a variable, so the control follows the record the user selected:

```powerfx
// Deadline
EditForm1.LastSubmit.'Resolve By'
```

## Reading the output

There is nothing to read. **SLA Timer writes nothing back** — the bound column
is displayed and never modified, and the control raises no event. If a canvas
app needs to branch on whether something is overdue, compare the dates in Power
Fx directly; the control's job is showing a person the gap, not computing it for
a formula:

```powerfx
If(ThisItem.'Resolve By' < Now(), "Overdue", "On track")
```

## What a canvas app does not supply

A canvas app publishes no column metadata, which for this control means one
thing: `Behavior` — the flag saying whether the column is stored as UTC, as a
date only, or as a timezone-independent value — is unavailable. The control
assumes **UserLocal**, which is what the platform assumes for a date a canvas
formula produced.

The only consequence is the tooltip, where the absolute deadline is formatted.
The countdown itself does not branch on `Behavior` at all: every behaviour hands
over a date whose local components are the moment the user means.

:::callout{type=info}
A canvas app also publishes no theme. The control's colours then come from its
own Fluent light-theme fallbacks rather than from the app's — the same set the
component's demo on this site uses.
:::
