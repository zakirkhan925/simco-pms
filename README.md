# SIMCO PMS

Construction project management system. Postgres on Supabase, front end served
from `docs/` by GitHub Pages at pms.simcodevelopers.com.

## Layout

    docs/      what GitHub Pages serves (the built front end)
    site/      the front-end build: build.ts inlines the Apps Script screens
               (src/*.html) into docs/index.html, bridge.js replaces the
               google.script.run bridge, port.js greys out unported modules
    migrate/   one-off scripts for the move off Google Sheets
    src/       application source

`docs/CNAME` holds the custom domain. GitHub Pages reads it on every deploy, so
it must stay in place or the domain reverts to the github.io address.
