---
title: FAQ
description: Questions that come up more than once.
order: 8
---

# FAQ

## Why does the control not appear in the component list?

The column is not a Date and Time column. The control binds
`DateAndTime.DateAndTime` and the form designer only offers a component whose
bound type matches — so on a Text or Whole Number column it is simply absent
rather than greyed out.

For canvas apps, the other usual cause is **Code components for canvas apps**
being switched off in the environment's feature settings.

## Can it write back, or trigger a flow when a deadline passes?

No. See [Limitations](limitations.md) — it renders a column and never modifies
one, and it raises no event. A business rule or a scheduled flow comparing the
column to the current time is the right tool for acting on a deadline; this
control is for showing a person where they stand.

## Does it work offline / on mobile / in a phone layout?

Yes to all three. The control makes no network call of any kind, so offline
changes nothing about it, and it renders as text in a standard field surface
that reflows in a phone layout without configuration.

## The countdown says "in 2 days" but the deadline is 3 days away

It should not, and that is the specific bug this control was written to avoid.
If you can reproduce it, please open an issue with your timezone — the failure
mode it is guarding against only appears in zones that observe daylight saving,
and only for spans that cross a boundary.

## Why is the number not announced by my screen reader?

Deliberately. The readout is a `role="timer"`, which is a live region that does
not announce its own changes — a number read aloud once a second would make the
rest of the form unusable. What *is* announced is the transition between **On
track**, **Due soon** and **Overdue**, politely, at the moment it happens.

## Can I change the colours?

Not through a property. The control reads Fluent's design tokens from the app it
is on, so it already follows the app's theme, its brand colour and its dark
mode. The three state colours come from Fluent's own palette tokens
(`colorPaletteGreenForeground1`, `colorPaletteDarkOrangeForeground1`,
`colorPaletteRedForeground1`), which means an app that themes those gets themed
states for free.

## How do I report a bug?

Open an issue at <https://github.com/pcfhub/pcf-sla-timer/issues>, with the
platform version, the control version from the solution, and — for anything to
do with the numbers — the user's timezone and language.
