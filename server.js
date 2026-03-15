import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import yaml from 'js-yaml'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')
const DIST_DIR = path.join(__dirname, 'dist')

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

const DEFAULT_SETTINGS = {
  colors: { color1: '#6366f1', color2: '#10b981', color3: '#f59e0b' },
  theme: {
    background: '#0f0f13',
    surface: '#1a1a24',
    border: '#2a2a38',
    text: '#e2e2f0',
    textMuted: '#6b6b82'
  }
}

const DEFAULT_TASKS = { tasks: [] }
const DEFAULT_DONE = { tasks: [] }

function readYaml(filename, fallback) {
  const filepath = path.join(DATA_DIR, filename)
  try {
    if (!fs.existsSync(filepath)) return fallback
    const content = fs.readFileSync(filepath, 'utf8')
    return yaml.load(content) || fallback
  } catch {
    return fallback
  }
}

function writeYaml(filename, data) {
  const filepath = path.join(DATA_DIR, filename)
  fs.writeFileSync(filepath, yaml.dump(data, { sortKeys: false, lineWidth: -1 }), 'utf8')
}

// Bootstrap settings on first run
if (!fs.existsSync(path.join(DATA_DIR, 'settings.yaml'))) {
  writeYaml('settings.yaml', DEFAULT_SETTINGS)
}

// API routes
app.get('/api/tasks', (req, res) => {
  res.json(readYaml('tasks.yaml', DEFAULT_TASKS))
})

app.post('/api/tasks', (req, res) => {
  writeYaml('tasks.yaml', req.body)
  res.json({ ok: true })
})

app.get('/api/done', (req, res) => {
  res.json(readYaml('done.yaml', DEFAULT_DONE))
})

app.post('/api/done', (req, res) => {
  writeYaml('done.yaml', req.body)
  res.json({ ok: true })
})

app.get('/api/settings', (req, res) => {
  res.json(readYaml('settings.yaml', DEFAULT_SETTINGS))
})

app.post('/api/settings', (req, res) => {
  writeYaml('settings.yaml', req.body)
  res.json({ ok: true })
})

// Export — bundle all three files into one JSON download
app.get('/api/export', (req, res) => {
  const bundle = {
    exported_at: new Date().toISOString(),
    tasks: readYaml('tasks.yaml', DEFAULT_TASKS),
    done: readYaml('done.yaml', DEFAULT_DONE),
    settings: readYaml('settings.yaml', DEFAULT_SETTINGS)
  }
  const date = new Date().toISOString().split('T')[0]
  res.setHeader('Content-Disposition', `attachment; filename="baan-export-${date}.json"`)
  res.setHeader('Content-Type', 'application/json')
  res.send(JSON.stringify(bundle, null, 2))
})

// Import — restore all three files from a bundle
app.post('/api/import', (req, res) => {
  const { tasks, done, settings } = req.body
  if (!tasks || !done || !settings) {
    return res.status(400).json({ error: 'Invalid bundle — missing tasks, done, or settings.' })
  }
  writeYaml('tasks.yaml', tasks)
  writeYaml('done.yaml', done)
  writeYaml('settings.yaml', settings)
  res.json({ ok: true })
})

// Serve built frontend in production
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR))
  app.get('*', (req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'))
  })
}

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`baan server running at http://localhost:${PORT}`)
})
