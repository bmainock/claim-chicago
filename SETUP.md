# Claim Chicago setup

The site works without setup in device-only demo mode. For shared live claims:

1. Create a free Firebase project and add a Web app.
2. Create a Realtime Database, then publish the contents of `firebase-rules.json` in its Rules tab.
3. Paste the Web app configuration object into `firebase-config.js` in place of `null`.
4. Publish the repository with GitHub Pages (Settings → Pages → Deploy from branch → `main` / root).

Firebase configuration values are public identifiers, not passwords. The included database rules validate claim shape, but device IDs are not secure authentication. For a public competitive game, add Firebase Authentication before launch so ownership cannot be impersonated.

Browser alerts work while the site is open. True background phone push requires Firebase Cloud Messaging, a service worker, and a trusted server or Cloud Function that sends the notification when a claim changes.

Neighborhood point values come from `chicago_neighborhood_points_rated.xlsx`. The web-readable copy is stored in `neighborhood-points.js`; update both files together if the scoring changes.
