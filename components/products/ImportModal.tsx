// Import an edited spreadsheet (CSV): analyse → preview changes & errors → apply as one undoable change.
import { useState } from 'react'
import { X, Upload, Download } from 'lucide-react'
import { analyzeImport, sendChanges, downloadCsv, fmtVal, FIELD_LABEL, ImportPlan, P, SendResult } from '@/lib/productTools'

export default function ImportModal({ products, categories, onClose, onDone }: {
  products: P[]; categories: string[]; onClose: () => void; onDone: (r: SendResult, label: string) => void
}) {
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [fileName, setFileName] = useState('')
  const [allowNew, setAllowNew] = useState(true)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [err, setErr] = useState('')

  async function onFile(f: File | null) {
    if (!f) return
    setErr(''); setPlan(null); setFileName(f.name)
    if (/\.xlsx?$/i.test(f.name)) { setErr('This is an Excel file. In Excel use File → Save As → "CSV UTF-8 (Comma delimited)", then upload that.'); return }
    if (f.size > 20 * 1024 * 1024) { setErr('File is larger than 20 MB'); return }
    const buf = await f.arrayBuffer()
    const text = new TextDecoder('utf-8').decode(buf)
    setPlan(analyzeImport(text, products, categories))
  }

  const creates = plan && allowNew ? plan.creates : []
  const total = (plan?.updates.length || 0) + creates.length

  async function apply() {
    if (!plan || !total) return
    setBusy(true); setErr('')
    const label = `Import ${fileName}: ${plan.updates.length} updated${creates.length ? `, ${creates.length} new` : ''}`
    try {
      const r = await sendChanges({
        label, source: 'import',
        updates: plan.updates.map((u) => ({ id: u.id, set: u.set })),
        creates: creates.map((c) => c.data),
      }, (d, t) => setProgress(`Saving ${d} / ${t}…`))
      onDone(r, label)
    } catch (e: any) { setErr(e.message || 'Import failed') } finally { setBusy(false); setProgress('') }
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal" style={{ maxWidth: 820 }}>
        <div className="modal-h">
          <h3>Import products from a spreadsheet</h3>
          <button onClick={onClose} disabled={busy} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={15} /></button>
        </div>
        <div className="modal-b">
          {err && <div className="alert alert-e">{err}</div>}
          {!plan && (
            <div style={{ fontSize: 13, lineHeight: 1.7, color: '#444' }}>
              <ol style={{ paddingLeft: 18, margin: '0 0 14px' }}>
                <li><strong>Export</strong> products (all, filtered or selected) and open the file in Excel or Google Sheets.</li>
                <li>Edit what you need. Don&apos;t change the <strong>ID</strong> column. You can delete columns you don&apos;t need: missing columns are left as they are.</li>
                <li>To add new products, add rows with an <strong>empty ID</strong> (Name and Categories are required).</li>
                <li>Save as <strong>CSV UTF-8</strong> (Excel: File → Save As → &quot;CSV UTF-8&quot;; Google Sheets: File → Download → CSV) and upload it here.</li>
              </ol>
              <p className="muted" style={{ marginBottom: 14 }}>
                Several categories, tags or image links go in one cell separated by <code>|</code>. Yes/no columns accept yes, no, true, false, 1, 0.
                An empty price or stock cell means &quot;leave unchanged&quot;; type 0 to clear it. You&apos;ll see a preview before anything is saved.
              </p>
              <div className="flex gap2" style={{ alignItems: 'center' }}>
                <label className="btn btn-p" style={{ cursor: 'pointer' }}>
                  <Upload size={13} /> Choose CSV file
                  <input type="file" accept=".csv,text/csv,.xlsx,.xls" style={{ display: 'none' }} onChange={(e) => onFile(e.target.files?.[0] || null)} />
                </label>
                <button className="btn btn-s" onClick={() => downloadCsv([], 'products-template.csv')}><Download size={13} /> Blank template</button>
              </div>
            </div>
          )}

          {plan && (
            <div style={{ fontSize: 13 }}>
              <div className="stats" style={{ marginBottom: 12 }}>
                <div className="stat"><div className="stat-n">{plan.updates.length}</div><div className="stat-l">Products to update</div></div>
                <div className="stat"><div className="stat-n">{plan.creates.length}</div><div className="stat-l">New products</div></div>
                <div className="stat"><div className="stat-n">{plan.unchanged}</div><div className="stat-l">Unchanged</div></div>
                <div className="stat"><div className="stat-n" style={{ color: plan.errors.length ? '#dc2626' : undefined }}>{plan.errors.length}</div><div className="stat-l">Rows with errors</div></div>
              </div>

              {Object.keys(plan.fieldCounts).length > 0 && (
                <p style={{ marginBottom: 10 }}>
                  <span className="muted">Changes: </span>
                  {Object.entries(plan.fieldCounts).map(([k, n]) => `${FIELD_LABEL[k] || k} ×${n}`).join(' · ')}
                </p>
              )}
              {plan.ignoredColumns.length > 0 && <p className="muted" style={{ marginBottom: 10 }}>Ignored columns: {plan.ignoredColumns.join(', ')}</p>}

              {plan.errors.length > 0 && (
                <div className="alert alert-e" style={{ maxHeight: 140, overflow: 'auto' }}>
                  <strong>These rows will be skipped:</strong>
                  {plan.errors.slice(0, 100).map((e, i) => <div key={i}>Row {e.row}: {e.msg}</div>)}
                  {plan.errors.length > 100 && <div>…and {plan.errors.length - 100} more</div>}
                </div>
              )}

              {plan.creates.length > 0 && (
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', margin: '4px 0 10px' }}>
                  <input type="checkbox" checked={allowNew} onChange={(e) => setAllowNew(e.target.checked)} style={{ width: 'auto' }} />
                  Create {plan.creates.length} new product{plan.creates.length > 1 ? 's' : ''} from rows with an empty ID
                </label>
              )}

              {plan.updates.length > 0 && (
                <div style={{ border: '1px solid #eee', borderRadius: 4, maxHeight: 300, overflow: 'auto' }}>
                  <table>
                    <thead><tr><th>Row</th><th>Product</th><th>Changes</th></tr></thead>
                    <tbody>
                      {plan.updates.slice(0, 100).map((u) => (
                        <tr key={u.id}>
                          <td className="muted">{u.row}</td>
                          <td style={{ maxWidth: 220 }}><span className="trunc">{u.name}</span></td>
                          <td style={{ fontSize: 12 }}>
                            {u.changes.map((c) => (
                              <div key={c.field}><span className="muted">{FIELD_LABEL[c.field]}:</span> {fmtVal(c.field, c.from)} → <strong>{fmtVal(c.field, c.to)}</strong></div>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {plan.updates.length > 100 && <p className="muted" style={{ padding: '6px 12px' }}>…and {plan.updates.length - 100} more</p>}
                </div>
              )}
              {!total && !plan.errors.length && <p className="muted">Nothing to change: the file matches the current products.</p>}
            </div>
          )}
        </div>
        <div className="modal-f" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="muted">{progress || (plan ? 'Saved as one change – undo it from History for 7 days.' : '')}</span>
          <div className="flex gap2">
            {plan && <button className="btn btn-s" onClick={() => { setPlan(null); setErr('') }} disabled={busy}>Choose another file</button>}
            <button className="btn btn-s" onClick={onClose} disabled={busy}>Cancel</button>
            {plan && <button className="btn btn-p" onClick={apply} disabled={busy || !total}>{busy ? 'Saving…' : `Apply ${total} change${total === 1 ? '' : 's'}`}</button>}
          </div>
        </div>
      </div>
    </div>
  )
}
