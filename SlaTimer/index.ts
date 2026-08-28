import { IInputs, IOutputs } from './generated/ManifestTypes';

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Two tick rates, and the control moves between them.
 *
 * A countdown showing seconds has to repaint every second; one showing "in 3
 * days" repaints every thirty and nobody can tell. Running the fast cadence
 * always is the version most controls ship, and on a form with twenty of these
 * in a subgrid it is twenty repaints a second for a number that changes daily.
 */
const FAST = SECOND;
const SLOW = 30 * SECOND;

type State = 'ok' | 'warning' | 'overdue';

/**
 * Everything a repaint needs, read from `context` while `context` is valid.
 *
 * **The tick must not hold the context.** `updateView` is handed a context for
 * the duration of the call; nothing promises the same object still describes
 * the form thirty seconds later, and a timer that reads `context.parameters`
 * from a closure is reading an object nobody guaranteed is current. So the
 * control takes a plain snapshot here — including the strings and the absolute
 * date, both of which need `context` to produce — and the tick renders from
 * that and a clock reading. Nothing in `paint()` touches the platform.
 */
interface Snapshot {
    deadline: Date;
    warningMs: number;
    display: 'remaining' | 'elapsed';
    locale: string;
    /** The deadline as the user's own Dataverse settings render it. */
    dueAt: string;
    labels: Record<State, string>;
}

/**
 * LCIDs to BCP-47, for the two `Intl` formatters below.
 *
 * `userSettings.languageId` is the user's provisioned Dataverse language, which
 * is the right source: the browser's `navigator.language` is a different
 * setting that frequently disagrees, and a control that follows it renders in
 * one language while the form around it renders in another.
 *
 * The five here are the five the control ships .resx files for. Anything else
 * falls back to English rather than guessing — `Intl` would happily accept a
 * locale the rest of the control has no strings for.
 */
const LOCALES: Record<number, string> = {
    1031: 'de-DE',
    1033: 'en-US',
    1036: 'fr-FR',
    1041: 'ja-JP',
    3082: 'es-ES',
};

/**
 * A calendar day number, built from *local* components.
 *
 * `(b - a) / 86400000` is the obvious way to count days between two dates and
 * it is an hour out across every daylight-saving boundary — enough for a
 * `Math.round` to land on the wrong day. Building a UTC instant out of local
 * components throws the time away first, so what is subtracted is two
 * midnights and the answer is the calendar difference a person would give.
 */
const dayNumber = (date: Date): number =>
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY;

/**
 * "in 3 days", "42 minutes ago" — in the user's language, with its own plurals.
 *
 * This is the one place the control does not read its strings from the .resx,
 * and the reason is plurals: German, French and Spanish do not agree with
 * English on when a form changes, and Japanese has no plural form at all. A
 * .resx holds one string per key and cannot express that.
 * `Intl.RelativeTimeFormat` holds the CLDR plural rules for every locale it
 * supports, so the correct form comes out without a rule per language living
 * here. SPEC.md records the trade.
 *
 * **The days branch counts calendar days, not 86,400,000-millisecond blocks.**
 * "In 3 days" is a claim about dates on a calendar, so it is answered with
 * `dayNumber`. Compare `formatDuration`, which answers a genuinely different
 * question and is right to divide.
 */
function formatRelative(remaining: number, now: Date, deadline: Date, locale: string): string {
    const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    const magnitude = Math.abs(remaining);

    if (magnitude < MINUTE) {
        return format.format(Math.trunc(remaining / SECOND), 'second');
    }

    if (magnitude < HOUR) {
        return format.format(Math.trunc(remaining / MINUTE), 'minute');
    }

    if (magnitude < DAY) {
        return format.format(Math.trunc(remaining / HOUR), 'hour');
    }

    const days = dayNumber(deadline) - dayNumber(now);

    if (Math.abs(days) < 30) {
        return format.format(days, 'day');
    }

    /*
     * Months and years are counted off the calendar too, and there is no
     * division left to get wrong: a month is not a fixed number of
     * milliseconds, so `magnitude / (30 * DAY)` would be an approximation of a
     * number that is exactly knowable. Subtracting the two dates' own month
     * and year components is that exact number.
     *
     * The bands are wide on purpose. "In 45 days" is more useful to somebody
     * working a deadline than "next month", so days hold until a month and a
     * half; years wait for two.
     */
    const months = (deadline.getFullYear() - now.getFullYear()) * 12 + (deadline.getMonth() - now.getMonth());

    if (Math.abs(months) < 24) {
        return format.format(months, 'month');
    }

    return format.format(deadline.getFullYear() - now.getFullYear(), 'year');
}

/**
 * A digital readout — `3 d 04:12:30` — for the `elapsed` display.
 *
 * Deliberately a *duration* rather than a calendar statement, which is why the
 * days here are `Math.floor(ms / DAY)` and not `dayNumber`. Elapsed time is
 * measured, not counted off a calendar: twenty-five hours is twenty-five hours
 * on the night the clocks go back, and reporting it as "1 day" would be the
 * mirror image of the bug `formatRelative` avoids.
 *
 * The day unit still comes from `Intl` rather than a hardcoded "d", so it is
 * "3 Tg." in German and "3日" in Japanese. The clock half needs no translation:
 * `04:12:30` is the same in all five.
 */
function formatDuration(magnitude: number, locale: string): string {
    const days = Math.floor(magnitude / DAY);
    const hours = Math.floor((magnitude % DAY) / HOUR);
    const minutes = Math.floor((magnitude % HOUR) / MINUTE);
    const seconds = Math.floor((magnitude % MINUTE) / SECOND);

    const pad = (part: number): string => String(part).padStart(2, '0');
    const clock = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

    if (days === 0) {
        return clock;
    }

    const unit = new Intl.NumberFormat(locale, { style: 'unit', unit: 'day', unitDisplay: 'short' });

    return `${unit.format(days)} ${clock}`;
}

export class SlaTimer implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    private container!: HTMLDivElement;
    /** The filled surface the readout sits in. See the stylesheet. */
    private field!: HTMLDivElement;
    private state!: HTMLSpanElement;
    private readout!: HTMLSpanElement;
    private message!: HTMLParagraphElement;
    /** Visually hidden, polite. Written to on a state change and never on a tick. */
    private announcer!: HTMLParagraphElement;

    private snapshot: Snapshot | null = null;
    /** The live interval, and the cadence it was armed at. `0` is disarmed. */
    private timer: number | undefined;
    private cadence = 0;
    /** The last state announced, so a repaint that changes nothing stays quiet. */
    private announced: State | undefined;

    public init(
        context: ComponentFramework.Context<IInputs>,
        _notifyOutputChanged: () => void,
        _state: ComponentFramework.Dictionary,
        container: HTMLDivElement,
    ): void {
        this.container = container;

        this.state = document.createElement('span');
        this.state.className = 'SlaTimer-state';

        /*
         * `role="timer"` is a live region whose implicit `aria-live` is `off`,
         * which is exactly the behaviour a ticking number needs: the element is
         * identified as a timer, and nothing is announced as it counts. The
         * obvious wiring — `aria-live="polite"` on the countdown — reads the
         * new value to a screen reader user every second and makes the rest of
         * the form unusable. What deserves announcing is the *transition*, and
         * that goes to `announcer` below.
         */
        this.readout = document.createElement('span');
        this.readout.className = 'SlaTimer-readout';
        this.readout.setAttribute('role', 'timer');

        this.field = document.createElement('div');
        this.field.className = 'SlaTimer-field';
        this.field.append(this.state, this.readout);

        // The platform's own validation message, and where "no access" and "no
        // deadline" go. Without somewhere to put it, a failing business rule is
        // silent inside a code component.
        this.message = document.createElement('p');
        this.message.className = 'SlaTimer-message';

        this.announcer = document.createElement('p');
        this.announcer.className = 'SlaTimer-announcer';
        this.announcer.setAttribute('aria-live', 'polite');

        this.container.classList.add('SlaTimer');
        this.container.append(this.field, this.message, this.announcer);

        /*
         * A hidden tab has nothing to show and no reason to run a clock. This
         * is the second thing `destroy` owes — a listener on `document`
         * outlives the control's own DOM, so unlike a listener on an element
         * inside `container` it is not collected when the platform throws that
         * subtree away.
         */
        document.addEventListener('visibilitychange', this.onVisibilityChange);

        this.render(context);
    }

    public updateView(context: ComponentFramework.Context<IInputs>): void {
        this.render(context);
    }

    /**
     * Nothing. On purpose.
     *
     * The generated `IOutputs` types `deadline` as optional, and for a control
     * with a clear button `undefined` would be the bug — it means "no change",
     * so a cleared column never empties. Here it is the whole point: this
     * control reads the deadline and never writes it, and "no change" is a true
     * statement about every render. The inversion is worth a comment precisely
     * because the opposite rule is the one written down everywhere else.
     */
    public getOutputs(): IOutputs {
        return {};
    }

    public destroy(): void {
        this.disarm();
        document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }

    private render(context: ComponentFramework.Context<IInputs>): void {
        const parameter = context.parameters.deadline;

        // Before the visibility guard, so the no-access message is themed too.
        this.applyTheme(context);

        // Canvas relies on this; a model-driven form hides the section itself.
        // Honouring it costs one class and covers both hosts.
        this.container.classList.toggle('SlaTimer--hidden', !context.mode.isVisible);

        if (!context.mode.isVisible) {
            // A clock nobody can see is a repaint nobody needs.
            this.stop();

            return;
        }

        // Field-level security is NOT the same as the form's read-only state,
        // and conflating them is a real information bug. A user denied read
        // access gets `raw === null` — indistinguishable from "no deadline set"
        // unless `security.readable` is checked, so an unchecked control shows
        // an empty timer where the truth is "not allowed to see it".
        const security = parameter.security;

        if (security !== undefined && !security.readable) {
            this.stop();
            this.field.hidden = true;
            this.message.hidden = false;
            this.message.textContent = context.resources.getString('SlaTimer_NoAccess');

            return;
        }

        /*
         * `security.editable` is read and deliberately ignored, and so is
         * `mode.isControlDisabled`. There is nothing here to disable: the
         * control renders text and takes no input, so a read-only form and an
         * editable one produce the same thing. Saying so is better than
         * carrying the scaffold's disabled branch and leaving a reader to
         * wonder which of the two states it was meant to cover.
         */

        const deadline = parameter.raw;

        if (deadline === null) {
            this.stop();
            this.field.hidden = true;
            this.message.hidden = false;
            this.message.textContent = context.resources.getString('SlaTimer_NoDeadline');

            return;
        }

        this.field.hidden = false;
        this.message.hidden = !parameter.error;
        this.message.textContent = parameter.error ? parameter.errorMessage : '';
        this.container.classList.toggle('SlaTimer--invalid', parameter.error);

        /*
         * `attributes` is optional because a canvas app has no column metadata
         * at all. That single `?` is the whole canvas/model-driven difference:
         * narrow behaviour when it is present, do not require it.
         *
         * `Behavior` is worth reading for exactly this — `formatTime` takes it
         * — and for very little else. All three named behaviours hand over a
         * Date whose *local* components are the moment the user means, so the
         * arithmetic below needs no branch on it. `1` (UserLocal) is the
         * assumption a host that publishes nothing is making anyway.
         *
         * No cast: `attributes.Behavior` is already typed as the union
         * `formatTime` wants, so the `?? 1` fallback stays inside it. A cast
         * here would only be hiding the fact that it does.
         */
        const behavior = parameter.attributes?.Behavior ?? 1;

        const languageId = context.userSettings.languageId;

        this.snapshot = {
            deadline,
            // A canvas formula can hand back anything; `Number` on a null or a
            // string keeps the fallback rather than propagating NaN downstream.
            warningMs: Math.max(0, Number(context.parameters.warningMinutes.raw ?? 60) || 60) * MINUTE,
            // `Enum` generates a string union, but the union is a compile-time
            // claim about a runtime the compiler does not control.
            display: String(context.parameters.display.raw ?? 'remaining') === 'elapsed' ? 'elapsed' : 'remaining',
            locale: LOCALES[languageId] ?? LOCALES[1033],
            dueAt: context.resources
                .getString('SlaTimer_DueAt')
                .replace(
                    '{0}',
                    `${context.formatting.formatDateShort(deadline)} ${context.formatting.formatTime(deadline, behavior)}`,
                ),
            labels: {
                ok: context.resources.getString('SlaTimer_StateOk'),
                warning: context.resources.getString('SlaTimer_StateWarning'),
                overdue: context.resources.getString('SlaTimer_StateOverdue'),
            },
        };

        // `mode.label` is the label the maker gave the field on this form,
        // which is a better accessible name than anything shipped in the .resx.
        // The resource string is the fallback, not the default.
        this.readout.setAttribute(
            'aria-label',
            context.mode.label || context.resources.getString('SlaTimer_Name'),
        );

        this.container.dir = context.userSettings.isRTL ? 'rtl' : 'ltr';

        this.paint();
    }

    /**
     * Repaint from the snapshot and the clock, and re-arm if the rate changed.
     *
     * Called from `render` and from the interval, and it is the only thing the
     * interval calls — which is why it touches no platform API.
     */
    private paint = (): void => {
        const snapshot = this.snapshot;

        if (snapshot === null) {
            return;
        }

        const now = new Date();
        const remaining = snapshot.deadline.getTime() - now.getTime();
        const state: State = remaining <= 0 ? 'overdue' : remaining <= snapshot.warningMs ? 'warning' : 'ok';

        this.readout.textContent =
            snapshot.display === 'elapsed'
                ? formatDuration(Math.abs(remaining), snapshot.locale)
                : formatRelative(remaining, now, snapshot.deadline, snapshot.locale);

        // The state label is rendered, not just coloured. Colour alone fails
        // anyone who cannot distinguish these three, and the dot beside it is
        // decoration either way.
        this.state.textContent = snapshot.labels[state];
        this.field.title = snapshot.dueAt;

        this.container.classList.toggle('SlaTimer--ok', state === 'ok');
        this.container.classList.toggle('SlaTimer--warning', state === 'warning');
        this.container.classList.toggle('SlaTimer--overdue', state === 'overdue');

        /*
         * Announce the transition, never the tick — and never the first paint
         * either, since a control appearing on a form is not a change to
         * anything. `announced` starts undefined and is seeded silently.
         */
        if (this.announced !== undefined && this.announced !== state) {
            this.announcer.textContent = `${snapshot.labels[state]} — ${this.readout.textContent}`;
        }

        this.announced = state;

        this.arm(Math.abs(remaining) < HOUR ? FAST : SLOW);
    };

    /**
     * Start the interval, or leave it exactly as it is.
     *
     * The guard is the whole method. `paint` runs on every tick *and* on every
     * `updateView`, so an unguarded `setInterval` here would add a timer per
     * render — the leak this shape is famous for, and one that is invisible
     * until a form with a few of these has been open for an afternoon. Clearing
     * before setting covers the other half: a cadence change must replace the
     * timer rather than run a second one alongside it.
     */
    private arm(cadence: number): void {
        if (this.cadence === cadence && this.timer !== undefined) {
            return;
        }

        this.disarm();
        this.cadence = cadence;
        this.timer = setInterval(this.paint, cadence) as unknown as number;
    }

    private disarm(): void {
        if (this.timer !== undefined) {
            clearInterval(this.timer);
            this.timer = undefined;
        }

        this.cadence = 0;
    }

    /** Disarm and forget, for the states that render no clock at all. */
    private stop(): void {
        this.disarm();
        this.snapshot = null;
    }

    private onVisibilityChange = (): void => {
        if (document.hidden) {
            this.disarm();

            return;
        }

        // Repaint before re-arming: coming back to a stale number and waiting
        // up to thirty seconds for it to correct itself is the thing a paused
        // clock is otherwise guaranteed to do.
        this.paint();
    };

    /**
     * Picks which set of colour fallbacks the stylesheet uses.
     *
     * Only the fallbacks. Where the host publishes Fluent's design tokens — a
     * model-driven form does, via the `FluentProvider` it already mounts above
     * every code component — the CSS reads them straight through `var()` and
     * this changes nothing. That is what stops the control fighting a host that
     * knows its own theme better than this code does.
     *
     * `@media (prefers-color-scheme: dark)` is the obvious hook and it is the
     * wrong question: a model-driven app carries its own theme and the user's
     * OS setting says nothing about it, so an OS-dark machine on a light app
     * would render a dark control on a white form. Absent means absent — no
     * class, light fallbacks, the same guess the host made by not saying.
     */
    private applyTheme(context: ComponentFramework.Context<IInputs>): void {
        const isDarkTheme = context.fluentDesignLanguage?.isDarkTheme;

        if (isDarkTheme === undefined) {
            return;
        }

        this.container.classList.toggle('SlaTimer--dark', isDarkTheme);
    }
}
