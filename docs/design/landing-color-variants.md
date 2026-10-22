# Landing color previews

The original `/` and `/landing` remain unchanged. `/landing-chzzk` uses a charcoal-and-mint palette inspired by the public CHZZK interface; `/landing-orange` uses cream and warm orange. Both reuse the original landing content, interactions, logo shape, and unmodified game thumbnails. All palette overrides are scoped to `data-theme`.

## Hero artwork

Created with the built-in image generation tool, editing `apps/platform/public/landing/creator-world.webp`. The two results were converted to WebP (quality 88) without cropping or recoloring after generation.

- Mint: `apps/platform/public/landing/creator-world-chzzk.webp`
- Orange: `apps/platform/public/landing/creator-world-orange.webp`

### Shared prompt

Use case: style-transfer. Asset type: 3D website hero illustration. Image 1 is the edit target. Keep all object shapes, arrangement, camera, proportions and landscape 3:2 composition exactly as the original: floating game controller, play-button tile, megaphone, orbit ribbon, spheres and small stars above a low pedestal. Change only colors, material tint, background and lighting. No added objects, no text, no logos, no watermark.

### Mint addition

Create the dark mint variant: near-black charcoal background #171c1b with a subtle emerald glow. Controller, megaphone and play tile in rich graphite and vivid mint green #00ffa3; polished pale mint accents and silver specular highlights; orbit ribbon translucent jade glass. Pedestal graphite with mint edge illumination. Crisp premium gaming aesthetic, readable silhouettes. All image edges should smoothly match the dark charcoal background; absolutely no lavender or blue colors.

### Orange addition

Create the warm orange variant: light warm cream background #fff0e4. Controller and megaphone vivid tangerine orange with burnt-orange controls, play tile apricot orange with an ivory play triangle. Orbit ribbon translucent warm amber glass, small stars copper and cream, pedestal pale apricot. Soft bright studio lighting, joyful premium material finish. All image edges should smoothly match the warm cream background; absolutely no lavender or blue colors.

## Checks

Check both desktop and mobile layouts, locale switching, category filters, campaign dialogs, FAQ, and comparison links. Navigate from a themed route back to `/` to check that loaded theme CSS cannot leak into the original page. These routes intentionally carry `noindex, nofollow` while used as design previews.
