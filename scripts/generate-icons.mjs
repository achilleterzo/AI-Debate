import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const svgPath = path.join(root, 'public', 'favicon.svg')
const tempHtmlPath = path.join(root, 'scripts', '.icon-render.html')

const iconSpecs = [
  { file: 'public/icon-32.png', size: 32 },
  { file: 'public/icon-192.png', size: 192 },
  { file: 'public/icon-512.png', size: 512 },
  { file: 'electron/assets/icon.png', size: 512 },
  { file: 'electron/assets/icon-256.png', size: 256 },
]

function findEdgeExecutable() {
  const candidates = [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }

  throw new Error('Microsoft Edge was not found in the standard install locations.')
}

function encodeIco(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)

  const directory = Buffer.alloc(images.length * 16)
  let offset = header.length + directory.length

  images.forEach((image, index) => {
    const entry = index * 16
    directory[entry] = image.size >= 256 ? 0 : image.size
    directory[entry + 1] = image.size >= 256 ? 0 : image.size
    directory[entry + 2] = 0
    directory[entry + 3] = 0
    directory.writeUInt16LE(1, entry + 4)
    directory.writeUInt16LE(32, entry + 6)
    directory.writeUInt32LE(image.png.length, entry + 8)
    directory.writeUInt32LE(offset, entry + 12)
    offset += image.png.length
  })

  return Buffer.concat([header, directory, ...images.map(image => image.png)])
}

for (const relative of ['public', 'electron/assets', 'scripts']) {
  fs.mkdirSync(path.join(root, relative), { recursive: true })
}

if (!fs.existsSync(svgPath)) {
  throw new Error(`Missing SVG source: ${svgPath}`)
}

const svg = fs.readFileSync(svgPath, 'utf8')
const edgeExecutable = findEdgeExecutable()

const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body {
        width: 100%;
        height: 100%;
        margin: 0;
        background: transparent;
        overflow: hidden;
      }

      body > svg {
        display: block;
        width: 100vw;
        height: 100vh;
      }
    </style>
  </head>
  <body>${svg}</body>
</html>`

fs.writeFileSync(tempHtmlPath, html)

try {
  for (const spec of iconSpecs) {
    const outputPath = path.join(root, spec.file)
    const result = spawnSync(edgeExecutable, [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--window-size=${spec.size},${spec.size}`,
      `--screenshot=${outputPath}`,
      `file:///${tempHtmlPath.replace(/\\/g, '/')}`,
    ], {
      cwd: root,
      encoding: 'utf8',
    })

    if (result.status !== 0) {
      throw new Error((result.stderr || result.stdout || `Failed to render ${spec.file}`).trim())
    }
  }

  const icoImages = [256, 192, 32].map(size => ({
    size,
    png: fs.readFileSync(path.join(root, size === 256 ? 'electron/assets/icon-256.png' : `public/icon-${size}.png`)),
  }))

  const ico = encodeIco(icoImages)
  fs.writeFileSync(path.join(root, 'public/favicon.ico'), ico)
  fs.writeFileSync(path.join(root, 'electron/assets/icon.ico'), ico)
} finally {
  fs.rmSync(tempHtmlPath, { force: true })
  fs.rmSync(path.join(root, 'electron/assets/icon-256.png'), { force: true })
}
