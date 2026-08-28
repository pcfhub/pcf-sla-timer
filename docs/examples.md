---
title: Examples
description: Worked configurations of SLA Timer.
order: 6
---

# Examples

## A case resolution SLA

The goal: on the Case form, show how long is left to resolve, and turn the
display amber for the last hour.

| Property | Value |
| --- | --- |
| Bound column | **Resolve By** (Date and Time, User local) |
| Warning threshold (minutes) | `60` |
| Display | Time remaining |

That is the whole configuration. The control reads the column, renders *in 3
days*, and moves through *Due soon* into *Overdue* on its own while the form
stays open.

::image{src=media/time-remaining.png alt="The SLA field reading: On track, in 3 days"}

## A first-response clock, counting up

The goal: on a triage view, show how long a ticket has been waiting past its
first-response target, as a running duration rather than a phrase.

| Property | Value |
| --- | --- |
| Bound column | **First Response By** |
| Warning threshold (minutes) | `15` |
| Display | Time elapsed |

`elapsed` renders the size of the gap as digits — `04:12:30`, or `3 d 04:12:30`
past a day — and keeps the seconds moving. It is the right choice when someone
is watching the number rather than reading it once.

::image{src=media/time-elapsed.png alt="The SLA field reading: On track, 3 days 03:28:46"}

:::callout{type=info}
The two displays measure the same gap and differ only in how they say it.
`remaining` answers "how far away is it" in calendar terms, so it counts
midnights; `elapsed` answers "how much time is that" and measures hours. Across
a daylight-saving boundary the two legitimately disagree by an hour, and both
are correct.
:::

## A canvas gallery of overdue work

The goal: a list of active cases with a countdown on each row.

```powerfx
// Gallery Items
SortByColumns(
    Filter(Cases, Status = "Active" && !IsBlank('Resolve By')),
    "resolveby",
    SortOrder.Ascending
)
```

| Property | Value |
| --- | --- |
| Deadline | `ThisItem.'Resolve By'` |
| Warning threshold (minutes) | `120` |
| Display | `"remaining"` |

The `!IsBlank` in the filter is optional — a row with no deadline renders "No
deadline set" rather than breaking — but a list of deadlines reads better
without the rows that have none.
