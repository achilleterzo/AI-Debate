import { useEffect, useState } from 'react'
import { useUiStrings } from '../i18n/UiStringsContext'
import { isThumbnailDataUrl } from '../services/Images'
import { loadFullImage } from '../tools/ImageTool'

/**
 * What a participant looked at with view_image, full size.
 *
 * The message only stores the thumbnail: the full image lived in the turn and
 * nowhere else. So it is resolved again on open — from the attachments, the
 * session's image cache, or a fresh download — while the thumbnail stands in.
 */
export default function ImageLightbox({ invocation, attachments, onClose }) {
  const ui = useUiStrings().chat
  const source = invocation?.imageSource || invocation?.arguments?.source || ''
  const kind = invocation?.imageKind
  const placeholder = isThumbnailDataUrl(invocation?.thumbnail) ? invocation.thumbnail : null
  const [full, setFull] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadFullImage(source, { attachments })
      .then(result => { if (!cancelled) setFull(result) })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [source, attachments])

  useEffect(() => {
    const onKey = event => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const isUrl = /^https?:\/\//i.test(source)
  const status = full ? null : failed ? ui.imageUnavailable : ui.imageLoading

  return (
    <div className="image-lightbox" role="dialog" aria-modal="true" aria-label={source} onClick={onClose}>
      <button type="button" className="image-lightbox-close" onClick={onClose} aria-label={ui.imageClose} title={ui.imageClose}>×</button>
      <figure className="image-lightbox-figure" onClick={event => event.stopPropagation()}>
        {(full || placeholder) && (
          <img
            className={full ? 'image-lightbox-image' : 'image-lightbox-image is-placeholder'}
            src={full?.src || placeholder}
            alt={source}
            width={full?.width}
            height={full?.height}
          />
        )}
        <figcaption className="image-lightbox-caption">
          {kind === 'page' && <span className="image-lightbox-kind">{ui.imageScreenshot}</span>}
          {isUrl
            ? <a href={source} target="_blank" rel="noreferrer noopener" title={ui.imageOpenOriginal}>{source}</a>
            : <span>{source}</span>}
          {full && <span className="image-lightbox-size">{full.width}×{full.height}</span>}
          {status && <span className="image-lightbox-status">{status}</span>}
        </figcaption>
      </figure>
    </div>
  )
}
