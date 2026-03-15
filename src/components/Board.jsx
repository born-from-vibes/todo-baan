import React, { useState, useRef } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDroppable, pointerWithin, rectIntersection
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const COLUMNS = [
  { id: 'Open',      label: 'Open',      accent: '#a3a3b8' },
  { id: 'Active',    label: 'Active',    accent: 'var(--color-1)' },
  { id: 'Audits',    label: 'Audits',    accent: 'var(--color-3)' },
  { id: 'Backlog',   label: 'Backlog',   accent: '#6b6b82' },
  { id: 'Suspended', label: 'Suspended', accent: '#f87171' },
  { id: 'Done',      label: 'Done',      accent: 'var(--color-2)' },
]

function kanbanCollision(args) {
  const hits = pointerWithin(args)
  if (hits.length > 0) return hits
  return rectIntersection(args)
}

function TaskCard({ task, colorForCategory, onSelect, isDragOverlay }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    '--card-accent': colorForCategory(task),
  }

  const cols = task.subtask_columns || []
  const lastCol = cols[cols.length - 1]
  const completedSubs = task.subtasks?.filter(s => s.state === lastCol).length ?? 0
  const totalSubs = task.subtasks?.length ?? 0
  const progress = totalSubs > 0 ? (completedSubs / totalSubs) * 100 : 0

  const cls = ['task-card', isDragging && 'dragging', isDragOverlay && 'drag-overlay']
    .filter(Boolean).join(' ')

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cls}
      {...attributes}
      {...listeners}
      onClick={e => { if (!isDragging) { e.stopPropagation(); onSelect(task.id) } }}
    >
      <div className="card-title">
        {task.title || <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>Untitled task</span>}
      </div>
      <div className="card-meta">
        <span className="card-category">{task.category || ''}</span>
        {totalSubs > 0 && (
          <div className="card-progress">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span>{completedSubs}/{totalSubs}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function Column({ col, tasks, colorForCategory, onSelect, onCreateTask }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${col.id}` })

  return (
    <div
      ref={setNodeRef}
      className={`column ${isOver ? 'drag-over' : ''}`}
      style={{ '--col-accent': col.accent }}
    >
      <div className="column-header">
        <div className="column-title-row">
          <div className="column-dot" />
          <span className="column-title">{col.label}</span>
        </div>
        <span className="column-count">{tasks.length}</span>
      </div>

      <div className="column-body">
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              colorForCategory={colorForCategory}
              onSelect={onSelect}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="empty-placeholder">drop here</div>
        )}
      </div>

      <div className="add-task-form">
        <button className="column-add-btn" onClick={() => onCreateTask(col.id)}>
          + new task
        </button>
      </div>
    </div>
  )
}

// Narrow sentinel column — drag here to archive immediately
function ArchiveDropZone({ doneCount, isDragging }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'col-__archive__' })

  return (
    <div
      ref={setNodeRef}
      className={`archive-drop-zone ${isOver ? 'archive-drop-over' : ''} ${isDragging ? 'archive-drop-active' : ''}`}
    >
      <div className="archive-drop-inner">
        <span className="archive-drop-icon">◎</span>
        <span className="archive-drop-label">Archive</span>
        {doneCount > 0 && (
          <span className="archive-drop-count">{doneCount}</span>
        )}
      </div>
    </div>
  )
}

export default function Board({ tasks, onMoveTask, onSelectTask, onCreateTask, colorForCategory, doneCount }) {
  const [activeId, setActiveId] = useState(null)
  const lastOverRef = useRef(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null

  function resolveColumn(overId) {
    if (!overId) return null
    if (overId.startsWith('col-')) {
      const colId = overId.replace('col-', '')
      // Archive drop zone maps to 'Done' which App handles as archival
      return colId === '__archive__' ? 'Done' : colId
    }
    const overTask = tasks.find(t => t.id === overId)
    return overTask?.state ?? null
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

    const sourceTask = tasks.find(t => t.id === active.id)
    if (!sourceTask || sourceTask.state === targetCol) return

    onMoveTask(active.id, targetCol)
  }

  function handleDragCancel() {
    document.body.classList.remove('dragging')
    setActiveId(null)
    lastOverRef.current = null
  }

  return (
    <div className="board-wrapper">
      <DndContext
        sensors={sensors}
        collisionDetection={kanbanCollision}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="board">
          {COLUMNS.map(col => (
            <Column
              key={col.id}
              col={col}
              tasks={tasks.filter(t => t.state === col.id)}
              colorForCategory={colorForCategory}
              onSelect={onSelectTask}
              onCreateTask={onCreateTask}
            />
          ))}
          <ArchiveDropZone doneCount={doneCount} isDragging={!!activeId} />
        </div>

        <DragOverlay dropAnimation={{ duration: 180, easing: 'ease' }}>
          {activeTask ? (
            <TaskCard
              task={activeTask}
              colorForCategory={colorForCategory}
              onSelect={() => {}}
              isDragOverlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
