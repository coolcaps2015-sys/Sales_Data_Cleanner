/**
 * api/download.js
 * Download endpoint for processed files
 * Vercel serverless function
 */

import { OUTPUT_MAP } from './process.js';

export default function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Missing job ID' });
  }

  const fileData = OUTPUT_MAP.get(id);
  
  if (!fileData) {
    return res.status(404).json({ error: 'File not found or already expired.' });
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fileData.filename}"`);
  
  return res.status(200).send(fileData.buffer);
}
