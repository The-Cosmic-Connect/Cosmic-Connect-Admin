// Block schema for the CMS drag-and-drop page builder. This is the admin
// side's source of truth — frontend/components/cms/BlockRenderer.tsx mirrors
// these shapes to render them (the two apps are separate repos, so the type
// is duplicated rather than shared, same as CATEGORIES/COURSES already are
// between admin/pages/admin/cms.tsx and the frontend).
//
// Stored on the CmsPage row as `blocks: CmsBlock[]` (backend/models/cms_page.py
// keeps this opaque as List[Dict] — it never validates individual block
// shapes, only that the row has a list of them).

export interface HeadingBlock  { id: string; type: 'heading';   text: string; level: 2 | 3 }
export interface ParagraphBlock { id: string; type: 'paragraph'; html: string }
export interface ImageBlock    { id: string; type: 'image';     url: string; alt: string; caption: string }
export interface YoutubeBlock  { id: string; type: 'youtube';   videoId: string; url: string; caption: string }
export interface ButtonBlock   { id: string; type: 'button';    label: string; href: string; style: 'primary' | 'outline' }
export interface DividerBlock  { id: string; type: 'divider' }
export interface FaqBlock      { id: string; type: 'faq';       items: { q: string; a: string }[] }
export interface HtmlBlock     { id: string; type: 'html';      html: string }

export type CmsBlock =
  | HeadingBlock | ParagraphBlock | ImageBlock | YoutubeBlock
  | ButtonBlock | DividerBlock | FaqBlock | HtmlBlock

export type CmsBlockType = CmsBlock['type']

export const BLOCK_META: Record<CmsBlockType, { label: string }> = {
  heading:   { label: 'Heading' },
  paragraph: { label: 'Paragraph' },
  image:     { label: 'Image' },
  youtube:   { label: 'YouTube Video' },
  button:    { label: 'Button / Link' },
  divider:   { label: 'Divider' },
  faq:       { label: 'FAQ' },
  html:      { label: 'Custom HTML' },
}

export function genBlockId(): string {
  return 'b' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

export function newBlock(type: CmsBlockType): CmsBlock {
  const id = genBlockId()
  switch (type) {
    case 'heading':   return { id, type, text: '', level: 2 }
    case 'paragraph': return { id, type, html: '' }
    case 'image':     return { id, type, url: '', alt: '', caption: '' }
    case 'youtube':   return { id, type, videoId: '', url: '', caption: '' }
    case 'button':    return { id, type, label: '', href: '', style: 'primary' }
    case 'divider':   return { id, type }
    case 'faq':       return { id, type, items: [{ q: '', a: '' }] }
    case 'html':      return { id, type, html: '' }
  }
}

// Accepts watch/embed/youtu.be/shorts URLs (with or without extra query
// params) and pulls out the 11-character video ID. Returns null if the
// string doesn't look like a YouTube URL/ID at all.
export function parseYouTubeId(input: string): string | null {
  const s = input.trim()
  if (!s) return null
  // Bare 11-char ID pasted directly.
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtube\.com\/watch\?.*&v=)([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
  ]
  for (const re of patterns) {
    const m = s.match(re)
    if (m) return m[1]
  }
  return null
}

export function youtubeThumbUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
}
