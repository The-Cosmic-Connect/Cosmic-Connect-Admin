// Shared image-upload helper — originally lived only in pages/admin/shop.tsx
// (product photo uploads) and is now also used by the CMS block editor's
// Image block. Uploads go straight from the browser to S3 via a presigned
// PUT URL (see backend/handlers/uploads.py: POST /uploads/sign), never
// through Lambda, so there's no payload-size limit to worry about.
import { authedFetch } from './auth'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

/**
 * Resize an image to max 1600px on the long edge and re-encode as JPEG with
 * quality 0.85. Returns a Blob suitable for direct PUT to S3. Keeps photo
 * uploads under ~500KB even from a phone camera.
 */
export async function compressImage(file: File): Promise<{ blob: Blob; contentType: string; filename: string }> {
  if (!file.type.startsWith('image/') || file.size < 200 * 1024) {
    return { blob: file, contentType: file.type || 'image/jpeg', filename: file.name }
  }
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = reject
    i.src = URL.createObjectURL(file)
  })
  const MAX = 1600
  const scale = Math.min(1, MAX / Math.max(img.width, img.height))
  const w = Math.round(img.width  * scale)
  const h = Math.round(img.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)
  const blob: Blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.85),
  )
  const base = file.name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9._-]+/g, '-')
  return { blob, contentType: 'image/jpeg', filename: `${base || 'image'}.jpg` }
}

export async function uploadImage(file: File): Promise<string> {
  const { blob, contentType, filename } = await compressImage(file)
  // Admin-only endpoint — must carry the JWT.
  const signRes = await authedFetch(`${API}/uploads/sign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, contentType, size: blob.size }),
  })
  if (!signRes.ok) throw new Error(`Sign failed: ${await signRes.text()}`)
  const { uploadUrl, publicUrl } = await signRes.json()
  // The actual S3 PUT uses the presigned URL itself as auth — no JWT needed
  // (and S3 would reject an unexpected Authorization header anyway).
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  })
  if (!putRes.ok) throw new Error(`S3 upload failed (${putRes.status})`)
  return publicUrl
}
