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
| Deadline is a whole day | `false` for a date and time, `true` for a date with no time |

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

## A date with no time

A canvas app cannot tell the control whether a value is a moment or a day. It
describes every date the same way, whatever column or formula it came from, so
**you say which it is**:

| The deadline | Deadline is a whole day | What it shows |
| --- | --- | --- |
| A date and time (`'Resolve By'`, `Now()`, `DateAdd(...)`) | `false` | A countdown to that moment |
| A date only (`'Due date'`, `Today()`, a date picker) | `true` | Whole days: "today" all day on the due day, overdue from the midnight that ends it |

Left at `false`, a date-only value is counted down to the midnight that
*starts* its day, and reads as overdue all through the day it is due.

On a model-driven form the property does nothing: the column says what it
holds, and the control follows the column.

:::callout{type=warning}
**Before 0.3.0 every canvas countdown was off by your offset from UTC.** The
control read a canvas value the way it reads a time-zone-independent column,
which a canvas value is not. Six hours west of UTC, a deadline thirty minutes
away read "in 6 hours". If you corrected for that in a formula, remove the
correction when you update. See [Migration](migration.md).
:::

:::callout{type=info}
A canvas app also publishes no theme. The control's colours then come from its
own Fluent light-theme fallbacks rather than from the app's — the same set the
component's demo on this site uses.
:::
