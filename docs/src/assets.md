# src/assets/provider-logos

Provider marks used by the interface, one SVG per provider: `ollama.svg`, `openrouter.svg`, `gemini.svg`, `codex.svg` (also used for OpenAI), `claude-code.svg`.

**Notes**

- Imported as modules by `components/EndpointModelGroup.jsx` (the icon on the left cap of each participant's model select) and by `components/ProviderSettings.jsx` (the tabs of the providers dialog). The `PROVIDER_ICONS` map in `EndpointModelGroup` is the one place a provider id is bound to a logo, so a new provider needs one file and one entry there.
- Ollama Cloud reuses `ollama.svg`, because it is the same brand; the cloud and local endpoints are distinguished by their reachability badge, not by the icon.
- There is no logo for a custom local endpoint: those are shown with the generic provider button.

# src/assets

Also in this folder, not documented file by file: `hero.png` (the raster mark used outside the app), `react.svg` and `vite.svg`, which are left over from the Vite template and are not referenced by the application code.

**Note** — The splash screen and the import notice do **not** use these files: their icons are inlined SVG inside the components, because the desktop bundle is loaded over `file://` and an asset path would be something to resolve at run time (`components/SplashScreen.jsx`, `components/ImportNoticeModal.jsx`).
