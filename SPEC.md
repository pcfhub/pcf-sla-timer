# SLA Timer

A live countdown to a deadline column, with warning and overdue states.

Scaffolded from `_template` as a standard field control (no flags), built and
verified against `npm run smoke`, `dev/harness.html` and `npm start`. This is
the first control in the house that owns a timer, so most of what follows is
about lifetime rather than about dates.

## What the build disagreed with

**`ComponentFramework.PropertyHelper.types` does not exist.** The draft cast
`attributes?.Behavior` to
`ComponentFramework.PropertyHelper.types.DateTimeFieldBehavior`, which `tsc`
rejected with "Did you mean 'Types'?" — and following the suggestion would have
been the wrong fix. The real path is
`ComponentFramework.FormattingApi.Types.DateTimeFieldBehavior`
(componentframework.d.ts:1452), but `attributes.Behavior` is *already declared
as that type* (:2472), so `parameter.attributes?.Behavior ?? 1` types cleanly
with no cast at all. The cast was hiding the fact that the fallback is inside
the union.

**A piped build reports the wrong exit code.** `npm run build 2>&1 | tail -40`
exits with `tail`'s status, so a failed compile came back as `0` and the stale
bundle from the previous run was still on disk — which then failed in
`npm run smoke` as "bundle registered a control: FAIL", pointing at the wrong
thing entirely. Redirect to a file and check `$?`, or do not pipe.

## Platform behaviour worth knowing

**`Behavior` changes the tooltip and nothing else** — confirmed by an assertion
rather than assumed. `dev/smoke.js` mounts the same deadline with `Behavior: 1`
and `Behavior: 2` and asserts the countdown text is identical while the
`formatTime` output differs. This is the skill's existing claim ("all three
named behaviours hand over a Date whose local components are the calendar date
the user means") turned into something that fails if it stops being true.

**The daylight-saving bug has two sides, and only one of them is a bug.** The
skill documents `(b - a) / 86400000` as wrong for counting days. Building this
made the other half explicit: the `elapsed` readout *should* divide, because it
answers a different question. Across 7–10 March 2026 in `America/New_York`,
`remaining` renders **in 3 days** (three midnights) and `elapsed` renders
**2 days 23:00:00** (seventy-one hours). Both are correct, and a control that
made them agree would have one of them wrong. Verified by running
`node dev/smoke.js` with `TZ=America/New_York`; in a zone with no DST on those
dates the naive implementation passes too, which is exactly why the assertion
carries a detail line saying so.

**Months and years have no division to get wrong at all.** Once the day branch
counts midnights, the natural extension is `magnitude / (30 * DAY)` — and a
month is not a fixed number of milliseconds. Subtracting the two dates' own
`getMonth()` and `getFullYear()` is the exact answer, not an approximation of
one.

## The lifetime, which is the new part

Everything below is general rather than specific to SLAs, so it went into the
skill as **Timers and teardown** in `references/control-patterns.md` — see
*Promoting a finding*. Two things stay here because they are about this
repository:

**The harness could not express any of it.** `dev/dom.js` gave `document` no
event API, so `document.addEventListener('visibilitychange', …)` threw before
the first assertion ran, and there was no way to move a clock. Both were fixed
in this repository first and then backported: `dev/clock.js` (new) and the
`document` event methods in `dev/dom.js`.

**`dev/smoke.js` had never called `destroy()`.** No control in the house had
its teardown asserted, because `mount()` had no way to unmount. The generic
version — count timers and document listeners before `init`, compare after
`destroy()` — is now in `_template`, and it needs no knowledge of what a control
took.

**A test suite that leaks is not entitled to assert teardown.** The first
working draft of the suite mounted twenty controls and destroyed none, so every
later `time.pending()` counted the abandoned ones and one `visibilitychange`
dispatch reached all of them — four assertions failed for reasons that were
about the harness. `mount()` now registers in a `live` list and `at()` disposes
across every time-frame boundary. The failure was worth having: it is the same
leak the control is written to avoid, reproduced accidentally one file away.

## Two decisions that look wrong

**`getOutputs()` returns `{}`.** The template's standing lesson is that
`undefined` means "no change" and is the bug that made `pcf-star-rating`'s clear
button do nothing. Here it is correct: the control reads the deadline and never
writes it, so "no change" is a true statement about every render, and returning
anything would be volunteering to overwrite a column it was only asked to
display. Same mechanism, opposite conclusion, decided by whether the control
writes.

**The relative phrasing is not in the `.resx`.** This narrows the template's
rule that everything a user can read belongs in a resource file. Plurals differ
across the five languages shipped — Japanese has no plural form, and German,
French and Spanish disagree with English on when the form changes — and a
`.resx` holds one string per key. `Intl.RelativeTimeFormat`, seeded from
`userSettings.languageId` (not `navigator.language`, which is a different
setting that frequently disagrees), carries the CLDR rules for all five. Every
other user-visible string is in the `.resx` as usual.

The cost is real and worth stating: a translator cannot adjust the phrasing, and
a language with no `.resx` here gets English strings *and* English phrasing
rather than one of each. The alternative was a plural rule per language living
in `index.ts`, which is worse.

## Accessibility

**`role="timer"` is a live region whose implicit `aria-live` is `off`.** That is
the whole reason to use it: the element is identified as a timer and nothing is
announced as it counts. `aria-live="polite"` on the readout is the obvious
wiring and it reads the countdown aloud once a second. What is announced is the
*transition* between states, through a separate visually-hidden polite region,
and not on the first paint — a control appearing on a form is not a change to
anything.

The state is also a **word** and not only a colour, which is what makes it
survive `forced-colors: active`, where all three hues collapse to `CanvasText`.

## Styling

The scaffolded stylesheet is Fluent's `filled-darker` Input, and roughly half of
it was deleted rather than adapted: the hover, the `:focus-within` underline and
the disabled surface all describe affordances this control does not have.
Nothing inside the box can be focused, so a `:focus-within` rule there is dead
CSS that the build would never have mentioned. The fill, the radius and the 32px
height stay, because they are what makes the control line up with the fields
above and below it on a form.

`flex: 1 1 auto` on the readout — inherited from the scaffolded input — put the
number at the far right of a full-width form, an arm's length from the state
label describing it. Invisible in `dev/harness.html`, where the container is
narrow; obvious the moment `npm start` rendered it at form width. `0 1 auto`.

## Demo

`full`. The control reaches nothing the hub's harness cannot supply: no Web API
call, no device, no navigation, and no `uses-feature` entry in the manifest to
suggest otherwise. It needs a date, a clock and a locale.

The constraint is the presets, not the fidelity. Presets are static JSON, so a
date chosen to be "twenty minutes away" stops being that immediately. **Due
soon** therefore reaches the warning band by pairing a distant deadline with a
very large `warningMinutes` — real properties, no faked clock — rather than by
shipping a date that will be wrong next week. Noted in `docs/limitations.md` so
a reader is not left wondering.

## Not verified

- **No model-driven form has run this.** Everything about `Behavior`,
  `security.readable`, `mode.label` and the platform's own `formatting` output
  comes from the type definitions and from `dev/host.js` standing in for them.
  What would prove it: import the managed solution and put the control on a Case
  form with a secured `Resolve By` column.
- **`visibilitychange` is dispatched by this suite, not by a browser.** The
  control's response to it is asserted; that the browser fires it when a
  model-driven app is in a background tab is not. It was watched by hand in
  `dev/harness.html`, which is a browser but not a form.
- **The announcement has not been heard.** That the polite region carries the
  right text at the right moment is asserted; that a screen reader announces it,
  and that `role="timer"` stays quiet in NVDA and JAWS as the specification
  says, has not been tested with one.
- **The solution has not been packed.** `msbuild` was not run here, so the
  production-mode bundle is unproven — a green `npm run build` is development
  mode. CI does this on the first tag.

## Promoting a finding

**Timers and teardown** — interval ownership across `init`/`destroy`, never
arming from `updateView`, adaptive cadence, pausing while hidden, and why a tick
must not call `notifyOutputChanged` — went to
`references/control-patterns.md` in the skill, along with the `role="timer"`
note under *Accessibility*. The harness pieces went to `_template`: `dev/clock.js`,
the `document` event methods in `dev/dom.js`, and the destroy-leak assertion in
`dev/smoke.js`.

## What went back into `_template`

- **`dev/clock.js`**, new — a fake clock installed on the global before the
  bundle is evaluated, with `advance`, `pending` and `restore`. No injectable
  clock parameter, so no production code bent to suit a harness.
- **`dev/dom.js`** — `document` gains `addEventListener`, `removeEventListener`,
  `dispatchEvent` and `hidden`. The stub was *less* capable than the platform
  here, which is the direction the file's own header says to fix.
- **`dev/smoke.js`** — `mount()` returns a `destroy()`, tracks live mounts, and
  ships a generic teardown assertion: every timer and document listener taken in
  `init` is released in `destroy`.
- A duplicated clause in `dev/smoke.js`'s resize comment ("so this asserts the
  scaffolded control reflows on neither, so all this can honestly assert"), which
  had been copied into all thirteen repositories.
