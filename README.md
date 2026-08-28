# SLA Timer

A live countdown to a deadline column, with warning and overdue states.

[![Build](https://github.com/pcfhub/pcf-sla-timer/actions/workflows/build.yml/badge.svg)](https://github.com/pcfhub/pcf-sla-timer/actions/workflows/build.yml)
[![Release](https://github.com/pcfhub/pcf-sla-timer/actions/workflows/release.yml/badge.svg)](https://github.com/pcfhub/pcf-sla-timer/actions/workflows/release.yml)

Documentation lives on [PCFHub](https://pcfhub.dev/components/pcf-sla-timer), built
from the `docs/` directory in this repository. Edit the Markdown here; the hub
recompiles it.

## What it does

A model-driven form shows a date column as a date. On anything with a deadline —
a case that has to be resolved by a time, a task due at a time — the number a
person actually reads off the form is the distance between now and that moment,
and that is the one number the built-in control does not show. SLA Timer binds
the same column and renders the distance: **in 3 days**, **42 minutes ago**,
with an *On track* / *Due soon* / *Overdue* label beside it.

It reads the column and never writes it. `getOutputs()` returns an empty object
on purpose, and it never calls `notifyOutputChanged` — including from its own
tick, which is the trap this shape has. A form carrying a dozen of these should
not be re-evaluating its business rules once a second.

The countdown repaints on its own: every second while less than an hour is left
and the readout is showing seconds, every thirty seconds above that, and not at
all while the browser tab is hidden. Both the interval and the
`visibilitychange` listener are released in `destroy()`.

Two decisions are worth knowing before reading the code, because both look
wrong at a glance:

- **The relative phrasing does not come from the .resx.** Plurals differ across
  the five languages this control ships and a `.resx` holds one string per key,
  so `Intl.RelativeTimeFormat` formats that one string, seeded from
  `userSettings.languageId`. Everything else — the state labels, the messages —
  is in the `.resx` as usual. See `SPEC.md`.
- **"Days" are counted, not divided.** `(deadline - now) / 86400000` is an hour
  out across a daylight-saving boundary, which is enough to render *in 2 days*
  for a deadline three calendar days away. The `elapsed` readout does divide,
  because a duration is a different question from a calendar one.

## Properties

| Property | Type | Usage | Default | What it controls |
| --- | --- | --- | --- | --- |
| `deadline` | DateAndTime.DateAndTime | bound, **required** | — | The moment counted down to. Read, never written |
| `warningMinutes` | Whole.None | input | `60` | Minutes before the deadline at which the state becomes *Due soon* |
| `display` | Enum: `remaining` \| `elapsed` | input | `remaining` | `remaining` phrases the gap in words; `elapsed` shows a digital `3 d 04:12:30` readout |

The `.resx` ship five languages — 1033 English, 3082 Spanish, 1036 French, 1031
German, 1041 Japanese. A user provisioned in anything else gets English strings
and English phrasing.

The control declares **no `uses-feature` entries**: it calls neither Web API nor
Utility nor Device, so a maker installing it is asked for no permissions. It is
a standard control and bundles no framework — the whole bundle is about 19 KB.

## On the hub

`demo.fidelity` is **`full`**, and it follows from the paragraph above: the
control reaches nothing the hub's harness cannot supply. There is no Web API
call to stub, no device to fake and no navigation to intercept — it needs a
date, a clock and a locale, and the harness has all three.

The one thing a demo cannot have is a deadline that stays interesting. Presets
are static JSON, so a date written today drifts out of whichever band it was
chosen for. The two presets work around it honestly rather than by faking a
clock: **Overdue** uses a date that is safely in the past, and **Due soon**
pairs a far-future date with a very large `warningMinutes`, which puts the
deadline inside the warning band using nothing but real properties.

## Install

Download the managed solution from the
[latest release](https://github.com/pcfhub/pcf-sla-timer/releases/latest), or from
the component's page on the hub, and import it into your environment.

## Develop

```bash
npm install
npm start          # the PCF test harness
npm run build
npm run lint
npm run check      # what CI runs first: placeholders, pcfhub.json, control shape
npm run smoke      # assertions against the built bundle — see dev/
```

`npm start` renders the control; `dev/` is for the states it cannot reach. Build
first, then `npm run smoke` for the assertions, or open `dev/harness.html` in a
browser for the switches — field-level security, a failed business rule, a host
that publishes no theme or no column metadata, and for a dataset control, more
than one page. Both read the bundle `npm run build` wrote, and both are
described in the header of `dev/smoke.js`.

Run `npm run refreshTypes` after every manifest edit — until you do,
`context.parameters` is typed from the old manifest and `tsc` will accept code that
cannot work.

To pack the solution locally you need msbuild — either Visual Studio or the
Visual Studio Build Tools:

```bash
cd Solution
msbuild /t:build /restore /p:configuration=Release
```

Both zips land in `Solution/bin/Release`. This is the only local step that compiles
in **production** mode, so a green `npm run build` is not evidence the shipping
bundle compiles — and the pack is incremental, so delete `obj/`, `out/`,
`Solution/obj/` and `Solution/bin/` first if you intend to quote a bundle size from
it.

## Release

1. Bump the version in **three** places, in one commit — they are checked
   against each other in CI:
   - `SlaTimer/ControlManifest.Input.xml` → `<control version="…">`
   - `Solution/src/Other/Solution.xml` → `<Version>`
   - `package.json` → `"version"`
2. Tag it: `git tag v1.2.3 && git push --tags`

The release workflow builds, packs both solution types, and attaches them to a
GitHub Release. PCFHub picks the release up from its webhook within seconds, or
from the hourly sweep otherwise. A sync imports a draft; a person publishes it.

## Repository layout

| Path | What it is |
| --- | --- |
| `SlaTimer/` | The control: manifest, entry point, CSS, localised strings |
| `Solution/` | The Dataverse solution that packages it |
| `dev/` | A stand-in host: `npm run smoke` asserts, `harness.html` shows |
| `SPEC.md` | What building this corrected, and what is verified versus read |
| `docs/` | The pages PCFHub publishes — see the comments in each file |
| `media/` | Images and video referenced from the docs |
| `pcfhub.json` | The hub's manifest: identity, links, docs path, demo |
| `scripts/` | Template setup and the CI guard that keeps it adopted |

## Licence

[MIT](LICENSE)
