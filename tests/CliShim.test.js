import { afterEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { resolveWindowsShim } from '../electron/cliShim.js'

const made = []

function tempDir() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-debate-shim-'))
  made.push(directory)
  return directory
}

afterEach(() => {
  for (const directory of made.splice(0)) fs.rmSync(directory, { recursive: true, force: true })
})

describe('unwrapping an npm .cmd shim', () => {
  it('finds the executable the shim calls, so no console window is needed', () => {
    const directory = tempDir()
    const target = path.join(directory, 'bin', 'claude.exe')
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, '')
    const shim = path.join(directory, 'claude.cmd')
    fs.writeFileSync(shim, ['@ECHO off', 'SET dp0=%~dp0', '"%dp0%\\bin\\claude.exe"   %*'].join('\r\n'))

    expect(resolveWindowsShim(shim)).toEqual({ command: path.normalize(target), args: [] })
  })

  it('runs a script shim through the Node runtime instead', () => {
    const directory = tempDir()
    const target = path.join(directory, 'cli.js')
    fs.writeFileSync(target, '')
    const shim = path.join(directory, 'tool.cmd')
    fs.writeFileSync(shim, '"%~dp0\\node.exe" "%~dp0\\cli.js" %*')

    expect(resolveWindowsShim(shim, { nodePath: '/runtime/node' })).toEqual({
      command: '/runtime/node',
      args: [path.normalize(target)],
      node: true,
    })
  })

  it('leaves anything it cannot unwrap to the caller', () => {
    const directory = tempDir()
    const missing = path.join(directory, 'gone.cmd')
    fs.writeFileSync(missing, '"%dp0%\\bin\\not-here.exe" %*')

    expect(resolveWindowsShim(missing)).toBeNull()
    expect(resolveWindowsShim(path.join(directory, 'absent.cmd'))).toBeNull()
    expect(resolveWindowsShim('/usr/local/bin/claude')).toBeNull()
    expect(resolveWindowsShim('')).toBeNull()
  })
})
