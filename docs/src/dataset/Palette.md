# src/dataset/Palette.js

**Role** — The participants' colours, and the letter each one is tagged with.

**Notes**

- Ten entries, `A`–`J`. Each carries the balloon's `border`, `bg` and `label` colours plus two corner-radius sets — `radiusOwn` and `radiusOther` — so the same palette gives the "tail" on the left or on the right depending on who is speaking.
- The tag letter is what a participant is called in the payload (`[A]`, `[B]`) and in the citation cards, so the order of this array is user-visible: inserting an entry in the middle re-letters everyone after it.
- The colours are applied through the CSS custom properties defined in `styles/ChatCss.js`, which is why the chat and the export cannot disagree about a participant's colour.
