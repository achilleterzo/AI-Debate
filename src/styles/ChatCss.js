/**
 * Single source of truth for how a chat message looks.
 *
 * The live chat injects it once from <GlobalStyles> (Style.jsx); the HTML export
 * inlines the very same string inside its own <style> tag. Anything a balloon,
 * a tool pill or a dice note needs must live here — not in a component's inline
 * styles — otherwise the export drifts away from the chat again.
 *
 * Everything that changes per participant travels through custom properties set
 * on the element itself, so the rules below stay static:
 *
 *   --balloon-bg / --balloon-border / --balloon-radius   balloon chrome
 *   --dice-bg / --dice-border / --dice-label             dice note chrome
 *   --label-color                                        name above a balloon
 */
export const CHAT_CSS = `
	/* ── markdown inside any rendered message ────────────────────────────── */
	.bubble p { margin: 0 0 .6em; }
	.bubble p:last-child { margin-bottom: 0; }
	.bubble ul, .bubble ol { margin: .4em 0 .6em 1.4em; padding: 0; }
	.bubble li { margin-bottom: .2em; }
	.bubble h1, .bubble h2, .bubble h3, .bubble h4 {
		margin: .7em 0 .3em; font-size: 1em; font-weight: 700; color: #fff;
	}
	.bubble code {
		font-family: var(--mono, ui-monospace, Consolas, monospace); font-size: .85em;
		background: #0f0f0f; border: 1px solid #2e2e2e;
		border-radius: 3px; padding: 1px 5px;
	}
	.bubble pre {
		background: #0f0f0f; border: 1px solid #2e2e2e;
		border-radius: 6px; padding: 10px 12px;
		overflow-x: auto; margin: .5em 0;
	}
	.bubble pre code { background: none; border: none; padding: 0; font-size: .82em; }
	.bubble blockquote {
		border-left: 3px solid #444; margin: .4em 0;
		padding: 2px 10px; color: #999;
	}
	.bubble strong { color: #fff; }
	.bubble em { color: #ccc; }
	.bubble a { color: #a78bfa; }
	.bubble hr { border: none; border-top: 1px solid #333; margin: .6em 0; }
	.bubble table { border-collapse: collapse; margin: .5em 0; font-size: .9em; }
	.bubble th, .bubble td { border: 1px solid #333; padding: 4px 10px; }
	.bubble th { background: #1e1e1e; text-align: left; }

	/* ── the balloon itself ──────────────────────────────────────────────── */
	.balloon {
		position: relative;
		display: block;
		width: 100%;
		box-sizing: border-box;
		min-width: 48px;
		min-height: 20px;
		padding: 10px 14px;
		font-size: 14px;
		line-height: 1.65;
		color: #e0e0e0;
		word-break: break-word;
		background: var(--balloon-bg, #1e1e1e);
		border: 1px solid var(--balloon-border, #333);
		border-radius: var(--balloon-radius, 12px);
	}

	/* Comic-style tail on the one square corner the balloon radius leaves open.
	   It is a square rotated 45°, carrying a real 1px border on the two edges
	   that end up facing outwards, so the outline keeps the balloon's own width
	   and colour all the way to the tip. It sits *in front* of the balloon: the
	   half that overlaps is filled with the balloon colour and hides the border
	   segment underneath, which is what welds the tail to the corner. */
	.balloon-tail-left::after,
	.balloon-tail-right::after {
		content: '';
		position: absolute;
		/* Half the diagonal is 8.5px, so this drops the square's lower corner
		   right onto the balloon's bottom edge: the tail never hangs below the
		   line, and its tip reaches ~7.5px past the side. */
		bottom: 2px;
		width: 12px;
		height: 12px;
		box-sizing: border-box;
		background: var(--balloon-bg, #1e1e1e);
		border-top: 1px solid var(--balloon-border, #333);
		pointer-events: none;
	}
	.balloon-tail-left::after {
		left: -5px;
		border-left: 1px solid var(--balloon-border, #333);
		transform: rotate(-45deg);
	}
	.balloon-tail-right::after {
		right: -5px;
		border-right: 1px solid var(--balloon-border, #333);
		transform: rotate(45deg);
	}

	/* Everything a turn is made of stacks in one column: tool pills, dice
	   notes, the balloon and its follow-ups, all pushed to the participant's
	   own side of the timeline. */
	.balloon-group {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 4px;
		align-items: var(--group-align, flex-end);
		width: 100%;
	}

	/* ── name above the balloon, round separator ─────────────────────────── */
	.msg-label {
		display: inline-flex; align-items: center; gap: 6px;
		font-size: 11px; font-weight: 700; letter-spacing: .5px;
		text-transform: uppercase; margin-bottom: 4px;
		color: var(--label-color, #888);
	}
	.msg-label-round { font-weight: 400; color: #555; text-transform: none; }
	.turn-badge {
		font-size: 11px; color: #555; text-align: center;
		margin: 2px 0; letter-spacing: .5px; user-select: none;
	}

	/* ── tool invocations ────────────────────────────────────────────────── */
	.tool-pill {
		max-width: 100%; box-sizing: border-box;
		padding: 4px 8px;
		border: 1px solid #514a78; border-radius: 8px;
		background: #171624;
		color: #aaa; font-size: 10px; line-height: 1.35;
		box-shadow: 0 0 8px rgba(139, 92, 246, .22), inset 0 0 7px rgba(139, 92, 246, .08);
	}
	.tool-pill-icon { margin-right: 5px; }
	.tool-pill-name { color: #aaa; }
	.tool-pill-details { color: #666; }

	/* ── dice results ────────────────────────────────────────────────────── */
	.dice-note {
		max-width: 100%; box-sizing: border-box;
		padding: 7px 14px;
		background: var(--dice-bg, #17152a);
		border: 2px dashed var(--dice-border, #514a78);
		border-radius: 12px;
		box-shadow: inset 0 0 0 1px var(--dice-glow, #514a7844);
		color: #e0e0e0; font-size: 12px;
	}
	.dice-note-owner { font-weight: 700; margin-right: 7px; color: var(--dice-label, #c9bfff); }

	/* ── moderation ──────────────────────────────────────────────────────── */
	.balloon-moderation {
		background: #2a1010;
		border: 2px dashed #ef4444cc;
		box-shadow: inset 0 0 0 1px #ef444433;
		border-radius: 12px;
	}
	.moderation-badge {
		display: inline-flex; align-items: center;
		background: #2a1010; border: 1px solid #ef444455;
		border-radius: 999px; padding: 2px 8px;
		font-size: 10px; color: #ef4444; font-weight: 700;
		letter-spacing: .4px; text-transform: uppercase; margin-bottom: 6px;
	}

	/* ── presence events ─────────────────────────────────────────────────── */
	.presence-chip {
		display: inline-flex; align-items: center; gap: 8px;
		border-radius: 20px; padding: 5px 14px;
		font-size: 11px; letter-spacing: .3px;
	}
	.presence-chip-joined { background: #121a12; border: 1px solid #2a7a2a44; color: #55aa55; }
	.presence-chip-left { background: #1a1212; border: 1px solid #7a2a2a44; color: #aa5555; }
	.presence-chip-arrow { opacity: .6; }
	.presence-chip-name { font-weight: 700; color: var(--label-color, #888); }
`
