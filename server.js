/**
 * server.js
 * Local development server (not used on Vercel)
 * Run with: npm run dev
 */

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes - delegate to their handlers
import processHandler from './api/process.js';
import downloadHandler from './api/download.js';
import indexHandler from './api/index.js';

app.post('/api/process', (req, res) => {
  processHandler(req, res);
});

app.get('/api/download/:id', (req, res) => {
  downloadHandler(req, res);
});

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📧 API: http://localhost:${PORT}/api/process`);
});
