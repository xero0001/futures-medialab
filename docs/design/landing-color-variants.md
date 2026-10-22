# Landing color previews

The original `/` and `/landing` remain unchanged. `/landing-chzzk` uses a charcoal-and-mint palette inspired by the public CHZZK interface; `/chzzk-light` is its bright mint counterpart. `/landing-orange` uses white surfaces, neutral charcoal typography, orange actions, and blue/mint supporting components, informed by the public Youdao Ads landing page and the user's request to remove yellow/cream backgrounds. All three reuse the original landing content, interactions, logo shape, and unmodified game thumbnails. All palette overrides are scoped to `data-theme`.

## Hero artwork

Created with the built-in image generation tool, editing `apps/platform/public/landing/creator-world.webp`. The two results were converted to WebP (quality 88) without cropping or recoloring after generation.

- Mint: `apps/platform/public/landing/creator-world-chzzk.webp`
- Original orange (retained, no longer displayed): `apps/platform/public/landing/creator-world-orange.webp`
- Light mint: `apps/platform/public/landing/creator-world-chzzk-light.webp`
- White/orange with blue and mint: `apps/platform/public/landing/creator-world-orange-white.webp`

### Shared prompt

Use case: style-transfer. Asset type: 3D website hero illustration. Image 1 is the edit target. Keep all object shapes, arrangement, camera, proportions and landscape 3:2 composition exactly as the original: floating game controller, play-button tile, megaphone, orbit ribbon, spheres and small stars above a low pedestal. Change only colors, material tint, background and lighting. No added objects, no text, no logos, no watermark.

### Mint addition

Create the dark mint variant: near-black charcoal background #171c1b with a subtle emerald glow. Controller, megaphone and play tile in rich graphite and vivid mint green #00ffa3; polished pale mint accents and silver specular highlights; orbit ribbon translucent jade glass. Pedestal graphite with mint edge illumination. Crisp premium gaming aesthetic, readable silhouettes. All image edges should smoothly match the dark charcoal background; absolutely no lavender or blue colors.

### Orange addition

Create the warm orange variant: light warm cream background #fff0e4. Controller and megaphone vivid tangerine orange with burnt-orange controls, play tile apricot orange with an ivory play triangle. Orbit ribbon translucent warm amber glass, small stars copper and cream, pedestal pale apricot. Soft bright studio lighting, joyful premium material finish. All image edges should smoothly match the warm cream background; absolutely no lavender or blue colors.

### Light mint revision — edit mode

Input: `creator-world-chzzk.webp`. Output converted to WebP at quality 88, with no subsequent cropping or recoloring.

Use case: style-transfer. Asset type: light-theme 3D landing-page hero illustration. Image 1 is the edit target. Keep the exact landscape 3:2 composition, object shapes, placement, camera angle and proportions: floating game controller, play-button tile, megaphone, looping orbital ribbon, stars and spheres above a low round pedestal. Change only materials, colors, background and lighting into a bright light-mint variant. Background is very pale mint near white #edfff6, with all edges fading gently to that same color. The controller is porcelain white with dark graphite thumbsticks and directional pad, bright vivid mint #00e99a face buttons and emerald edge details. The megaphone is glossy fresh mint green with ivory edges, the play tile is transparent mint glass with an ivory play triangle. Ribbon is translucent jade glass, small stars pale mint and polished silver. Pedestal white with subtle mint trim. Soft daylight studio lighting, gentle shadows, clean friendly premium gaming mood, readable silhouettes. No dark environment, no added objects, no lavender, no orange, no text, no logos, no watermark.

### White/orange revision — edit mode

Input: `creator-world-orange.webp`. Output converted to WebP at quality 88, with no subsequent cropping or recoloring.

Use case: style-transfer. Asset type: 3D website hero illustration on a clean WHITE landing page. Image 1 is the edit target. Preserve the exact landscape 3:2 composition, object shapes, arrangement, camera and proportions: floating game controller, play-button tile, megaphone, looping orbit ribbon, spheres and stars above a low pedestal. Change only color, material tint, backdrop and lighting. Replace the entire yellow/beige/cream background with pure neutral white #ffffff, including all corners and edges. Neutral daylight studio lighting with soft neutral gray contact shadows, absolutely no warm color cast or yellow wash. Controller shell clean porcelain white with punchy orange grips and face buttons, dark graphite sticks and directional pad. Megaphone vivid orange with white interior and pale mint rim. Play-button tile saturated royal blue with a white play triangle. Orbital ribbon translucent mint/jade glass rather than yellow glass. Stars and small spheres alternate fresh mint, cobalt blue and small orange accents. Pedestal clean white with subtle neutral gray shading. Orange remains the main energetic accent, balanced by white space and blue/mint supporting details. Bright, clean, premium playful gaming scene. No cream, beige, gold, brown or amber surfaces. No text, logos, watermark or extra objects.

## Checks

Check both desktop and mobile layouts, locale switching, category filters, campaign dialogs, FAQ, and comparison links. Navigate from a themed route back to `/` to check that loaded theme CSS cannot leak into the original page. These routes intentionally carry `noindex, nofollow` while used as design previews.
