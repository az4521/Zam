# Translations

Every user-facing string in the app lives in [`en.ts`](./en.ts), the English
source catalogue. Components and modules never hardcode text; they call
`t("area.key", { params })` from `$lib/i18n`.

## Adding a language

1. Add an entry to `LOCALES` in [`manifest.ts`](./manifest.ts): its code
   (BCP 47 / ISO 639), its own name, its English name and its direction
   (`"ltr"` or `"rtl"`). If the browser's `Intl` has no data for the
   language, set `intl` / `plural` to a close locale that does.
2. Create `locales/<code>.ts`, default-exporting a `LocaleCatalogue`:

    ```ts
    import type { MessageKey } from "../en";
    import type { LocaleCatalogue } from "../index";

    const messages: Partial<Record<MessageKey, string>> = {
        "common.save": "…",
    };

    export default { messages } satisfies LocaleCatalogue;
    ```

    Type `messages` as `Record<MessageKey, string>` instead once the
    translation is complete: from then on, a new English string that has not
    been translated fails `npm run check`. Until then, missing strings fall
    back to English.

3. Run `npm test`. `i18n.test.ts` checks every catalogue in `locales/` has a
   manifest entry (and vice versa), uses only real keys, and keeps each
   string's `{placeholders}` and plural structure identical to English.

Nothing else needs touching. Catalogues are code-split, so only the language
a user picks is downloaded; the language picker, `<html lang dir>`, plural
rules and date formatting are all driven by the manifest.

## Message syntax

- `{name}`: a placeholder. Keep the name; move it wherever the grammar needs.
- `{count, plural, one {# file} other {# files}}`: ICU plural. Use the
  categories your language has (`zero`, `one`, `two`, `few`, `many`,
  `other`, or exact `=0`); `#` is the number. `other` is required.
- Keep product names (Zam, Matrix), protocol tokens (`@room`, `/me`,
  `m.room.message`) and date-fns patterns (`yyyy-MM-dd`) as they are.
- No em dashes (the build rejects them in UI strings); use a hyphen.

## Dates

Month and weekday names come from date-fns. If date-fns ships the language,
import its locale in the catalogue and pass it as `dateLocale` (see
`locales/fr.ts`). If it doesn't, add a `dates` block instead (months from
January, weekdays from Sunday, and the am/pm markers); see `locales/aii.ts`. Word
order of dates is itself a message: `timeFormat.separatorDatePattern` and
`timeFormat.monthDayPattern`.

## Right-to-left languages

The panel arrangement (servers, rooms, chat, side panels) is pinned
left-to-right in every language: `AppShell` and `MessageArea` set
`dir="ltr"` on their layout rows and hand each panel `dir={uiDir}` back.
Everything inside a panel, plus modals and settings, mirrors in RTL through
logical CSS (`ms-*`/`me-*`, `ps-*`/`pe-*`, `start-*`/`end-*`, `text-start`,
`border-s`, `margin-inline-start`, ...). When writing new UI:

- Never use `ml-`/`mr-`/`pl-`/`pr-`/`left-`/`right-`/`text-left`/`text-right`
  or physical CSS properties for layout. The exception is deliberate
  centring (`left-1/2 -translate-x-1/2`), which is direction-neutral.
- For RTL-only tweaks use the `mirror:` variant (defined in
  `tailwind.config.js`), not Tailwind's `rtl:`. `mirror:` matches the
  element's own direction (`:dir(rtl)`), so it stays off inside the pinned
  left-to-right regions, whereas `rtl:` matches anything under
  `<html dir="rtl">`. Better still, prefer logical utilities that need no
  override at all.
- Arrows and chevrons that mean "back"/"forward" take
  `mirror:-scale-x-100`.
- `translate-x-*` does not flip: pair it with a `mirror:` counterpart,
  or position with `start-*`/`end-*` instead.
- A new side panel or drawer belongs to the pinned arrangement: position it
  with physical `left-*`/`right-*` and a physical divider border.
- JS that reads pointer deltas or sets `translateX` inside mirrored content
  must flip them (read `getComputedStyle(el).direction`).
- User-generated text (messages, the composer) carries `dir="auto"` so each
  message is laid out in its own direction.
