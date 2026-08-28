---
title: API reference
description: Properties and outputs, generated from the control manifest.
order: 5
---

# API reference

## Input properties

::props-table{kind=input}

## Bound properties

::props-table{kind=bound}

## Outputs

**There are none, and that is deliberate.** `getOutputs()` returns an empty
object on every render, which the platform reads as "no change" — a true
statement about a control that displays a deadline and never edits it. The bound
`deadline` column is therefore safe from this control: it cannot be overwritten
by placing the component on a form.

## Notes

**`display`** accepts exactly two values:

| Value | Renders |
| --- | --- |
| `remaining` | Words, in the user's language: *in 3 days*, *42 minutes ago* |
| `elapsed` | A digital readout of the gap's size: `3 d 04:12:30` |

The same overdue deadline, said both ways — fourteen and a half hours past:

::image{src=media/time-remaining-overdue.png alt="Overdue, 14 hours ago"}

::image{src=media/time-elapsed-overdue.png alt="Overdue, 14:33:40"}

`remaining` rounds to the unit a person would say out loud; `elapsed` keeps the
seconds moving. Pick the first for a form somebody reads, the second for a
screen somebody watches.

Anything else is treated as `remaining`. This matters in a canvas app, where a
formula can supply a string the manifest's enumeration does not list.

**`warningMinutes`** is clamped at zero and falls back to 60 when it is empty or
not a number. Setting it to `0` means the control never shows *Due soon* — it
goes straight from *On track* to *Overdue* at the deadline.

**States** are decided by the gap, and the thresholds are inclusive at the
boundary:

| Gap | State |
| --- | --- |
| More than `warningMinutes` remain | On track |
| `warningMinutes` or fewer remain, deadline not yet reached | Due soon |
| The deadline has been reached or passed | Overdue |

**Languages.** The `.resx` ship 1033 English, 3082 Spanish, 1036 French, 1031
German and 1041 Japanese. The relative phrasing itself is produced by
`Intl.RelativeTimeFormat` from `userSettings.languageId`, so its plural rules
follow the user's provisioned language; a language with no `.resx` here falls
back to English for both.
