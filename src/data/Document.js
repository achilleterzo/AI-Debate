export class Document {
  static MAX_CHARS = 8000

  static async parse(file) {
    const ext = file.name.split('.').pop().toLowerCase()

    let raw = ''

    if (ext === 'pdf') {
      raw = await Document.extractPdf(file)
    } else {
      raw = await file.text()
    }

    const normalized = raw.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()

    const truncated = normalized.length > Document.MAX_CHARS
    const content = truncated
      ? normalized.slice(0, Document.MAX_CHARS) + `\n\n[... document truncated to ${Document.MAX_CHARS} characters]`
      : normalized

    return { name: file.name, content, truncated }
  }

  static async extractPdf(file) {
    const pdfjsLib = await import('pdfjs-dist')

    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      const workerUrl = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl.href
    }

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

    const pages = []
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const textContent = await page.getTextContent()
      const pageText = textContent.items.map(item => item.str).join(' ')
      pages.push(pageText)

      if (pages.join('\n').length > Document.MAX_CHARS * 1.2) break
    }

    return pages.join('\n')
  }
}
