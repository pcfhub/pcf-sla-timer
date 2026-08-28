/*
 * Drives the real built bundle outside a browser.
 *
 *     npm run build && npm run smoke
 *
 * What it does: installs the DOM, a fake clock and the platform globals, loads
 * `out/controls/SlaTimer/bundle.js` the way a form would, drives the control
 * through the states a form can put it in, and asserts what it did.
 *
 * Why it exists alongside `npm start` and `dev/harness.html`: both of those
 * *show* you the control, and the states that matter most are ones nobody
 * thinks to look at — a column the user cannot read, a business rule that
 * failed, a host with no column metadata, a daylight-saving boundary, an
 * interval that was never cleared. Those are decisions, they are what
 * regresses, and here they are assertions with an exit code.
 *
 * **Time is fake here, and that is the whole reason this file can say
 * anything.** Against the real clock a countdown test has to wait a second to
 * watch a second pass, a leaked interval takes an afternoon to become visible,
 * and a DST boundary arrives twice a year. `dev/clock.js` replaces `Date`,
 * `setInterval` and `setTimeout` on this realm — which is the realm
 * `vm.runInThisContext` gives the bundle — so the control keeps the code it
 * ships and the test drives the clock.
 *
 * Why no test framework: there is none in this repository, and adding one to
 * run a handful of assertions against a bundle would be a dependency, a config
 * file and a second build pipeline for something `node` already does. It also
 * runs the **built bundle** rather than the TypeScript sources, which is the
 * part worth checking — webpack, the externals and the manifest all sit between
 * the source and what a form actually loads. CI runs it after the msbuild pack,
 * so there it drives the production bundle.
 *
 * **What passing here does NOT mean.** Every value below is supplied by this
 * file. It cannot tell you that the control looks right, that the stylesheet
 * applies, that a screen reader announces what the live region holds, that a
 * real form hands down what these fixtures hand down, or that the browser's
 * `visibilitychange` fires when this file says it does. Keep the answers to
 * those in SPEC.md under "Not verified".
 *
 * **And a stub must never be more capable than the thing it stands in for.**
 * `dev/host.js` withholds `security`, `attributes` and `fluentDesignLanguage`
 * exactly where the platform withholds them, and stubs two `formatting` calls
 * rather than the API. When you add to it, stub the refusals first — the
 * argument the call requires, the field it omits, the empty collection it hands
 * back. If you cannot say what the real call withholds, the stub is a guess and
 * the assertions resting on it prove nothing.
 */

const fs = require('fs');
const vm = require('vm');
const path = require('path');

// Resolved from this file rather than from the working directory, so the script
// behaves the same run directly or through npm.
const root = path.join(__dirname, '..');
const dom = require('./dom.js');
const host = require('./host.js');
const clock = require('./clock.js');

const BUNDLE = path.join(root, 'out', 'controls', 'SlaTimer', 'bundle.js');

if (!fs.existsSync(BUNDLE)) {
    console.error('\n  No bundle at out/controls/SlaTimer. Run npm run build first.\n');
    process.exit(1);
}

/* ----------------------------------------------------------- the platform */

dom.install(global);

/*
 * The clock starts one hour and one minute before `host.DEFAULTS.deadline`, so
 * the default fixture is `ok` by a single minute against the default
 * `warningMinutes: 60`. Every threshold assertion below then moves the clock by
 * a stated amount from a stated state, rather than reasoning about two dates.
 */
const DEADLINE = host.DEFAULTS.deadline.getTime();
const START = DEADLINE - 61 * 60 * 1000;

let time = clock.install(START, global);

/**
 * Run something in its own frame of time, then start a clean one at `START`.
 *
 * Two assertions below need a clock somewhere other than where the suite left
 * it — a March morning either side of a daylight-saving boundary. Rewinding the
 * shared clock instead would leave every control still mounted holding timers
 * due at a moment that is now in the future, and the teardown counts after it
 * would be measuring those rather than the control under test. A fresh frame
 * starts the count at zero, which is the only number worth comparing against.
 */
function at(start, run) {
    // Nothing crosses a frame boundary still mounted: a control left behind
    // holds an interval in a clock that no longer exists and a `document`
    // listener in one that does, and both would be counted against whatever
    // runs next.
    disposeAll();
    time.restore();
    time = clock.install(start, global);

    try {
        return run();
    } finally {
        disposeAll();
        time.restore();
        time = clock.install(START, global);
    }
}

const registration = host.captureRegistration(global);

const source = fs.readFileSync(BUNDLE, 'utf8');

/*
 * The platform libraries, supplied under the names the bundle actually asks
 * for — read out of the bundle rather than written down here.
 *
 * A `<platform-library>` entry becomes a webpack external, and the global it
 * compiles to carries a version in its name. **That version is not the one the
 * manifest declares.** `pcf-scripts` maps a declared version onto the platform
 * build it supports, so Fluent `9.46.2` arrives as `FluentUIReactv940` and
 * React `16.14.0` as `Reactv16`. Hardcoding either is a trap that springs on
 * the next version bump, with a `ReferenceError` naming a global that appears
 * nowhere in the repository.
 *
 * This control is standard and declares no platform libraries at all, so both
 * lists are empty and nothing below runs. It stays because the alternative is
 * discovering it is missing on the day the control grows a dependency.
 */
const reactGlobals = [...new Set(source.match(/\bReactv[\w]*\b/g) || [])];
const fluentGlobals = [...new Set(source.match(/\bFluentUIReact[\w]*\b/g) || [])];

if (reactGlobals.length > 0) {
    const React = require(path.join(root, 'node_modules', 'react'));

    reactGlobals.forEach((name) => {
        global[name] = React;
    });
}

const fluent = new Proxy({}, { get: (_target, name) => (typeof name === 'string' ? name : undefined) });

fluentGlobals.forEach((name) => {
    global[name] = fluent;
});

vm.runInThisContext(source, { filename: 'bundle.js' });

/* ---------------------------------------------------------------- harness */

const results = [];

function check(label, ok, detail) {
    results.push({ ok, label, detail });
}

/*
 * `getString` returns a marked key rather than a real string, so an assertion
 * can tell "read from the .resx" apart from "hardcoded in the source" — which
 * would otherwise look identical in the output.
 *
 * `SlaTimer_DueAt` keeps its `{0}`, because the control substitutes the
 * formatted date into it and a marker with the placeholder stripped out would
 * silently turn that substitution into a no-op — passing the assertion below
 * while proving the opposite of what it claims.
 */
const marked = (key) => (key === 'SlaTimer_DueAt' ? 'resx:SlaTimer_DueAt {0}' : `resx:${key}`);

/**
 * Mount a fresh control in a given state and hand back everything worth
 * asserting about it.
 *
 * A new instance per state on purpose: `init` runs once per control on a real
 * form, so a suite that reused one instance would be testing a sequence the
 * platform never produces. Where the *sequence* is the point — the clock
 * advancing, a value arriving after a render — drive it through the returned
 * handle.
 */
/**
 * Every control mounted and not yet destroyed.
 *
 * A suite that mounts and walks away is testing something other than what it
 * says: the abandoned controls keep their intervals and their `document`
 * listeners, so the next section's timer count includes them and the next
 * `visibilitychange` reaches all of them. Which is, exactly, the bug this
 * control is written to avoid — so leaving it in the harness would be
 * asserting teardown from inside a leak.
 */
const live = [];

function disposeAll() {
    while (live.length > 0) {
        live.pop().destroy();
    }
}

function mount(options) {
    const container = dom.createElement('div');
    const tracked = [];
    const context = host.createContext({ ...options, tracked, getString: marked });
    const instance = new registration.ctor();

    let notifications = 0;

    instance.init(
        context,
        () => {
            notifications += 1;
        },
        {},
        container,
    );

    instance.updateView(context);

    const handle = {
        instance,
        container,
        outputs: () => instance.getOutputs(),
        notifications: () => notifications,
        /** `trackContainerResize` / `setFullScreen` calls the control made. */
        tracked: () => tracked,
        /** Re-render in a new state, as the platform does on every change. */
        update: (next) => instance.updateView(host.createContext({ ...options, ...next, getString: marked })),
        /** Unmount, as the platform does when the form closes or the tab changes. */
        destroy: () => {
            instance.destroy();

            const at = live.indexOf(handle);

            if (at !== -1) {
                live.splice(at, 1);
            }
        },
        find: (selector) => container.querySelector(selector),
        text: (selector) => {
            const found = container.querySelector(selector);

            return found === null ? null : found.textContent;
        },
    };

    live.push(handle);

    return handle;
}

check('bundle registered a control', typeof registration.ctor === 'function');

if (typeof registration.ctor !== 'function') {
    report();
}

/* ------------------------------------------------------------ what it draws */

const plain = mount({});

check(
    'renders a state label and a readout inside the field surface',
    Boolean(plain.find('.SlaTimer-field')) && Boolean(plain.find('.SlaTimer-state')) && Boolean(plain.find('.SlaTimer-readout')),
);

/*
 * The countdown itself. One minute outside a sixty-minute warning threshold,
 * `Intl.RelativeTimeFormat` in `en-US` with `numeric: 'auto'` says "in 1 hour".
 */
check('counts down to the deadline in words', plain.text('.SlaTimer-readout') === 'in 1 hour', plain.text('.SlaTimer-readout'));

check('and names the state rather than only colouring it', plain.text('.SlaTimer-state') === 'resx:SlaTimer_StateOk', plain.text('.SlaTimer-state'));

/*
 * The absolute deadline goes in the tooltip, and it goes through
 * `context.formatting` rather than through `Intl` — so it agrees with the rest
 * of the form, which follows the user's Dataverse settings and not the
 * browser's. The `fmt:` marker is the only way to tell the two apart from here.
 */
check(
    "the tooltip is the platform's own formatting of the deadline, not Intl's",
    plain.find('.SlaTimer-field').title === 'resx:SlaTimer_DueAt fmt:date:2026-08-28 fmt:time:17:00:b1',
    plain.find('.SlaTimer-field').title,
);

/*
 * `role="timer"` is a live region whose implicit `aria-live` is `off`. Setting
 * `aria-live="polite"` on a ticking number instead is the obvious wiring, and
 * it reads the countdown to a screen reader user once a second.
 */
check(
    'the readout is a timer, not a polite live region',
    plain.find('.SlaTimer-readout').getAttribute('role') === 'timer'
        && plain.find('.SlaTimer-readout').getAttribute('aria-live') === null,
    `role=${plain.find('.SlaTimer-readout').getAttribute('role')} aria-live=${plain.find('.SlaTimer-readout').getAttribute('aria-live')}`,
);

/*
 * The accessible name comes from the maker's label for this field, not from the
 * .resx — the resource string cannot know what the field is called on this
 * form, so it is the fallback rather than the default.
 */
check("the readout's accessible name is the form's own label", plain.find('.SlaTimer-readout').getAttribute('aria-label') === 'Resolve by');

check(
    'and falls back to the .resx when the form gives no label',
    mount({ label: '' }).find('.SlaTimer-readout').getAttribute('aria-label') === 'resx:SlaTimer_Name',
);

/*
 * **`{}` is correct here, and it is the opposite of the usual rule.**
 *
 * The generated `IOutputs` types every bound value as optional, so an omitted
 * property means "no change" — which for a control with a clear button is the
 * bug that makes the clear do nothing (`pcf-star-rating` shipped exactly that).
 * This control reads the deadline and never writes it, so "no change" is a true
 * statement about every render, and anything else would be the control
 * volunteering to overwrite a column it was only asked to display.
 */
check('writes nothing back to the column it displays', plain.outputs().deadline === undefined, JSON.stringify(plain.outputs()));

/* ------------------------------------------------------ the states it has */

/*
 * The information bug. A user denied read access gets `raw === null`, which is
 * indistinguishable from "no deadline set" unless `security.readable` is
 * checked — so an unchecked control renders an empty timer where the truth is
 * "not allowed to see it". These two assertions are the pair: the same `null`
 * has to produce two different messages.
 */
const denied = mount({ security: 'no-access', deadline: null });

check('a column the user cannot read says so', denied.text('.SlaTimer-message') === 'resx:SlaTimer_NoAccess', denied.text('.SlaTimer-message'));

const empty = mount({ deadline: null });

check('and a genuinely empty column says something else', empty.text('.SlaTimer-message') === 'resx:SlaTimer_NoDeadline', empty.text('.SlaTimer-message'));

check(
    'both hide the field surface rather than leaving an empty box above the message',
    denied.find('.SlaTimer-field').hidden === true && empty.find('.SlaTimer-field').hidden === true,
);

/*
 * The platform's own validation. A failing business rule is silent inside a
 * code component unless the control gives it somewhere to go.
 */
const invalid = mount({ error: true });

check('a validation error is shown to the user', invalid.text('.SlaTimer-message') === host.DEFAULTS.errorMessage, invalid.text('.SlaTimer-message'));

check('and reaches the surface, not just the message', invalid.container.classList.contains('SlaTimer--invalid'));

/*
 * The canvas/model-driven split, which is what every `?.` in the control is
 * about. A canvas app publishes no column metadata and no theme.
 */
const canvas = mount({ host: 'canvas' });

check('renders on a host that publishes no column metadata', canvas.text('.SlaTimer-readout') === 'in 1 hour', canvas.text('.SlaTimer-readout'));

check('takes no position on the theme when the host publishes none', !canvas.container.classList.contains('SlaTimer--dark'), canvas.container.className);

check('and follows the host theme where there is one', mount({ host: 'model-driven', dark: true }).container.classList.contains('SlaTimer--dark'));

/*
 * `Behavior` is the field every date control is told to branch on. All three
 * named values hand over a Date whose local components are the moment the user
 * means, so the countdown must not move when it changes. What it does change is
 * `formatTime`, which takes it as an argument — visible in the tooltip.
 */
const dateOnly = mount({ behavior: 2 });

check(
    'the countdown does not branch on Behavior',
    dateOnly.text('.SlaTimer-readout') === plain.text('.SlaTimer-readout'),
    `${dateOnly.text('.SlaTimer-readout')} vs ${plain.text('.SlaTimer-readout')}`,
);

check('but it is passed to formatTime, which is what it is for', dateOnly.find('.SlaTimer-field').title.includes(':b2'), dateOnly.find('.SlaTimer-field').title);

/*
 * Hidden is a state, not an absence. Canvas relies on `mode.isVisible` — a
 * model-driven form hides the section itself — and a control that ignores it
 * stays on screen in a canvas app that asked for it to go.
 */
check('renders nothing visible when the host says it is hidden', mount({ visible: false }).container.classList.contains('SlaTimer--hidden'));

/* ------------------------------------------------------------ elsewhere */

/*
 * The relative phrasing is the one thing the control does not read from the
 * .resx, because plurals differ across the five languages it ships and a .resx
 * holds one string per key. `Intl.RelativeTimeFormat` carries the CLDR rules;
 * `userSettings.languageId` is what selects them — not `navigator.language`,
 * which is a different setting that frequently disagrees with the one the form
 * is rendered in.
 */
check(
    "phrases the countdown in the user's Dataverse language",
    mount({ languageId: 1031 }).text('.SlaTimer-readout') === 'in 1 Stunde',
    mount({ languageId: 1031 }).text('.SlaTimer-readout'),
);

check(
    'and falls back to English for a language it ships no strings for',
    mount({ languageId: 1040 }).text('.SlaTimer-readout') === 'in 1 hour',
    mount({ languageId: 1040 }).text('.SlaTimer-readout'),
);

check("right-to-left is the container's direction, not a stylesheet guess", mount({ rtl: true }).container.dir === 'rtl');

/*
 * The resize contract, which is a pair and fails silently when half of it is
 * missing. `mode.allocatedWidth` is `-1` until the control calls
 * `mode.trackContainerResize(true)`, so a control that reflows on width without
 * asking lays out against -1 on every host and always picks its narrowest
 * branch. This control reflows on neither, so all this can honestly assert is
 * that a narrow phone-sized container does not break it; the detail line
 * reports whether it asked, which is the interesting half.
 *
 * **The moment this control reads `allocatedWidth` or `getFormFactor`, replace
 * this with the pair** — that it called `trackContainerResize(true)`, and that
 * it lays out differently at 320 than at 1200.
 */
const sized = mount({ width: 320, formFactor: 'phone' });

check(
    'renders in a phone-sized container',
    Boolean(sized.find('.SlaTimer-readout')),
    `trackContainerResize: ${sized.tracked().length > 0 ? 'called' : 'never called'}`,
);

/* --------------------------------------------------------------- the clock */

/*
 * The transition, which is the control's whole job. One minute of clock takes
 * the default fixture from 61 minutes out to 60, which is the threshold, and
 * `remaining <= warningMs` is the warning band.
 */
at(START, () => {
    const crossing = mount({});

    check('starts on track', crossing.container.classList.contains('SlaTimer--ok'));

    time.advance(60 * 1000);

    check(
        'crosses into warning as the threshold is reached',
        crossing.container.classList.contains('SlaTimer--warning'),
        crossing.container.className,
    );

    time.advance(61 * 60 * 1000);

    check(
        'and into overdue when the deadline passes',
        crossing.container.classList.contains('SlaTimer--overdue'),
        crossing.container.className,
    );

    check('the readout says so in words too', crossing.text('.SlaTimer-readout') === '1 minute ago', crossing.text('.SlaTimer-readout'));
});

/*
 * The announcement, and the two halves of getting it right.
 *
 * A polite live region that is written on every tick reads the countdown aloud
 * once a second. One that is written on the first paint announces a control
 * appearing on a form, which is not a change to anything. Only the transition
 * belongs in it.
 */
at(START, () => {
    const announcing = mount({});

    check('says nothing when it first appears', announcing.text('.SlaTimer-announcer') === '', JSON.stringify(announcing.text('.SlaTimer-announcer')));

    time.advance(30 * 1000);

    check('and nothing on a tick that changes no state', announcing.text('.SlaTimer-announcer') === '', JSON.stringify(announcing.text('.SlaTimer-announcer')));

    time.advance(31 * 1000);

    check(
        'but announces the transition when one happens',
        announcing.text('.SlaTimer-announcer').startsWith('resx:SlaTimer_StateWarning'),
        announcing.text('.SlaTimer-announcer'),
    );

    /*
     * Display-only means display-only. `notifyOutputChanged` from a one-second
     * interval is a form-wide re-evaluation once a second, for a control that
     * never writes anything.
     */
    check('never notifies the platform, at rest or across a tick', announcing.notifications() === 0, String(announcing.notifications()));
});

/* ------------------------------------------------- the day that moves */

/*
 * The DST assertion, and the reason the days branch does not divide.
 *
 * US Eastern springs forward at 2am on 8 March 2026, so the interval from noon
 * on the 7th to noon on the 10th is 71 hours, not 72. `(b - a) / 86400000` is
 * 2.958 and truncates to 2 — "in 2 days" for a deadline three calendar days
 * away. Counting midnights gives 3.
 *
 * The `TZ` guard is not politeness. This only fails in a zone that observes
 * DST on that date, so on a UTC CI runner the naive code passes and ships. That
 * asymmetry is most of why the bug survives review: whoever wrote it could not
 * reproduce the report.
 */
const springsForward = new Date(2026, 2, 7, 12, 0, 0).getTimezoneOffset() !== new Date(2026, 2, 10, 12, 0, 0).getTimezoneOffset();

const across = at(new Date(2026, 2, 7, 12, 0, 0).getTime(), () => {
    const mounted = mount({ deadline: new Date(2026, 2, 10, 12, 0, 0) });
    const text = mounted.text('.SlaTimer-readout');

    mounted.destroy();

    return text;
});

check(
    springsForward
        ? 'counts calendar days across a daylight-saving boundary'
        : 'counts calendar days (this timezone has no DST here, so the naive code would also pass)',
    across === 'in 3 days',
    `${across}${springsForward ? '' : ` — run with TZ=America/New_York to make this bite`}`,
);

/*
 * The mirror image, and the reason `elapsed` is allowed to divide. A duration
 * is measured, not counted off a calendar: the same span is 71 hours, which is
 * two days and 23 hours, and reporting it as three days would be the same bug
 * pointing the other way.
 */
const duration = at(new Date(2026, 2, 7, 12, 0, 0).getTime(), () => {
    const mounted = mount({ deadline: new Date(2026, 2, 10, 12, 0, 0), display: 'elapsed' });
    const text = mounted.text('.SlaTimer-readout');

    mounted.destroy();

    return text;
});

check(
    'but measures the elapsed readout as a duration, not as calendar days',
    springsForward ? duration === '2 days 23:00:00' : duration === '3 days 00:00:00',
    duration,
);

/* --------------------------------------------------- what destroy owes */

/*
 * **The assertion worth keeping when the rest of this file goes.**
 *
 * A control that takes a timer or a document-level listener in `init` owes both
 * back in `destroy`. Neither is visible in a rendered form: the interval keeps
 * firing against a container the platform has already thrown away, and the
 * listener keeps the whole control alive with it. On a form somebody leaves
 * open all afternoon, or a subgrid that re-renders rows, it accumulates.
 *
 * Counting before and after is the whole trick, and it needs no knowledge of
 * what the control took.
 */
const timersBefore = time.pending();
const listenersBefore = (dom.document.listeners.visibilitychange || []).length;

const disposable = mount({});

check('takes a timer while it is mounted', time.pending() > timersBefore, `${timersBefore} → ${time.pending()}`);

disposable.destroy();

check('destroy() releases every timer it took', time.pending() === timersBefore, `${timersBefore} → ${time.pending()}`);

check(
    'and every document-level listener',
    (dom.document.listeners.visibilitychange || []).length === listenersBefore,
    `${listenersBefore} → ${(dom.document.listeners.visibilitychange || []).length}`,
);

/*
 * The leak the shape is famous for. `updateView` runs on every change to any
 * bound value, so a `setInterval` reached from the render path adds a timer per
 * render — invisible until a form has been open for an afternoon.
 */
const rerendered = mount({});
const afterFirst = time.pending();

rerendered.update({});
rerendered.update({});
rerendered.update({});

check('re-rendering does not add a second interval', time.pending() === afterFirst, `${afterFirst} → ${time.pending()}`);

rerendered.destroy();

/*
 * The cadence change, which is the other way to end up with two. Under an hour
 * the readout shows seconds and has to repaint every second; above it, every
 * thirty seconds is enough. Moving between them must replace the timer rather
 * than run a second one alongside it.
 */
const cadence = mount({ deadline: new Date(DEADLINE + 3 * 60 * 60 * 1000) });
const slow = time.pending();

time.advance(2 * 60 * 60 * 1000 + 1000);

check('changing cadence replaces the interval rather than adding one', time.pending() === slow, `${slow} → ${time.pending()}`);

cadence.destroy();

/*
 * A hidden tab has nothing to show. The pause is worth having on its own, and
 * it is also the case that proves the listener is wired to something rather
 * than merely registered.
 */
const backgrounded = mount({});
const running = time.pending();

dom.document.hidden = true;
dom.document.dispatchEvent({ type: 'visibilitychange', target: dom.document });

check('stops ticking while the tab is hidden', time.pending() < running, `${running} → ${time.pending()}`);

dom.document.hidden = false;
dom.document.dispatchEvent({ type: 'visibilitychange', target: dom.document });

check('and starts again on return', time.pending() === running, `${running} → ${time.pending()}`);

backgrounded.destroy();

/*
 * A state that renders no clock must not leave one running either. This is the
 * same obligation as `destroy`, arriving through a different door.
 */
const cleared = mount({});
const ticking = time.pending();

cleared.update({ deadline: null });

check('a column cleared while mounted stops the clock', time.pending() < ticking, `${ticking} → ${time.pending()}`);

cleared.destroy();

report();

function report() {
    const failed = results.filter((result) => !result.ok);

    for (const result of results) {
        const detail = result.detail ? `  — ${result.detail}` : '';

        console.log(`  ${result.ok ? 'ok  ' : 'FAIL'}  ${result.label}${detail}`);
    }

    console.log(
        failed.length > 0
            ? `\n  ${failed.length} of ${results.length} failed\n`
            : `\n  ${results.length} passed — the control's own decisions only; see SPEC.md for what a real form still has to confirm\n`,
    );

    process.exit(failed.length > 0 ? 1 : 0);
}
