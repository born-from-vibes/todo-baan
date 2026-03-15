import React, { useState, useRef, useCallback } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDroppable, pointerWithin, rectIntersection
} from '@dnd-kit/core'

function kanbanCollision(args) {
  const hits = pointerWithin(args)
  if (hits.length > 0) return hits
  return rectIntersection(args)
}
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { resolveCategoryColor } from './TaskModal.jsx'

// ── Subtask card ──────────────────────────────────────────────────────────
function SubCard({ sub, onUpdate, onDelete, isDragOverlay }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ title: sub.title, note: sub.note || '' })
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sub.id })

  const style = { transform: CSS.Transform.toString(transform), transition }

  const commit = () => { onUpdate({ ...sub, ...draft }); setEditing(false) }
  const cancel = () => { setEditing(false); setDraft({ title: sub.title, note: sub.note || '' }) }

  const classNames = ['sub-card', isDragging ? 'dragging' : '', isDragOverlay ? 'drag-overlay' : ''].filter(Boolean).join(' ')

  if (editing) {
    return (
      <div className="sub-card-edit" ref={setNodeRef} style={style}>
        <textarea
          className="sub-card-edit-title"
          value={draft.title}
          onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
          placeholder="Subtask title…"
          rows={2}
          autoFocus
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit() }
            if (e.key === 'Escape') cancel()
          }}
        />
        <textarea
          className="sub-card-edit-note"
          value={draft.note}
          onChange={e => setDraft(d => ({ ...d, note: e.target.value }))}
          placeholder="Add a note…"
          rows={2}
        />
        <div className="sub-card-edit-actions">
          <button className="btn btn-danger" style={{ fontSize: '11px', padding: '3px 8px' }} onClick={() => onDelete(sub.id)}>Delete</button>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-ghost" style={{ fontSize: '11px', padding: '3px 8px' }} onClick={cancel}>Cancel</button>
            <button className="btn btn-primary" style={{ fontSize: '11px', padding: '3px 8px' }} onClick={commit}>Save</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div ref={setNodeRef} style={style} className={classNames} {...attributes} {...listeners}
      onClick={() => !isDragging && setEditing(true)}>
      <div className="sub-card-title">
        {sub.title || <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>Untitled</span>}
      </div>
      {sub.note && <div className="sub-card-note">{sub.note}</div>}
    </div>
  )
}

// ── Subtask column ────────────────────────────────────────────────────────
function SubColumn({ colName, colIndex, subtasks, onUpdateSub, onDeleteSub, onAddSub, onRenameCol, onDeleteCol }) {
  const { setNodeRef, isOver } = useDroppable({ id: `subcol-${colName}` })
  const [nameVal, setNameVal] = useState(colName)

  // Sync on external rename
  React.useEffect(() => { setNameVal(colName) }, [colName])

  const handleNameBlur = () => {
    const trimmed = nameVal.trim()
    if (trimmed && trimmed !== colName) onRenameCol(colName, trimmed)
    else setNameVal(colName)
  }

  // Droppable ref on the WHOLE column div so header area is also a valid drop target
  return (
    <div ref={setNodeRef} className={`sub-column sub-column-page ${isOver ? 'drag-over' : ''}`}>
      <div className="sub-col-header">
        <input
          className="sub-col-title-input"
          value={nameVal}
          onChange={e => setNameVal(e.target.value)}
          onBlur={handleNameBlur}
          onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
        />
        <span className="sub-col-count">{subtasks.length}</span>
        {colIndex > 0 && (
          <button className="sub-col-delete btn" title="Delete column" onClick={() => onDeleteCol(colName)}>×</button>
        )}
      </div>

      <div className="sub-col-body">
        <SortableContext items={subtasks.map(s => s.id)} strategy={verticalListSortingStrategy}>
          {subtasks.map(sub => (
            <SubCard key={sub.id} sub={sub} onUpdate={onUpdateSub} onDelete={onDeleteSub} />
          ))}
        </SortableContext>
        {subtasks.length === 0 && (
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', textAlign: 'center', padding: '16px 0', opacity: 0.5 }}>
            drop here
          </div>
        )}
      </div>

      <div style={{ padding: '0 6px 8px' }}>
        <button className="add-sub-btn" onClick={() => onAddSub(colName)}>+ subtask</button>
      </div>
    </div>
  )
}

// ── Subtask page ──────────────────────────────────────────────────────────
export default function SubtaskPage({ task, settings, onBack, onUpdateTask, onEditTask }) {
  const [activeId, setActiveId] = useState(null)
  const lastOverRef = useRef(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const accentColor = resolveCategoryColor(task.category_color, settings.colors)

  // ── Subtask handlers ───────────────────────────────────────────────────
  const updateTask = useCallback((patch) => {
    onUpdateTask({ ...task, ...patch })
  }, [task, onUpdateTask])

  const handleAddSub = useCallback((colName) => {
    const newSub = { id: crypto.randomUUID(), title: '', state: colName, note: '' }
    updateTask({ subtasks: [...(task.subtasks || []), newSub] })
  }, [task.subtasks, updateTask])

  const handleUpdateSub = useCallback((updated) => {
    updateTask({ subtasks: task.subtasks.map(s => s.id === updated.id ? updated : s) })
  }, [task.subtasks, updateTask])

  const handleDeleteSub = useCallback((subId) => {
    updateTask({ subtasks: task.subtasks.filter(s => s.id !== subId) })
  }, [task.subtasks, updateTask])

  const handleAddColumn = useCallback(() => {
    const name = `Column ${(task.subtask_columns?.length || 0) + 1}`
    updateTask({ subtask_columns: [...(task.subtask_columns || ['Open']), name] })
  }, [task.subtask_columns, updateTask])

  const handleRenameColumn = useCallback((oldName, newName) => {
    updateTask({
      subtask_columns: task.subtask_columns.map(c => c === oldName ? newName : c),
      subtasks: task.subtasks.map(s => s.state === oldName ? { ...s, state: newName } : s)
    })
  }, [task.subtask_columns, task.subtasks, updateTask])

  const handleDeleteColumn = useCallback((colName) => {
    const fallback = task.subtask_columns[0] || 'Open'
    updateTask({
      subtask_columns: task.subtask_columns.filter(c => c !== colName),
      subtasks: task.subtasks.map(s => s.state === colName ? { ...s, state: fallback } : s)
    })
  }, [task.subtask_columns, task.subtasks, updateTask])

  // ── Drag ───────────────────────────────────────────────────────────────
  function resolveColumn(overId) {
    if (!overId) return null
    if (overId.startsWith('subcol-')) return overId.replace('subcol-', '')
    const overSub = task.subtasks.find(s => s.id === overId)
    return overSub?.state ?? null
  }

  function handleDragStart({ active }) {
    setActiveId(active.id)
    lastOverRef.current = null
    document.body.classList.add('dragging')
  }

  function handleDragOver({ over }) {
    if (over) lastOverRef.current = over.id
  }

  function handleDragEnd({ active, over }) {
    document.body.classList.remove('dragging')
    setActiveId(null)

    const effectiveOverId = over?.id ?? lastOverRef.current
    lastOverRef.current = null

    const targetCol = resolveColumn(effectiveOverId)
    if (!targetCol) return
    const activeSub = task.subtasks.find(s => s.id === active.id)
    if (!activeSub || activeSub.state === targetCol) return
    handleUpdateSub({ ...activeSub, state: targetCol })
  }

  function handleDragCancel() {
    document.body.classList.remove('dragging')
    setActiveId(null)
    lastOverRef.current = null
  }

  const activeSub = activeId ? task.subtasks.find(s => s.id === activeId) : null
  const cols = task.subtask_columns || ['Open']
  const totalSubs = task.subtasks?.length || 0
  const lastCol = cols[cols.length - 1]
  const doneSubs = task.subtasks?.filter(s => s.state === lastCol).length || 0

  return (
    <div className="subtask-page">
      {/* Page header */}
      <div className="subtask-page-header">
        <div className="subtask-page-header-left">
          <button className="btn btn-ghost subtask-back-btn" onClick={onBack}>
            ← Board
          </button>
          <div className="subtask-page-divider" />
          <div className="subtask-page-title-block">
            <div
              className="subtask-page-accent-dot"
              style={{ background: accentColor }}
            />
            <span className="subtask-page-task-title">
              {task.title || <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>Untitled task</span>}
            </span>
            {task.category && (
              <span className="badge" style={{
                background: `color-mix(in srgb, ${accentColor} 14%, transparent)`,
                color: accentColor,
                border: `1px solid color-mix(in srgb, ${accentColor} 28%, transparent)`,
                marginLeft: 4
              }}>
                {task.category}
              </span>
            )}
            <span className="badge badge-state" style={{ marginLeft: 4 }}>{task.state}</span>
          </div>
        </div>
        <div className="subtask-page-header-right">
          {totalSubs > 0 && (
            <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
              {doneSubs}/{totalSubs} done
            </span>
          )}
          <button className="btn btn-ghost" style={{ fontSize: 'var(--text-xs)' }} onClick={handleAddColumn}>
            + column
          </button>
          <button className="btn btn-surface" style={{ fontSize: 'var(--text-xs)' }} onClick={() => onEditTask(task.id)}>
            Edit task
          </button>
        </div>
      </div>

      {/* Board */}
      <div className="subtask-page-board-wrap">
        <DndContext
          sensors={sensors}
          collisionDetection={kanbanCollision}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="subtask-page-board">
            {cols.map((colName, idx) => (
              <SubColumn
                key={colName}
                colName={colName}
                colIndex={idx}
                subtasks={task.subtasks.filter(s => s.state === colName)}
                onUpdateSub={handleUpdateSub}
                onDeleteSub={handleDeleteSub}
                onAddSub={handleAddSub}
                onRenameCol={handleRenameColumn}
                onDeleteCol={handleDeleteColumn}
              />
            ))}
            <button className="add-col-btn" onClick={handleAddColumn}>
              + add column
            </button>
          </div>

          <DragOverlay dropAnimation={{ duration: 160, easing: 'ease' }}>
            {activeSub ? (
              <div className="sub-card drag-overlay">
                <div className="sub-card-title">{activeSub.title || 'Untitled'}</div>
                {activeSub.note && <div className="sub-card-note">{activeSub.note}</div>}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  )
}
