/* eslint-disable react-refresh/only-export-components */
import { CHAT_CSS } from '../styles/ChatCss'

export const styles = {
	app: { display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' },

	header: {
		background: '#1a1a1a',
		display: 'flex',
		flexDirection: 'column',
		position: 'relative',
		zIndex: 120,
	},
	headerTop: { display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '8px', padding: '10px 16px', background: '#242424', borderBottom: '1px solid #2e2e2e' },
	headerBody: {
		padding: '12px 16px',
		display: 'flex',
		flexDirection: 'column',
		gap: '10px',
		overflowY: 'auto',
		overflowX: 'hidden',
	},
	// Shared by the summary, attachments/context and affinity rows so they keep
	// the same height even though their tallest control differs (a 28px model
	// select on one, a 16px switch on the others). minHeight rather than height:
	// these rows wrap on narrow windows and must be free to grow.
	settingsRow: {
		display: 'flex',
		alignItems: 'center',
		gap: 10,
		minHeight: 32,
		padding: '2px 0',
	},
	title: { fontSize: '15px', fontWeight: 700, color: '#e0e0e0' },
	dot: (ok) => ({
		width: 8, height: 8, borderRadius: '50%',
		background: ok === null ? '#888' : ok ? '#4ade80' : '#f87171',
		flexShrink: 0,
	}),

	// ── endpoint row ──
	endpointRow: {
		display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap',
	},
	endpointLabel: { fontSize: 12, color: '#888', whiteSpace: 'nowrap' },
	endpointInput: {
		flex: 1, minWidth: 180,
		background: '#0f0f0f', color: '#e0e0e0',
		border: '1px solid #2e2e2e', borderRadius: 6,
		padding: '5px 10px', fontSize: 13, outline: 'none', fontFamily: 'inherit',
	},
	endpointInputErr: {
		flex: 1, minWidth: 180,
		background: '#0f0f0f', color: '#e0e0e0',
		border: '1px solid #f8717188', borderRadius: 6,
		padding: '5px 10px', fontSize: 13, outline: 'none', fontFamily: 'inherit',
	},
	connectBtn: (loading) => ({
		background: loading ? '#2e2e2e' : '#334155',
		color: loading ? '#555' : '#e0e0e0',
		border: '1px solid #3e4a5a',
		borderRadius: 6, padding: '5px 12px',
		fontSize: 12, fontWeight: 600,
		cursor: loading ? 'wait' : 'pointer',
		whiteSpace: 'nowrap',
	}),
	errText: { fontSize: 11, color: '#f87171' },
	modelCount: { fontSize: 11, color: '#4ade80' },

	modelRow: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' },
	modelBox: (letter) => ({
		flex: 1, minWidth: 180,
		display: 'flex', alignItems: 'center', gap: '6px',
		background: letter === 'A' ? '#1c1c2e' : '#1c2e1c',
		border: `1px solid ${letter === 'A' ? '#7c6aff44' : '#4ade8044'}`,
		borderRadius: 8, padding: '6px 10px',
	}),
	modelLabel: (letter) => ({
		fontSize: 12, fontWeight: 700, letterSpacing: 1,
		color: letter === 'A' ? '#a78bfa' : '#4ade80',
		minWidth: 20,
	}),
	nameInput: {
		width: 120, background: '#0f0f0f', color: '#e0e0e0',
		border: '1px solid #2e2e2e', borderRadius: 6,
		padding: '4px 8px', fontSize: 12, outline: 'none',
	},

	controlRow: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' },
	label: { fontSize: 12, color: '#888' },
	numInput: {
		width: 60, background: '#0f0f0f', color: '#e0e0e0',
		border: '1px solid #2e2e2e', borderRadius: 6,
		padding: '4px 8px', fontSize: 13, outline: 'none', textAlign: 'center',
	},
	hint: { fontSize: 11, color: '#555' },
	dropdownItem: {
		display: 'block', width: '100%', background: 'none', border: 'none',
		color: '#e0e0e0', padding: '8px 16px', textAlign: 'left',
		cursor: 'pointer', fontSize: 13, borderRadius: 6,
		transition: 'background 0.1s',
	},
	dropdownItemDanger: {
		display: 'block', width: '100%', background: 'none', border: 'none',
		color: '#f87171', padding: '8px 16px', textAlign: 'left',
		cursor: 'pointer', fontSize: 13, borderRadius: 6,
		transition: 'background 0.1s',
	},

	messages: {
		flex: 1, overflowY: 'auto', padding: '16px',
		display: 'flex', flexDirection: 'column', gap: '10px',
		minHeight: 0,
	},
	msgWrap: () => ({
		display: 'flex', flexDirection: 'column',
		alignSelf: 'stretch',
		width: '100%', boxSizing: 'border-box',
	}),
	balloonWrap: (actor) => ({
		position: 'relative',
		width: '82%',
		alignSelf: actor ? (actor.id % 2 === 0 ? 'flex-start' : 'flex-end') : 'flex-end',
	}),
	floatBtns: (actor) => ({
		position: 'absolute',
		top: 6,
		...(actor && actor.id % 2 !== 0 ? { left: -30 } : { right: -30 }),
		display: 'flex',
		flexDirection: 'column',
		gap: 4,
	}),
	floatBtn: (active) => ({
		width: 22, height: 22,
		display: 'flex', alignItems: 'center', justifyContent: 'center',
		background: active ? '#4ade8033' : '#00000066',
		border: `1px solid ${active ? '#4ade80aa' : '#ffffff22'}`,
		borderRadius: 5, cursor: 'pointer',
		fontSize: 12, color: active ? '#4ade80' : '#aaa',
		transition: 'all 0.15s',
		opacity: 0,
		backdropFilter: 'blur(2px)',
	}),
	// Chrome, typography and tail all live in .balloon (styles/ChatCss.js); what
	// stays here are the per-participant colours the stylesheet reads back out
	// of these custom properties — the tail included, so it always matches the
	// balloon it hangs off. Pair with className="bubble balloon".
	bubble: (role, actor) => ({
		'--balloon-bg': role === 'user' ? '#2a1f1f' : (actor?.bg ?? '#1e1e1e'),
		'--balloon-border': role === 'user' ? '#f97316aa' : (actor?.border ?? '#333'),
		'--balloon-radius': role === 'user' ? '12px 12px 2px 12px' : (actor?.radiusOwn ?? '8px'),
	}),
	// Pair with className="msg-label".
	roleTag: (role, actor) => ({
		'--label-color': role === 'user' ? '#f97316' : (actor?.label ?? '#888'),
		alignSelf: actor ? (actor.id % 2 === 0 ? 'flex-start' : 'flex-end') : 'flex-end',
	}),

	empty: {
		flex: 1, display: 'flex', alignItems: 'center',
		justifyContent: 'center', color: '#333', fontSize: 14, userSelect: 'none',
	},

	inputArea: {
		padding: '12px 16px', borderTop: '1px solid #2e2e2e',
		display: 'flex', gap: '8px', background: '#1a1a1a', alignItems: 'stretch',
	},
	textarea: {
		flex: 1, background: '#0f0f0f', color: '#e0e0e0',
		border: '1px solid #2e2e2e', borderRadius: 8,
		padding: '10px 12px', fontSize: 14, resize: 'none',
		outline: 'none', fontFamily: 'inherit', lineHeight: 1.5,
		minHeight: 44, maxHeight: 160,
	},
	btn: (color, disabled) => ({
		background: disabled ? '#2e2e2e' : color,
		color: disabled ? '#555' : '#fff',
		border: 'none', borderRadius: 8,
		padding: '0 16px', fontSize: 13,
		cursor: disabled ? 'not-allowed' : 'pointer',
		fontWeight: 700, height: 44,
		transition: 'background 0.15s',
		whiteSpace: 'nowrap',
	}),
};

export const moodSelectStyles = {
	container: b => ({ ...b, width: 170 }),
	control: (b, state) => ({
		...b,
		background: '#0f0f0f',
		textAlign: 'left',
		borderColor: state.isFocused ? '#555' : '#2e2e2e',
		borderRadius: 6,
		minHeight: 28,
		boxShadow: 'none',
		cursor: 'pointer',
		'&:hover': { borderColor: '#555' },
	}),
	valueContainer: b => ({ ...b, padding: '0 8px' }),
	singleValue: b => ({ ...b, color: '#aaa', fontSize: 11, display: 'flex', alignItems: 'center', gap: 8 }),
	option: (b, state) => ({
		...b,
		background: state.isSelected ? '#2a2a2a' : state.isFocused ? '#1e1e1e' : '#0f0f0f',
		color: state.isSelected ? '#e0e0e0' : '#aaa',
		fontSize: 11,
		display: 'flex', alignItems: 'center', gap: 8,
		cursor: 'pointer',
		padding: '6px 10px',
	}),
	menu: b => ({ ...b, background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: 6, zIndex: 100 }),
	menuList: b => ({ ...b, padding: 2 }),
	indicatorSeparator: () => ({ display: 'none' }),
	dropdownIndicator: b => ({ ...b, color: '#444', padding: '0 6px', '&:hover': { color: '#888' } }),
	input: b => ({ ...b, color: '#aaa', margin: 0, padding: 0 }),
}

export function formatMoodOption({ emoji, label }) {
	return (
		<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
			<span style={{ width: 20, textAlign: 'center', flexShrink: 0 }}>{emoji}</span>
			<span>{label}</span>
		</span>
	)
}

export const modelSelectStyles = {
	container: b => ({ ...b, flex: 1, minWidth: 0 }),
	control: (b, state) => ({
		...b,
		background: '#0f0f0f',
		borderColor: state.isFocused ? '#555' : '#2e2e2e',
		borderRadius: 6,
		minHeight: 28,
		boxShadow: 'none',
		cursor: state.isDisabled ? 'default' : 'pointer',
		opacity: state.isDisabled ? 0.5 : 1,
		'&:hover': { borderColor: state.isDisabled ? '#2e2e2e' : '#555' },
	}),
	singleValue: (b, state) => ({ ...b, color: state.isDisabled ? '#444' : '#e0e0e0', fontSize: 12, textAlign: 'left' }),
	placeholder: (b, state) => ({ ...b, color: state.isDisabled ? '#333' : '#444', fontSize: 12, textAlign: 'left' }),
	valueContainer: b => ({ ...b, padding: '0 8px', flexWrap: 'nowrap', justifyContent: 'flex-start', textAlign: 'left' }),
	option: (b, state) => ({
		...b,
		background: state.isSelected ? '#2a2a2a' : state.isFocused ? '#1e1e1e' : '#0f0f0f',
		color: state.isSelected ? '#e0e0e0' : '#aaa',
		fontSize: 12,
		textAlign: 'left',
		cursor: 'pointer',
		padding: '5px 10px',
		whiteSpace: 'nowrap',
		overflow: 'hidden',
		textOverflow: 'ellipsis',
	}),
	menu: b => ({ ...b, background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: 6, zIndex: 100 }),
	menuList: b => ({ ...b, padding: 2 }),
	indicatorSeparator: () => ({ display: 'none' }),
	dropdownIndicator: b => ({ ...b, color: '#444', padding: '0 6px', '&:hover': { color: '#888' } }),
	input: b => ({ ...b, color: '#e0e0e0', margin: 0, padding: 0, fontSize: 12, textAlign: 'left' }),
	clearIndicator: b => ({ ...b, color: '#444', padding: '0 4px', '&:hover': { color: '#888' } }),
}

export function GlobalStyles() {
	return (
		<style>{`
			@keyframes blink{0%,80%,100%{opacity:.2}40%{opacity:1}}
			@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
			@keyframes reasoningGlow{0%,100%{text-shadow:0 0 2px #8b7cf655}50%{text-shadow:0 0 9px #c4b5fd}}
			.balloon-group:hover .float-btn { opacity: 1 !important; }

			${CHAT_CSS}
			input[type="number"] {
				color-scheme: dark;
				accent-color: #8b7cf6;
				-moz-appearance: textfield;
				appearance: textfield;
			}
			input[type="number"]:focus {
				border-color: #555 !important;
				box-shadow: 0 0 0 2px #8b7cf622;
			}
			input[type="number"]::-webkit-inner-spin-button,
			input[type="number"]::-webkit-outer-spin-button {
				display: none;
			}
			a { color: #a78bfa; }
			a:visited { color: #c4b5fd; }
		`}</style>
	)
}
