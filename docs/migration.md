---
title: Migrating to 0.2.0
description: What changed, and what a maker has to do about it.
appliesTo: ">=0.2.0"
order: 9
---

# Migrating to 0.2.0

## What changed

Nothing breaks, and nothing has to be reconfigured: the properties are the same
and every column 0.1.0 could bind still binds. What changes is **what two kinds
of column show**, because 0.1.0 read them from the wrong half of the value.

| The column | 0.1.0 showed | 0.2.0 shows |
| --- | --- | --- |
| Date and Time, **User local** | The right countdown | The same |
| Date and Time, **Time-zone independent** | A countdown off by your offset from UTC | The countdown to the time on the wall clock |
| **Date only** (bound by force) | One day early, west of UTC | Whole days, right in every time zone |

A date-only column is also new as a supported binding. 0.1.0 declared
`DateAndTime.DateAndTime` alone, so the form designer did not offer the control
for one; 0.2.0 declares both formats.

## What to do

:::steps
1. Import 0.2.0 over 0.1.0. It upgrades in place.
2. If a time-zone-independent column is bound, expect its countdown to move by
   your offset from UTC. The new value is the correct one.
3. If you bound a date-only column by editing the form XML, nothing needs
   undoing: the binding is now a supported one, and the count is right.
:::

:::callout{type=info}
A date-only deadline is counted in whole days — "today" all day on the due day,
overdue from the midnight that ends it — and is **Due soon** throughout the due
day whatever the warning threshold. See [Model-driven](model-driven.md).
:::
