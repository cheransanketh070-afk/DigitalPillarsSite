# Digital Pillars

Cinematic fixed-viewport agency experience built with semantic HTML, CSS 3D and native WebGL.

## Structure
- index.html — five-scene presentation shell.
- css/styles.css + css/v4.css — visual and motion layers.
- js/world.js — native WebGL environment, particles and procedural geometry.
- js/app.js — scene navigation, interactions, FAQ, reviews and project brief.
- services/ — dedicated service layers.
- scripts/validate.mjs — dependency-free production validation.

## Services
Performance / paid social, social presence, digital experiences, brand strategy, creator partnerships and consulting.

## Deployment
Static site. Vercel can deploy it with no framework preset; build command: npm run build; output: repository root.

## Production safeguards
The build validates required routes and JavaScript syntax. Runtime includes WebGL diagnostics, visibility-aware rendering, reduced-motion handling and a WebGL fallback.

The supplied ZIP was used as a source/reference package for this production pass. The current main experience intentionally keeps its primary visual layer procedural rather than depending on pasted raster imagery.
