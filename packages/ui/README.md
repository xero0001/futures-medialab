# Shared UI

Platform and admin both import `@futures-medialab/ui/globals.css` from their root stylesheets.

## Montage form fields

- Use `TextField` and `TextArea` from the installed `@montage-ui/core` library for standard text inputs. Use library props for size, validation status, disabled state and content; keep page CSS focused on layout.
- `src/styles/montage-fields.css`, loaded by the shared globals, prevents native focus outlines from duplicating the library's rounded focus border and ring. It also supplies a wrapper outline in forced-colors mode, where box shadows are hidden.
- Do not add per-page `input`/`textarea` outline resets or another wrapper component just for this styling. The rule applies automatically to Montage fields in both apps, including dialogs rendered in portals.
- SearchField in Montage 4.1.5 does not provide the same focus ring. Search inputs, native fields and other controls must retain their own focus indication; do not broaden the reset to all inputs.
- Existing native onboarding fields and reference/demo UIs keep their own styling. This integration does not turn a native input into a Montage component.

## Shared actions and selects

- Use `ActionButton` from `@futures-medialab/ui/action-button` for standard actions. `intent` is `primary`, `secondary`, `danger` or `text`; use `size`, `disabled`, `loading` and `iconOnly` instead of recreating these states in page CSS. It delegates to Montage `Button`/`TextButton`, preserves explicit accessible names, and defaults to `type="button"`. Set `type="submit"` for form submission.
- Existing `AdminButton` and themed `WorkspaceButton` are compatibility adapters to the same component. They preserve the older forms' submit default and translate existing primary/danger class names into explicit intents. Page classes may still control layout, but must not repaint the button's colors, borders or hover/disabled states.
- Use `FormSelect` from `@futures-medialab/ui/form-select` when migrating a native single-select or when native form semantics are needed. Pass option arrays/fragments directly, rather than wrapping options in a separate React component. It accepts native `<option>`/`<optgroup>` children, numeric or string values, a real `ChangeEvent<HTMLSelectElement>`, `name`, `required`, `defaultValue` and refs. The visible trigger/menu are Montage `Select`/`Option`; one visually hidden native select preserves FormData, validation and labels. Disabled fieldsets also disable the menu, including an already open menu. Menus inside native modal dialogs stay in the dialog’s top layer so they remain clickable. Reset restores uncontrolled defaults without emitting change events; controlled values continue to follow their props.
- Direct Montage controls remain appropriate for value-based handlers, grouped form controls, links, chips, checkboxes, radios and tabs. The shared stylesheet covers their select focus treatment and portalled menu typography; do not reimplement Montage visual states in individual pages.
- `montage-controls.css` owns common content/icon alignment, native-select integration, menu typography and action keyboard outlines. `montage-fields.css` preserves the library's rounded input/textarea/select focus ring, with a visible outline in forced-colors mode.

### Consolidation scope (2026-11-08)

Standard actions in admin and the brand/agency workspace use the shared action adapter. Native single-selects in the existing admin and advertiser screens use `FormSelect`. Repeated button skins and select appearance rules were removed; layout rules remain local.

Youdao reproductions, archived design explorations and the onboarding region/country cascader retain their purpose-specific controls. Row/card navigation, custom tab interactions and the language menu are not ordinary form actions and retain their existing behavior. The old Tailwind `./button` export has no current app consumers; use Montage or `./action-button` for new service screens.
