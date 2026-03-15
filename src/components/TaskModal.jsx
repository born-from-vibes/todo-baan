import React, { useState, useEffect, useCallback, useRef } from 'react'

const STATES = ['Open', 'Active', 'Audits', 'Backlog', 'Suspended', 'Done']

// Returns the resolved color for a category_color value (1/2/3 or hex string)
export function resolveCategoryColor(categoryColor, colors) {
  if (!categoryColor) return colors.color1
  if (typeof categoryColor === 'number') return colors[`color${categoryColor}`]
  return categoryColor // raw hex
}

export default function TaskModal({ task, settings, onClose, onUpdateTask, onDeleteTask, onViewSubtasks }) {
  const [draft, setDraft] = useState(null)
  const prevIdRef = useRef(null)
  const flushRef = useRef(null)
  const customColorRef = useRef(null)

  // Sync draft when task changes
  useEffect(() => {
    if (task && task.id !== prevIdRef.current) {
      setDraft(JSON.parse(JSON.stringify(task)))
      prevIdRef.current = task.id
    }
    if (!task) {
      prevIdRef.current = null
      setDraft(null)
    }
  }, [task])

  // Flush draft up (debounced — App autosave handles persistence)
  useEffect(() => {
    if (!draft) return
    clearTimeout(flushRef.current)
    flushRef.current = setTimeout(() => onUpdateTask(draft), 300)
    return () => clearTimeout(flushRef.current)
  }, [draft, onUpdateTask])

  const updateDraft = useCallback((patch) => {
    setDraft(d => d ? { ...d, ...patch } : d)
  }, [])

  const handleConfirmDelete = () => {
    if (window.confirm('Delete this task? This cannot be undone.')) {
      onDeleteTask(task.id)
    }
  }

  if (!task || !draft) return <div className="task-modal" />

  const resolvedColor = resolveCategoryColor(draft.category_color, settings.colors)
  const isCustomColor = typeof draft.category_color === 'string'
  const subtaskCount = draft.subtasks?.length || 0
  const lastCol = draft.subtask_columns?.[draft.subtask_columns.length - 1]
  const doneSubs = draft.subtasks?.filter(s => s.state === lastCol).length || 0

  return (
    <div className={`task-modal ${task ? 'open' : ''}`}>
      {/* Header */}
      <div className="modal-header">
        <div className="modal-header-left">
          <textarea
            className="modal-title-input"
            value={draft.title}
            onChange={e => updateDraft({ title: e.target.value })}
            placeholder="Task title…"
            rows={1}
            onInput={e => {
              e.target.style.height = 'auto'
              e.target.style.height = e.target.scrollHeight + 'px'
            }}
          />
          <div className="modal-meta-row">
            <span className="badge badge-state">{draft.state}</span>
            {draft.category && (
              <span className="badge" style={{
                background: `color-mix(in srgb, ${resolvedColor} 14%, transparent)`,
                color: resolvedColor,
                border: `1px solid color-mix(in srgb, ${resolvedColor} 28%, transparent)`
              }}>
                {draft.category}
              </span>
            )}
          </div>
        </div>
        <button className="modal-close btn" onClick={onClose}>✕</button>
      </div>

      {/* Description */}
      <div className="field-group">
        <div className="field-label">Description</div>
        <textarea
          className="field-input"
          value={draft.description}
          onChange={e => updateDraft({ description: e.target.value })}
          placeholder="What's this task about?"
          rows={3}
        />
      </div>

      {/* State + Category */}
      <div className="field-group">
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div className="field-label">State</div>
            <select
              className="field-input state-select"
              value={draft.state}
              onChange={e => updateDraft({ state: e.target.value })}
            >
              {STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ flex: 1.4 }}>
            <div className="field-label">Category</div>
            <input
              className="field-input"
              value={draft.category}
              onChange={e => updateDraft({ category: e.target.value })}
              placeholder="e.g. Work, Health…"
            />
          </div>
        </div>
      </div>

      {/* Category color */}
      <div className="field-group">
        <div className="field-label">Category color</div>
        <div className="category-color-row">
          {[1, 2, 3].map(n => (
            <button
              key={n}
              className={`color-swatch ${draft.category_color === n ? 'selected' : ''}`}
              style={{ background: settings.colors[`color${n}`] }}
              title={`Accent ${n}`}
              onClick={() => updateDraft({ category_color: n })}
            />
          ))}

          {/* Custom color swatch */}
          <div className="color-swatch-custom-wrap">
            <button
              className={`color-swatch color-swatch-custom ${isCustomColor ? 'selected' : ''}`}
              style={{ background: isCustomColor ? draft.category_color : undefined }}
              title="Custom color"
              onClick={() => customColorRef.current?.click()}
            >
              {!isCustomColor && <span className="custom-swatch-icon">+</span>}
            </button>
            <input
              ref={customColorRef}
              type="color"
              className="color-picker-hidden"
              value={isCustomColor ? draft.category_color : '#888888'}
              onChange={e => updateDraft({ category_color: e.target.value })}
            />
          </div>

          {isCustomColor && (
            <span className="custom-color-hex">{draft.category_color}</span>
          )}
        </div>
      </div>

      {/* Subtask summary — click to open full page */}
      <div className="field-group subtask-summary-group" style={{ flex: 1 }}>
        <div className="field-label">Subtasks</div>
        <button
          className="subtask-summary-btn"
          onClick={() => { onClose(); onViewSubtasks(task.id) }}
        >
          <div className="subtask-summary-left">
            <span className="subtask-summary-count">{subtaskCount}</span>
            <span className="subtask-summary-label">
              {subtaskCount === 0 ? 'No subtasks yet' : `subtask${subtaskCount !== 1 ? 's' : ''}`}
            </span>
            {subtaskCount > 0 && (
              <span className="subtask-summary-progress">
                · {doneSubs}/{subtaskCount} in {lastCol}
              </span>
            )}
          </div>
          <div className="subtask-summary-cols">
            {(draft.subtask_columns || []).map(c => (
              <span key={c} className="subtask-col-pill">{c}</span>
            ))}
            <span className="subtask-open-arrow">→</span>
          </div>
        </button>
      </div>

      {/* Footer */}
      <div className="modal-footer">
        <button className="btn btn-danger" style={{ fontSize: 'var(--text-xs)' }} onClick={handleConfirmDelete}>
          Delete task
        </button>
        <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
          {new Date(draft.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      </div>
    </div>
  )
}
