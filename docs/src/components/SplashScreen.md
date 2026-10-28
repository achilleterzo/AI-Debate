# src/components/SplashScreen.jsx

**Role** — The welcome screen: logo, version, a short orientation, and the "show at startup" checkbox.

**Notes**

- The logo is **inlined SVG** on purpose: the build uses a relative base and the desktop bundle is loaded over `file://`, so an asset path would be a thing to resolve at run time and to get wrong.
- The version comes from `APP_VERSION` (re-exported by `hooks/useUpdateCheck.js`), so the splash and the update check can never disagree.
- Visibility and the "show at startup" preference are handled by `hooks/useSplashScreen.js`, whose whole point is that unticking the box saves the choice for the next launch without closing the screen being read.
- Opened manually from the top menu as well as automatically at startup.
- Exercises: `tests/SplashPreference.test.js`.
