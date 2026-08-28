---
title: Overview
description: What SLA Timer does, and when to reach for it.
order: 1
---

# SLA Timer

A live countdown to a deadline column, with warning and overdue states.

## Why this one

A date column renders as a date. That is the right answer for a date of birth
and the wrong one for a deadline, where the number a person is actually reading
off the form is the *distance* from now — and that number changes while they
look at it.

SLA Timer binds the same column and renders the distance instead:

- **in 3 days**, **in 42 minutes**, **2 hours ago** — phrased in the user's own
  Dataverse language, with that language's plural rules.
- Beside it, a state: **On track**, **Due soon**, or **Overdue**. The state is
  a word, not only a colour, so it survives high-contrast mode and readers who
  cannot separate green from red.
- It keeps counting. Under an hour it repaints every second; above that, every
  thirty seconds; while the browser tab is in the background, not at all.

It is display-only. The bound column is read and never written, so putting this
on a form cannot change data — and the control never calls
`notifyOutputChanged`, so its ticking does not make the form re-run its business
rules once a second.

## What it works with

:::callout{type=info}
**Model-driven forms and canvas apps both.** On a model-driven form it binds a
Date and Time column directly. In a canvas app it takes a date from a formula.
There is nothing model-driven-only in it — no Web API call, no lookup, no
metadata it cannot do without — so the canvas story is the full one rather than
a degraded version.
:::

The control asks for **no permissions**. It declares no `uses-feature` entries
because it calls neither Web API, Utility nor Device, so importing it raises no
consent prompt for the maker.

## Two things it gets right that are easy to get wrong

**Days are counted, not divided.** The obvious way to find the days between two
dates is to subtract them and divide by 86,400,000. That is an hour out across
every daylight-saving boundary — enough to render *in 2 days* for a deadline
three calendar days away. This control builds a day number from local date
components, so it counts midnights.

**The countdown is not announced.** A live region that reads a changing number
to a screen reader once a second makes the rest of the form unusable. The
readout is a `role="timer"`, which is a live region that stays quiet; only the
*transition* between states is announced, and only when it happens.
