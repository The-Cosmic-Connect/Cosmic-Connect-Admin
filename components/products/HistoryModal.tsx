// Recent bulk changes (7 days) with one-click undo.
import { useEffect, useState } from 'react'
import { X, RotateCcw } from 'lucide-react'
import { fetchBatches, undoBatch } from '@/lib/productTools'

const SOURCE: Record<string, string> = { bulk: 'Bulk edit', inline: 'Quick edit', import: 'Import' }

export default function HistoryModal({ onClose, onUndone }: { onClose: () => void; onUndone: () => void }) {
  const [items, setItems] = useState<any[] | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  function load() { fetchBatches().then(setItems).catch((e) => setErr(e.message)) }
  useEffect(() => { load() }, [])

  async function undo(b: any) {
    if (!confirm(`Undo "${b.label}"?\n\nThe products go back to how they were before this change. Any edits made to the same products after it will also be overwritten.`)) return
    setBusy(b.batchId); setErr(''); setMsg('')
    try {
      const r = await undoBatch(b.batchId)
      setMsg(`Undone: ${r.reverted} product${r.reverted === 1 ? '' : 's'} restored${r.errors.length ? `, ${r.errors.length} failed` : ''}.`)
      load(); onUndone()
    } catch (e: any) { setErr(e.message) } finally { setBusy(null) }
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 720 }}>
        <div className="modal-h">
          <h3>Change history (last 7 days)</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={15} /></button>
        </div>
        <div className="modal-b">
          {err && <div className="alert alert-e">{err}</div>}
          {msg && <div className="alert alert-s">{msg}</div>}
          {!items ? <p className="muted">Loading…</p> : items.length === 0 ? (
            <div className="empty">No bulk edits, quick edits or imports in the last 7 days.</div>
          ) : (
            <table>
              <thead><tr><th>When</th><th>Change</th><th>Products</th><th></th></tr></thead>
              <tbody>
                {items.map((b) => (
                  <tr key={b.batchId}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                      {new Date(b.createdAt + 'Z').toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      <span className="tag" style={{ marginRight: 6 }}>{SOURCE[b.source] || b.source}</span>{b.label}
                    </td>
                    <td style={{ fontSize: 12 }}>{b.updated ? `${b.updated} updated` : ''}{b.updated && b.created ? ', ' : ''}{b.created ? `${b.created} new` : ''}</td>
                    <td style={{ textAlign: 'right' }}>
                      {b.undone ? <span className="b b-n">Undone</span> : (
                        <button className="btn btn-s btn-sm" onClick={() => undo(b)} disabled={!!busy}>
                          <RotateCcw size={11} /> {busy === b.batchId ? 'Undoing…' : 'Undo'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="muted" style={{ marginTop: 12 }}>Single-product edits made with the edit form aren&apos;t listed here.</p>
        </div>
      </div>
    </div>
  )
}
