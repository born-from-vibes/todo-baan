import React, { useState, useEffect, useCallback, useRef } from 'react'
import Board from './components/Board.jsx'
import TaskModal from './components/TaskModal.jsx'
import SubtaskPage from './components/SubtaskPage.jsx'
import ArchiveView from './components/ArchiveView.jsx'
import SettingsPanel from './components/SettingsPanel.jsx'
import { resolveCategoryColor } from './components/TaskModal.jsx'

const DEFAULT_SETTINGS = {
  colors: { color1: '#6366f1', color2: '#10b981', color3: '#f59e0b' },
  theme: {
    background: '#0f0f13', surface: '#1a1a24',
    border: '#2a2a38', text: '#e2e2f0', textMuted: '#6b6b82'
  }
}

function applyTheme(settings) {
  const r = document.documentElement.style
  r.setProperty('--color-1', settings.colors.color1)
  r.setProperty('--color-2', settings.colors.color2)
  r.setProperty('--color-3', settings.colors.color3)
  r.setProperty('--bg', settings.theme.background)
  r.setProperty('--surface', settings.theme.surface)
  r.setProperty('--border', settings.theme.border)
  r.setProperty('--text', settings.theme.text)
  r.setProperty('--text-muted', settings.theme.textMuted)
  // Derive surface layers from surface
  document.documentElement.style.setProperty('--border-subtle', settings.theme.border + '99')
}

export default function App() {
  const [tasks, setTasks] = useState([])
  const [done, setDone] = useState([])
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [activeView, setActiveView] = useState('board') // 'board' | 'archive'
  const [selectedTaskId, setSelectedTaskId] = useState(null)
  const [subtaskViewId, setSubtaskViewId] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [saveStatus, setSaveStatus] = useState('idle') // 'idle'|'saving'|'saved'|'error'
  const [categoryFilter, setCategoryFilter] = useState(null)
  const [loaded, setLoaded] = useState(false)

  const tasksDebounceRef = useRef(null)
  const settingsDebounceRef = useRef(null)
  const saveStatusTimerRef = useRef(null)

  // ── Load initial data ───────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch('/api/tasks').then(r => r.json()),
      fetch('/api/done').then(r => r.json()),
      fetch('/api/settings').then(r => r.json())
    ]).then(([tasksData, doneData, settingsData]) => {
      setTasks(tasksData.tasks || [])
      setDone(doneData.tasks || [])
      const merged = { ...DEFAULT_SETTINGS, ...settingsData, colors: { ...DEFAULT_SETTINGS.colors, ...settingsData.colors }, theme: { ...DEFAULT_SETTINGS.theme, ...settingsData.theme } }
      setSettings(merged)
      applyTheme(merged)
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

  // ── Apply theme on settings change ─────────────────────────────────────
  useEffect(() => {
    if (!loaded) return
    applyTheme(settings)
  }, [settings, loaded])

  // ── Autosave tasks ──────────────────────────────────────────────────────
  const saveTasks = useCallback((taskList) => {
    setSaveStatus('saving')
    return fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks: taskList })
    }).then(() => {
      setSaveStatus('saved')
      clearTimeout(saveStatusTimerRef.current)
      saveStatusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000)
    }).catch(() => setSaveStatus('error'))
  }, [])

  const saveDone = useCallback((doneList) => {
    return fetch('/api/done', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks: doneList })
    })
  }, [])

  const saveSettings = useCallback((s) => {
    return fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s)
    })
  }, [])

  useEffect(() => {
    if (!loaded) return
    clearTimeout(tasksDebounceRef.current)
    tasksDebounceRef.current = setTimeout(() => saveTasks(tasks), 600)
    return () => clearTimeout(tasksDebounceRef.current)
  }, [tasks, loaded, saveTasks])

  useEffect(() => {
    if (!loaded) return
    clearTimeout(settingsDebounceRef.current)
    settingsDebounceRef.current = setTimeout(() => saveSettings(settings), 800)
    return () => clearTimeout(settingsDebounceRef.current)
  }, [settings, loaded, saveSettings])

  // ── Manual save ─────────────────────────────────────────────────────────
  const handleManualSave = useCallback(() => {
    clearTimeout(tasksDebounceRef.current)
    clearTimeout(settingsDebounceRef.current)
    saveTasks(tasks)
    saveSettings(settings)
    saveDone(done)
  }, [tasks, done, settings, saveTasks, saveDone, saveSettings])

  // ── Task handlers ───────────────────────────────────────────────────────
  const handleMoveTask = useCallback((taskId, newState) => {
    if (newState === 'Done') {
      setTasks(prev => {
        const task = prev.find(t => t.id === taskId)
        if (!task) return prev
        const completed = { ...task, state: 'Done', completed_at: new Date().toISOString() }
        const next = prev.filter(t => t.id !== taskId)
        setDone(d => {
          const newDone = [...d, completed]
          saveDone(newDone)
          saveTasks(next)
          return newDone
        })
        return next
      })
    } else {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, state: newState } : t))
    }
  }, [saveDone, saveTasks])

  const handleUpdateTask = useCallback((updatedTask) => {
    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t))
  }, [])

  const handleDeleteTask = useCallback((taskId) => {
    setTasks(prev => prev.filter(t => t.id !== taskId))
    setSelectedTaskId(null)
  }, [])

  const handleCreateTask = useCallback((state = 'Open') => {
    const task = {
      id: crypto.randomUUID(),
      title: '',
      description: '',
      state,
      category: '',
      category_color: 1,
      created_at: new Date().toISOString(),
      subtask_columns: ['Open', 'In Progress', 'Done'],
      subtasks: []
    }
    setTasks(prev => [...prev, task])
    setSelectedTaskId(task.id)
    return task.id
  }, [])

  const handleRestoreTask = useCallback((taskId) => {
    setDone(prev => {
      const task = prev.find(t => t.id === taskId)
      if (!task) return prev
      const { completed_at, ...restored } = task
      const restoredTask = { ...restored, state: 'Open' }
      const next = prev.filter(t => t.id !== taskId)
      setTasks(t => [...t, restoredTask])
      saveDone(next)
      return next
    })
  }, [saveDone])

  const handleUpdateSettings = useCallback((newSettings) => {
    setSettings(newSettings)
  }, [])

  const handleImport = useCallback((bundle) => {
    setTasks(bundle.tasks.tasks || [])
    setDone(bundle.done.tasks || [])
    const merged = {
      ...DEFAULT_SETTINGS,
      ...bundle.settings,
      colors: { ...DEFAULT_SETTINGS.colors, ...bundle.settings.colors },
      theme: { ...DEFAULT_SETTINGS.theme, ...bundle.settings.theme }
    }
    setSettings(merged)
    applyTheme(merged)
  }, [])

  // ── Categories ──────────────────────────────────────────────────────────
  const categories = [...new Set(tasks.filter(t => t.category).map(t => t.category))]

  const filteredTasks = categoryFilter
    ? tasks.filter(t => t.category === categoryFilter)
    : tasks

  const selectedTask = selectedTaskId
    ? tasks.find(t => t.id === selectedTaskId) || done.find(t => t.id === selectedTaskId)
    : null

  const colorForCategory = (task) => resolveCategoryColor(task.category_color, settings.colors)

  if (!loaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
        loading...
      </div>
    )
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="header-logo">baan<span>.</span></div>
          <nav className="nav-tabs">
            <button className={`nav-tab ${activeView === 'board' ? 'active' : ''}`} onClick={() => setActiveView('board')}>Board</button>
            <button className={`nav-tab ${activeView === 'archive' ? 'active' : ''}`} onClick={() => setActiveView('archive')}>
              Archive {done.length > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', marginLeft: 4, color: 'var(--text-dim)' }}>{done.length}</span>}
            </button>
          </nav>
        </div>
        <div className="header-right">
          <span className={`save-indicator ${saveStatus}`}>
            {saveStatus === 'saving' ? 'saving…' : saveStatus === 'saved' ? '✓ saved' : saveStatus === 'error' ? 'error' : ''}
          </span>
          <button className="btn btn-surface" onClick={handleManualSave}>Save</button>
          <button className="btn btn-primary" onClick={() => handleCreateTask()}>+ New task</button>
          <button className="btn-icon" title="Settings" onClick={() => setSettingsOpen(v => !v)}>⚙</button>
        </div>
      </header>

      {/* Filter bar — only on board view */}
      {activeView === 'board' && categories.length > 0 && (
        <div className="filter-bar">
          <span className="filter-label">Filter</span>
          <button
            className={`filter-chip ${categoryFilter === null ? 'active' : ''}`}
            style={{ '--chip-color': 'var(--text-muted)' }}
            onClick={() => setCategoryFilter(null)}
          >
            All
          </button>
          {categories.map(cat => {
            const task = tasks.find(t => t.category === cat)
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

      {/* Main content */}
      {subtaskViewId ? (
        (() => {
          const subtaskTask = tasks.find(t => t.id === subtaskViewId)
          if (!subtaskTask) { setSubtaskViewId(null); return null }
          return (
            <SubtaskPage
              task={subtaskTask}
              settings={settings}
              onBack={() => setSubtaskViewId(null)}
              onUpdateTask={handleUpdateTask}
              onEditTask={(id) => { setSubtaskViewId(null); setSelectedTaskId(id) }}
            />
          )
        })()
      ) : activeView === 'board' ? (
        <Board
          tasks={filteredTasks}
          onMoveTask={handleMoveTask}
          onSelectTask={setSelectedTaskId}
          onCreateTask={handleCreateTask}
          colorForCategory={colorForCategory}
          doneCount={done.length}
        />
      ) : (
        <ArchiveView
          done={done}
          settings={settings}
          colorForCategory={colorForCategory}
          onRestoreTask={handleRestoreTask}
          onSelectTask={setSelectedTaskId}
        />
      )}

      {/* Task Modal — sibling to Board/SubtaskPage, never nested inside their DndContexts */}
      <div className={`panel-overlay ${selectedTask ? 'open' : ''}`} onClick={() => setSelectedTaskId(null)} />
      <TaskModal
        task={selectedTask}
        settings={settings}
        onClose={() => setSelectedTaskId(null)}
        onUpdateTask={handleUpdateTask}
        onDeleteTask={handleDeleteTask}
        onViewSubtasks={(id) => { setSelectedTaskId(null); setSubtaskViewId(id) }}
      />

      {/* Settings Panel */}
      <SettingsPanel
        open={settingsOpen}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onClose={() => setSettingsOpen(false)}
        onImport={handleImport}
      />
    </div>
  )
}
