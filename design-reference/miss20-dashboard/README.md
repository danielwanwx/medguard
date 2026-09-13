# miss-20 dashboard style — REFERENCE ONLY (do not ship as-is)

This is the visual style the user liked from the prior "The Missing 20" LogisticPilot prototype,
kept here so you (Codex) can see it. It is a REFERENCE for look & feel (spacing, cards, color,
type, the order-journey/handoff/impact layout), NOT the MedGuard product.

- `styles.css` — the full dashboard design-system CSS (fonts, cards, KPI strip, journey steps,
  events rail, impact card, benchmark section, drawers, badges).
- `App.jsx` — the component anatomy that produced that dashboard (structure reference).
- `dashboard-look-*.jpg`, `investigation-look.jpg` — screenshots of the target look.

How to use: borrow the craft (card system, spacing rhythm, KPI/journey/impact framing, the clean
green/neutral palette, the source-badge + evidence-drawer patterns) and adapt it to MedGuard's
consumer, app-like direction. Keep MedGuard wired to the real backend (POST /api/medcheck).
