# Iso-glow 3D models

Redraws of the portfolio's 3D stations in the iso-glow style (dark hairline
drawing, one accent colour on whatever is live), built on the iso-glow skill's
three.js shell (MIT, see `LICENSE`).

| Model | Source | Page |
| --- | --- | --- |
| GPU training cluster (IBM–Illinois station) | `gpu-cluster.fig3d.js` | `/lab/gpu-cluster.html` |

The page in `public/lab/` is generated: the skill's `assets/gallery-3d.html`
with the figure module pasted into its `FIGS3D` slot. Edit the `.fig3d.js`
file, then rebuild the page with the assemble command from the skill.

Controls: space trains, click a node or press 1–4 to pull its power, R resets.
