# src/components/HeaderTop.jsx

**Role** — The bar at the top of the app: connection state, update badge, and the menu with every session command.

**Notes**

- A presentational component: it receives callbacks (`onSaveSnapshot`, `onLoadSnapshot`, `onNewChat`, `onFork`, `onOpenWizard`, `onOpenPromptSettings`, `onOpenSplash`, `exportItems`, `onOpenConnection`) and owns no state beyond what a menu needs.
- `exportItems` is passed in as a list rather than hard-coded, so the export formats are decided where the data lives (`data/Data.js`) and the header only shows them.
- `ollamaOk` / `modelsCount` drive the connection indicator; `updateAvailable` drives the release badge from `hooks/useUpdateCheck.js`.
- `canFork` and the wide-layout flags decide which commands are offered at all — a command that cannot work right now is not shown disabled and explained.
- The layout is a three-column grid (`1fr auto 1fr`), which is what keeps the title centred regardless of the two sides' content.
