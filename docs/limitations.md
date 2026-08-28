---
title: Limitations
description: What SLA Timer does not do.
order: 7
---

# Limitations

Each of these is a constraint that was chosen, not a defect waiting on a fix.

- **It displays; it never writes.** There is no output property and no event, so
  a flow cannot be triggered from the moment a deadline passes, and a form
  cannot branch on the control's state. Compare the dates in a business rule or
  in Power Fx for that — the control is a rendering of a column, not a source
  of truth about it.

- **It counts to one moment, not through a process.** Bound to a deadline, it
  answers "how far away is that". It has no concept of a clock that starts, or
  of an SLA being paused while a case is on hold: a paused case shows its
  deadline approaching regardless. Modelling pause states would mean a second
  bound column and a different control.

- **The clock stops while the tab is in the background.** This is intentional —
  a hidden tab has nothing to show, and running a one-second interval in it is
  work nobody sees. The readout is refreshed the moment the tab is brought
  forward, so the only observable effect is that a background tab is not doing
  arithmetic.

- **It does not schedule around the deadline.** Nothing fires *at* the moment a
  deadline passes; the state changes on the next tick, which is within a second
  when the deadline is close and within thirty seconds when it is not. In
  practice the fast cadence is already running well before any deadline
  arrives.

- **Five languages, then English.** The `.resx` ship English, Spanish, French,
  German and Japanese. A user provisioned in any other language sees English
  strings *and* English phrasing — the relative wording follows the same
  language ID as the rest.

- **The demo on this page cannot show a live threshold crossing.** Demo presets
  are static JSON, so a date chosen to be "twenty minutes away" stops being that
  the moment it is written. The **Due soon** preset gets into the warning band
  honestly, by pairing a distant deadline with a very large warning threshold,
  but watching the state change arrive in real time needs the control on a form.

- **No sub-second display.** The finest granularity is one second, and the
  fastest repaint is one per second. A stopwatch this is not.
