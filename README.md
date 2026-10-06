# Creatie® Portfolio Replica

Pixel-accurate local mirror of `https://creatiie.framer.website/` using the published Framer render tree, original responsive variants, and original motion runtime.

## Run locally

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

Then open `http://127.0.0.1:4173/`.

## Main files

- `index.html` — exact Framer-rendered main entry, with the requested Framer branding badge hidden
- `exact-framer.html` — preserved mirror source used for comparison
- `index-handcrafted.html` — previous handcrafted approximation, retained as a backup
- `assets/` — downloaded original raster assets
- `styles.css` and `app.js` — supporting files for the retained handcrafted backup

## Included behavior

- Original fixed-viewport virtual scrolling architecture
- Original Framer Motion transitions and responsive variants
- Original macOS-style dock magnification and tooltips
- Original canvas/interactive decorative elements
- Original project-card choreography, testimonials, FAQs, and footer scene
- Desktop, tablet, and mobile breakpoints from the published page

The exact version loads the original published Framer runtime modules, fonts, and responsive image variants from `framerusercontent.com`, so an internet connection is required for full fidelity.
