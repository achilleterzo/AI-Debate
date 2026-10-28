# electron/cliShim.js

**Role** — Resolves the program an npm `.cmd` shim actually calls, on Windows.

**Notes**

- The problem it solves: spawning the shim means spawning `cmd.exe`, and on Windows that flashes a console window on every status check, every model listing and every turn — a debate is one window per turn. The shim is a few lines of batch around a single executable (or around a script run through Node, which Electron already provides), so calling that target directly keeps the window from ever existing.
- The interactive login is the one command that *wants* a console, which is why the unwrapping is not applied there.
- Returns `null` when there is nothing to unwrap — not a shim, unreadable, or a target no longer on disk — and the caller falls back to `cmd.exe`. A broken shim must not become a broken app.
- Handles both `%dp0%` and `%~dp0` forms of "the shim's own folder".
- Exercises: `tests/CliShim.test.js`.

