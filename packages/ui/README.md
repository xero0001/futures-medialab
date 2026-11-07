# Shared UI

Platform and admin both import `@futures-medialab/ui/globals.css` from their root stylesheets.

## Montage form fields

- Use `TextField` and `TextArea` from the installed `@montage-ui/core` library for standard text inputs. Use library props for size, validation status, disabled state and content; keep page CSS focused on layout.
- `src/styles/montage-fields.css`, loaded by the shared globals, prevents native focus outlines from duplicating the library's rounded focus border and ring. It also supplies a wrapper outline in forced-colors mode, where box shadows are hidden.
- Do not add per-page `input`/`textarea` outline resets or another wrapper component just for this styling. The rule applies automatically to Montage fields in both apps, including dialogs rendered in portals.
- SearchField in Montage 4.1.5 does not provide the same focus ring. Search inputs, native fields and other controls must retain their own focus indication; do not broaden the reset to all inputs.
- Existing native onboarding fields and reference/demo UIs keep their own styling. This integration does not turn a native input into a Montage component.
