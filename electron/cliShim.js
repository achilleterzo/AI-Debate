import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

/**
 * The program an npm `.cmd` shim actually calls.
 *
 * Spawning the shim means spawning cmd.exe, and on Windows that flashes a
 * console window on every status check, every model listing and every turn —
 * a debate is one window per turn. The shim is a few lines of batch around a
 * single executable, or around a script run through Node, which Electron
 * itself provides. Calling that target directly keeps the window from ever
 * existing, and leaves the console to the one command that wants one: the
 * interactive login.
 *
 * Returns null when there is nothing to unwrap — not a shim, unreadable, or a
 * target that is no longer on disk — and the caller falls back to cmd.exe.
 */
export function resolveWindowsShim(command, { nodePath = process.execPath } = {}) {
  if (!['.cmd', '.bat'].includes(path.extname(String(command || '')).toLowerCase())) return null
  let script
  try { script = fs.readFileSync(command, 'utf8') } catch { return null }
  const directory = path.dirname(command)
  // `%dp0%` and `%~dp0` both stand for the shim's own folder, with or without
  // the separator the shim then adds itself.
  const expand = value => value.replace(/%~?dp0%?\\?/gi, `${directory}${path.sep}`)
  const targets = [...script.matchAll(/"([^"\r\n]+\.(?:exe|js|cjs|mjs))"/gi)]
    .map(match => { try { return path.normalize(expand(match[1])) } catch { return '' } })
    .filter(target => target && fs.existsSync(target))
  const executable = targets.find(target => target.toLowerCase().endsWith('.exe'))
  if (executable) return { command: executable, args: [] }
  return targets.length ? { command: nodePath, args: [targets[0]], node: true } : null
}
