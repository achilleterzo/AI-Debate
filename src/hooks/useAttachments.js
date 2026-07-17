import { useCallback, useRef, useState } from 'react'
import { Document } from '../data/Document'

export function useAttachments() {
  const [attachedDocs, setAttachedDocs] = useState([])
  const inputRef = useRef(null)

  const addFiles = useCallback(async files => {
    for (const file of files) {
      try {
        const document = await Document.parse(file)
        setAttachedDocs(previous => [...previous.filter(entry => entry.name !== document.name), document])
      } catch (error) {
        console.error('Errore parsing documento:', error)
      }
    }
  }, [])

  const removeAttachment = useCallback(index => {
    setAttachedDocs(previous => previous.filter((_, entryIndex) => entryIndex !== index))
  }, [])

  return { attachedDocs, inputRef, addFiles, removeAttachment }
}
