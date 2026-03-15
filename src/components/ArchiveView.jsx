import React, { useState } from 'react'

export default function ArchiveView({ done, settings, colorForCategory, onRestoreTask, onSelectTask }) {
  const [categoryFilter, setCategoryFilter] = useState(null)

  const categories = [...new Set(done.filter(t => t.category).map(t => t.category))]

  const filtered = categoryFilter ? done.filter(t => t.category === categoryFilter) : done
  // Sort by completed_at desc
  const sorted = [...filtered].sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))

  return (
    <div className="archive-view">
      {/* Filter */}
      {categories.length > 0 && (
        <div className="filter-bar">
          <span className="filter-label">Filter</span>
          <button
            className={`filter-chip ${!categoryFilter ? 'active' : ''}`}
            style={{ '--chip-color': 'var(--text-muted)' }}
            onClick={() => setCategoryFilter(null)}
          >All</button>
          {categories.map(cat => {
            const task = done.find(t => t.category === cat)
            const color = task ? colorForCategory(task) : settings.colors.color1
            return (
              <button
                key={cat}
                className={`filter-chip ${categoryFilter === cat ? 'active' : ''}`}
                style={{ '--chip-color': color }}
                onClick={() => setCategoryFilter(c => c === cat ? null : cat)}
              >
                <span className="chip-dot" />
                {cat}
              </button>
            )
          })}
        </div>
      )}

      <div className="archive-body">
        {sorted.length === 0 ? (
          <div className="archive-empty">
            <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>◎</div>
            <div>No completed tasks yet.</div>
            <div style={{ marginTop: 6, color: 'var(--text-dim)' }}>Move a task to Done on the board to archive it.</div>
          </div>
        ) : (
          <div className="archive-grid">
            {sorted.map(task => {
              const color = colorForCategory(task)
              const completedDate = task.completed_at
                ? new Date(task.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : '—'
              const totalSubs = task.subtasks?.length || 0
              const lastCol = task.subtask_columns?.[task.subtask_columns.length - 1]
              const doneSubs = task.subtasks?.filter(s => s.state === lastCol).length || 0

              return (
                <div
                  key={task.id}
                  className="archive-card"
                  style={{ '--card-accent': color }}
                >
                  <div className="archive-card-title">{task.title || 'Untitled task'}</div>
                  {task.description && (
                    <div className="archive-card-desc">{task.description}</div>
                  )}
                  <div className="archive-card-meta">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span className="archive-date">Completed {completedDate}</span>
                      {totalSubs > 0 && (
                        <span className="archive-date">{doneSubs}/{totalSubs} subtasks</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {task.category && (
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          color,
                        }}>{task.category}</span>
                      )}
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: 'var(--text-xs)', padding: '3px 8px' }}
                        onClick={() => onRestoreTask(task.id)}
                        title="Restore to board"
                      >↩ Restore</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
