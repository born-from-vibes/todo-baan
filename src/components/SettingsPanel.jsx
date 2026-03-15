import React, { useRef, useState } from 'react'

const COLOR_LABELS = [
  { key: 'color1', label: 'Accent 1', desc: 'Primary category & highlights' },
  { key: 'color2', label: 'Accent 2', desc: 'Secondary category & done state' },
  { key: 'color3', label: 'Accent 3', desc: 'Tertiary category & testing state' },
]

const THEME_FIELDS = [
  { key: 'background', label: 'Background' },
  { key: 'surface', label: 'Surface' },
  { key: 'border', label: 'Border' },
  { key: 'text', label: 'Text' },
  { key: 'textMuted', label: 'Text muted' },
]

export default function SettingsPanel({ open, settings, onUpdateSettings, onClose, onImport }) {
  const importInputRef = useRef(null)
  const [importStatus, setImportStatus] = useState(null) // null | 'loading' | 'ok' | 'error'
  const [importError, setImportError] = useState('')

  const updateColor = (key, value) => {
    onUpdateSettings({ ...settings, colors: { ...settings.colors, [key]: value } })
  }

  const updateTheme = (key, value) => {
    onUpdateSettings({ ...settings, theme: { ...settings.theme, [key]: value } })
  }

  const resetDefaults = () => {
    onUpdateSettings({
      colors: { color1: '#6366f1', color2: '#10b981', color3: '#f59e0b' },
      theme: { background: '#0f0f13', surface: '#1a1a24', border: '#2a2a38', text: '#e2e2f0', textMuted: '#6b6b82' }
    })
  }

  const handleExport = () => {
    // Trigger the server's export endpoint — it sends the file with Content-Disposition
    const a = document.createElement('a')
    a.href = '/api/export'
    a.click()
  }

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = '' // reset so same file can be re-imported

    setImportStatus('loading')
    setImportError('')

    try {
      const text = await file.text()
      const bundle = JSON.parse(text)

      if (!bundle.tasks || !bundle.done || !bundle.settings) {
        throw new Error('File is missing tasks, done, or settings.')
      }

      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bundle)
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Server error')
      }

      setImportStatus('ok')
      setTimeout(() => {
        setImportStatus(null)
        onImport(bundle) // reload state in App without full page refresh
      }, 900)
    } catch (err) {
      setImportStatus('error')
      setImportError(err.message)
    }
  }

  return (
    <div className={`settings-panel ${open ? 'open' : ''}`}>
      <div className="settings-header">
        <span className="settings-title">Settings</span>
        <button className="btn-icon" onClick={onClose}>✕</button>
      </div>

      <div className="settings-body">
        {/* Accent colors */}
        <div>
          <div className="settings-section-title">Accent Colors</div>
          {COLOR_LABELS.map(({ key, label, desc }) => (
            <div key={key} className="color-picker-row">
              <div className="color-picker-label">
                <div className="color-preview" style={{ background: settings.colors[key] }} />
                <div>
                  <div style={{ fontWeight: 500, color: 'var(--text)' }}>{label}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-dim)', marginTop: 1 }}>{desc}</div>
                </div>
              </div>
              <input type="color" className="color-picker-input" value={settings.colors[key]} onChange={e => updateColor(key, e.target.value)} />
            </div>
          ))}
        </div>

        {/* Theme */}
        <div>
          <div className="settings-section-title">Theme Colors</div>
          {THEME_FIELDS.map(({ key, label }) => (
            <div key={key} className="theme-input-row">
              <span className="theme-input-label">{label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="color" className="color-picker-input" style={{ width: 28, height: 24 }} value={settings.theme[key]} onChange={e => updateTheme(key, e.target.value)} />
                <input
                  type="text"
                  className="theme-input"
                  value={settings.theme[key]}
                  onChange={e => { const v = e.target.value; if (/^#[0-9a-fA-F]{0,6}$/.test(v)) updateTheme(key, v) }}
                  spellCheck={false}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Reset */}
        <div>
          <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', border: '1px solid var(--border)' }} onClick={resetDefaults}>
            Reset to defaults
          </button>
        </div>

        {/* File paths info */}
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-dim)', lineHeight: 1.7, borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
          <div>Tasks → <code style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>data/tasks.yaml</code></div>
          <div>Archive → <code style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>data/done.yaml</code></div>
          <div>Settings → <code style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>data/settings.yaml</code></div>
        </div>
      </div>

      {/* Export / Import — pinned to bottom */}
      <div className="settings-data-footer">
        <button className="btn data-io-btn data-export-btn" onClick={handleExport}>
          <span className="data-io-icon">↓</span>
          <div className="data-io-text">
            <span className="data-io-label">Export</span>
            <span className="data-io-desc">Download all data</span>
          </div>
        </button>

        <button
          className="btn data-io-btn data-import-btn"
          onClick={() => importInputRef.current?.click()}
          disabled={importStatus === 'loading'}
        >
          <span className="data-io-icon">
            {importStatus === 'loading' ? '…' : importStatus === 'ok' ? '✓' : '↑'}
          </span>
          <div className="data-io-text">
            <span className="data-io-label">
              {importStatus === 'ok' ? 'Imported!' : importStatus === 'loading' ? 'Importing…' : 'Import'}
            </span>
            <span className="data-io-desc">
              {importStatus === 'error' ? importError : 'Restore from a .json export'}
            </span>
          </div>
        </button>

        <input
          ref={importInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleImportFile}
        />
      </div>
    </div>
  )
}
