import { useRef, useState } from 'react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical, Trash2, Plus, Heading2, Type, Image as ImageIcon, Youtube,
  Link2, Minus, HelpCircle, Code2, Bold, Italic, Upload, X,
} from 'lucide-react'
import { uploadImage } from '@/lib/uploadImage'
import {
  type CmsBlock, type CmsBlockType, BLOCK_META, newBlock, parseYouTubeId,
  youtubeThumbUrl, genBlockId,
} from './blockTypes'

const BLOCK_ICONS: Record<CmsBlockType, React.ElementType> = {
  heading: Heading2, paragraph: Type, image: ImageIcon, youtube: Youtube,
  button: Link2, divider: Minus, faq: HelpCircle, html: Code2,
}

// ── Rich-text-lite toolbar for the Paragraph block ──────────────────────────
// Wraps the current textarea selection in a small, fixed set of HTML tags.
// This deliberately isn't a full WYSIWYG editor — it edits the same trusted
// HTML-fragment string the old "Page Content" box did, just with a couple of
// one-click shortcuts instead of hand-typing tags.
function wrapSelection(
  textarea: HTMLTextAreaElement, before: string, after: string,
): string {
  const { selectionStart: s, selectionEnd: e, value } = textarea
  return value.slice(0, s) + before + value.slice(s, e) + after + value.slice(e)
}

function ParagraphFields({ block, onChange }: { block: Extract<CmsBlock, { type: 'paragraph' }>; onChange: (b: CmsBlock) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)

  function format(before: string, after: string) {
    const ta = ref.current
    if (!ta) return
    onChange({ ...block, html: wrapSelection(ta, before, after) })
  }

  function formatLink() {
    const ta = ref.current
    if (!ta) return
    const url = window.prompt('Link URL (https://...)')
    if (!url) return
    onChange({ ...block, html: wrapSelection(ta, `<a href="${url}" target="_blank" rel="noopener noreferrer">`, '</a>') })
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <button type="button" className="btn btn-s btn-sm" onClick={() => format('<strong>', '</strong>')}><Bold size={12} /></button>
        <button type="button" className="btn btn-s btn-sm" onClick={() => format('<em>', '</em>')}><Italic size={12} /></button>
        <button type="button" className="btn btn-s btn-sm" onClick={formatLink}><Link2 size={12} /></button>
      </div>
      <textarea ref={ref} rows={4} value={block.html}
        onChange={e => onChange({ ...block, html: e.target.value })}
        placeholder="Select text and click Bold/Italic/Link to format, or type simple HTML directly." />
    </div>
  )
}

// ── Image block: upload (click or drag a file in) or paste a URL ───────────
function ImageFields({ block, onChange }: { block: Extract<CmsBlock, { type: 'image' }>; onChange: (b: CmsBlock) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr]   = useState('')
  const [dragOver, setDragOver] = useState(false)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setBusy(true); setErr('')
    try {
      const url = await uploadImage(file)
      onChange({ ...block, url })
    } catch (e: any) {
      setErr(e.message || 'Upload failed')
    }
    setBusy(false)
  }

  return (
    <div>
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]) }}
        style={{
          border: `1px dashed ${dragOver ? '#5b21b6' : '#ccc'}`, borderRadius: 4, padding: 12,
          background: dragOver ? '#f3f0ff' : '#fafafa', marginBottom: 10, textAlign: 'center',
        }}
      >
        {block.url ? (
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <img src={block.url} alt={block.alt} style={{ maxHeight: 140, borderRadius: 4 }} />
            <button type="button" onClick={() => onChange({ ...block, url: '' })}
              style={{ position: 'absolute', top: -8, right: -8, background: '#dc2626', color: '#fff',
                borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}>
              <X size={12} />
            </button>
          </div>
        ) : (
          <>
            <button type="button" className="btn btn-s btn-sm" onClick={() => inputRef.current?.click()} disabled={busy}>
              <Upload size={12} /> {busy ? 'Uploading…' : 'Add image'}
            </button>
            <p className="muted" style={{ marginTop: 6 }}>or drag a file here — JPG/PNG/WebP, resized automatically</p>
          </>
        )}
        <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => handleFile(e.target.files?.[0])} />
        {err && <div className="alert alert-e" style={{ marginTop: 8 }}>{err}</div>}
      </div>

      <div className="row2">
        <div className="form-group">
          <label>Alt text</label>
          <input value={block.alt} onChange={e => onChange({ ...block, alt: e.target.value })} placeholder="Describes the image" />
        </div>
        <div className="form-group">
          <label>Caption (optional)</label>
          <input value={block.caption} onChange={e => onChange({ ...block, caption: e.target.value })} />
        </div>
      </div>
    </div>
  )
}

// ── YouTube block: paste a URL, thumbnail fetches automatically ────────────
function YoutubeFields({ block, onChange }: { block: Extract<CmsBlock, { type: 'youtube' }>; onChange: (b: CmsBlock) => void }) {
  function setUrl(url: string) {
    const videoId = parseYouTubeId(url) || ''
    onChange({ ...block, url, videoId })
  }

  return (
    <div>
      <div className="form-group">
        <label>YouTube URL</label>
        <input value={block.url} onChange={e => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..." />
      </div>
      {block.videoId ? (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
          <img src={youtubeThumbUrl(block.videoId)} alt="" style={{ width: 120, borderRadius: 4 }} />
          <span className="muted">Thumbnail fetched from YouTube — video ID: {block.videoId}</span>
        </div>
      ) : block.url ? (
        <div className="alert alert-e" style={{ marginBottom: 10 }}>Couldn't find a video ID in that URL.</div>
      ) : null}
      <div className="form-group">
        <label>Caption (optional)</label>
        <input value={block.caption} onChange={e => onChange({ ...block, caption: e.target.value })} />
      </div>
    </div>
  )
}

function FaqFields({ block, onChange }: { block: Extract<CmsBlock, { type: 'faq' }>; onChange: (b: CmsBlock) => void }) {
  function setItem(i: number, patch: Partial<{ q: string; a: string }>) {
    const items = block.items.map((it, idx) => idx === i ? { ...it, ...patch } : it)
    onChange({ ...block, items })
  }
  function removeItem(i: number) {
    onChange({ ...block, items: block.items.filter((_, idx) => idx !== i) })
  }
  return (
    <div>
      {block.items.map((it, i) => (
        <div key={i} style={{ border: '1px solid #eee', borderRadius: 4, padding: 10, marginBottom: 8 }}>
          <div className="form-group">
            <label>Question {i + 1}</label>
            <input value={it.q} onChange={e => setItem(i, { q: e.target.value })} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Answer</label>
            <textarea rows={2} value={it.a} onChange={e => setItem(i, { a: e.target.value })} />
          </div>
          {block.items.length > 1 && (
            <button type="button" className="btn btn-s btn-sm btn-danger" style={{ marginTop: 8 }} onClick={() => removeItem(i)}>
              <Trash2 size={12} /> Remove
            </button>
          )}
        </div>
      ))}
      <button type="button" className="btn btn-s btn-sm" onClick={() => onChange({ ...block, items: [...block.items, { q: '', a: '' }] })}>
        <Plus size={12} /> Add question
      </button>
    </div>
  )
}

function BlockFields({ block, onChange }: { block: CmsBlock; onChange: (b: CmsBlock) => void }) {
  switch (block.type) {
    case 'heading':
      return (
        <div className="row2">
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Heading text</label>
            <input value={block.text} onChange={e => onChange({ ...block, text: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Size</label>
            <select value={block.level} onChange={e => onChange({ ...block, level: Number(e.target.value) as 2 | 3 })}>
              <option value={2}>Large (H2)</option>
              <option value={3}>Medium (H3)</option>
            </select>
          </div>
        </div>
      )
    case 'paragraph':
      return <ParagraphFields block={block} onChange={onChange} />
    case 'image':
      return <ImageFields block={block} onChange={onChange} />
    case 'youtube':
      return <YoutubeFields block={block} onChange={onChange} />
    case 'button':
      return (
        <div className="row2">
          <div className="form-group">
            <label>Button label</label>
            <input value={block.label} onChange={e => onChange({ ...block, label: e.target.value })} placeholder="Book a Session" />
          </div>
          <div className="form-group">
            <label>Link URL</label>
            <input value={block.href} onChange={e => onChange({ ...block, href: e.target.value })} placeholder="https://... or /services" />
          </div>
          <div className="form-group">
            <label>Style</label>
            <select value={block.style} onChange={e => onChange({ ...block, style: e.target.value as 'primary' | 'outline' })}>
              <option value="primary">Filled (primary)</option>
              <option value="outline">Outlined</option>
            </select>
          </div>
        </div>
      )
    case 'divider':
      return <p className="muted">A plain horizontal divider line — no settings.</p>
    case 'faq':
      return <FaqFields block={block} onChange={onChange} />
    case 'html':
      return (
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Raw HTML</label>
          <textarea rows={6} value={block.html} onChange={e => onChange({ ...block, html: e.target.value })}
            placeholder="<p>...</p>" />
          <span className="muted">Advanced — rendered exactly as written. Use the other block types where possible.</span>
        </div>
      )
  }
}

function SortableBlockItem({
  block, onChange, onRemove,
}: { block: CmsBlock; onChange: (b: CmsBlock) => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id })
  const Icon = BLOCK_ICONS[block.type]

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform), transition,
        border: '1px solid #eee', borderRadius: 6, marginBottom: 10, background: '#fff',
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderBottom: '1px solid #f3f3f3' }}>
        <span {...attributes} {...listeners} style={{ cursor: 'grab', color: '#bbb', display: 'flex' }} aria-label="Drag to reorder">
          <GripVertical size={15} />
        </span>
        <Icon size={13} style={{ color: '#5b21b6' }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>{BLOCK_META[block.type].label}</span>
        <button type="button" className="btn btn-s btn-sm btn-danger" style={{ marginLeft: 'auto' }} onClick={onRemove}>
          <Trash2 size={12} />
        </button>
      </div>
      <div style={{ padding: 12 }}>
        <BlockFields block={block} onChange={onChange} />
      </div>
    </div>
  )
}

export default function BlockEditor({
  blocks, onChange,
}: { blocks: CmsBlock[]; onChange: (blocks: CmsBlock[]) => void }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = blocks.findIndex(b => b.id === active.id)
    const newIndex = blocks.findIndex(b => b.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    onChange(arrayMove(blocks, oldIndex, newIndex))
  }

  function updateBlock(id: string, next: CmsBlock) {
    onChange(blocks.map(b => b.id === id ? next : b))
  }
  function removeBlock(id: string) {
    if (!window.confirm('Remove this block?')) return
    onChange(blocks.filter(b => b.id !== id))
  }
  function addBlock(type: CmsBlockType) {
    onChange([...blocks, newBlock(type)])
  }

  return (
    <div>
      {blocks.length === 0 && (
        <p className="empty-state" style={{ padding: 20 }}>
          No content yet — add a block below to start building the page.
        </p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
          {blocks.map(block => (
            <SortableBlockItem
              key={block.id}
              block={block}
              onChange={next => updateBlock(block.id, next)}
              onRemove={() => removeBlock(block.id)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6, paddingTop: 10, borderTop: '1px solid #eee' }}>
        {(Object.keys(BLOCK_META) as CmsBlockType[]).map(type => {
          const Icon = BLOCK_ICONS[type]
          return (
            <button key={type} type="button" className="btn btn-s btn-sm" onClick={() => addBlock(type)}>
              <Icon size={12} /> {BLOCK_META[type].label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Re-exported so cms.tsx can build the legacy-bodyHtml migration block
// without importing straight from ./blockTypes in two places.
export { genBlockId }
