/**
 * api/index.js
 * Main entry point - serves the frontend
 * Vercel serverless function
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default function handler(req, res) {
  try {
    // Serve index.html for root and any non-API routes
    if (!req.url.startsWith('/api/')) {
      const indexPath = path.join(__dirname, '../public/index.html');
      
      if (fs.existsSync(indexPath)) {
        const html = fs.readFileSync(indexPath, 'utf-8');
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(html);
      }
    }
    
    return res.status(404).json({ error: 'Not found' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
