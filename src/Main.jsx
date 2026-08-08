import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
// Bundled with the app rather than left to the platform: the emoji the chat
// draws its own furniture with — tool pills, dice, the moderator marker — must
// look the same on every machine, and the desktop build has no network to fetch
// a font from. The stylesheet declares one @font-face per unicode range, so a
// session only ever loads the ranges it actually shows.
import '@fontsource/noto-color-emoji'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
