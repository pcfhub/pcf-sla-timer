---
title: Model-driven apps
description: Adding SLA Timer to a form.
order: 4
---

# Using it on a model-driven form

:::steps
1. Open the form in the modern form designer.
2. Select the **Date and Time** column the countdown should run to.
3. Under **Components → Add component**, choose **SLA Timer**.
4. Set **Warning threshold (minutes)** and **Display**, or leave the defaults.
5. Enable it for **Web**, **Phone** and **Tablet** as appropriate.
6. Save and publish.
:::

## Column types

The bound property is `DateAndTime.DateAndTime`, so the component appears for:

| Column | Behaviour | Notes |
| --- | --- | --- |
| Date and Time, **User local** | Supported | The usual case for a deadline |
| Date and Time, **Time-zone independent** | Supported | |
| Date and Time, **Date only** | Supported | The deadline is midnight local, and the countdown says so |
| Date only (no time) | Supported | Same as above |

It does not offer itself for a Whole Number, Text or Choice column, and there is
no configuration that would make it — the countdown needs a moment to count to.

:::callout{type=info}
The control shows the maker's own label for the field as its accessible name,
so whatever the column is called on **this** form is what a screen reader
announces. Nothing has to be configured for that.
:::

## What it does with the form's other states

- **Field-level security.** A user without read access on the column sees "You
  do not have access to this value" rather than an empty timer. The two are the
  same `null` underneath, and telling them apart is the point.
- **Read-only forms.** Nothing changes. There is nothing to disable, because
  there is nothing to type into — the control is display-only whatever the
  form's state.
- **Business rules.** A validation error on the column is shown under the
  control and colours its border, the same as the built-in field would.
- **An empty column.** Shows "No deadline set" and stops the clock.

Past the deadline, on a form:

::image{src=media/time-remaining-overdue.png alt="The SLA field reading: Overdue, 14 hours ago"}

The state is a word as well as a colour, so it still reads in high-contrast mode
and to anyone who cannot separate the three hues.

## Performance on a form with many of them

Safe. Each control repaints itself on a timer, but the timer slows to one tick
every thirty seconds as soon as more than an hour is left, and stops entirely
while the browser tab is in the background. None of them calls
`notifyOutputChanged`, so the form's rules and calculated fields are not
re-evaluated by the passage of time.
