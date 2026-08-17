/**
 * api/process.js
 * Main API endpoint for file upload and processing
 * Vercel serverless function
 */

import { v4 as uuidv4 } from 'uuid';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

import { findHeaderRow, buildStructuredFrame, cleanDataframe } from '../lib/cleaning.js';
import { monthlySummary, topBuyers, topProducts, generateInsights } from '../lib/analysis.js';
import { createWorkbook, saveWorkbook } from '../lib/excel_builder.js';

const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];
const MAX_FILE_SIZE_MB = 25;

// Store in memory (Vercel limits disk write) or use temp directory
const TMP_DIR = process.env.TMP || process.env.TMPDIR || '/tmp';
const OUTPUT_MAP = new Map(); // In-memory storage for downloads

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const form = formidable({
    maxFileSize: MAX_FILE_SIZE_MB * 1024 * 1024,
  });

  try {
    const [fields, files] = await form.parse(req);
    const fileArray = files.file;
    
    if (!fileArray || fileArray.length === 0) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const uploadedFile = fileArray[0];
    const ext = path.extname(uploadedFile.originalFilename || '').toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return res.status(400).json({ 
        error: `Unsupported file type '${ext}'. Upload .xlsx, .xls, or .csv` 
      });
    }

    const jobId = uuidv4().substring(0, 12);
    const fileContent = fs.readFileSync(uploadedFile.filepath);
    
    // Parse Excel/CSV
    let rawData;
    try {
      const wb = XLSX.read(fileContent, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    } catch (parseErr) {
      return res.status(400).json({ error: `Failed to parse file: ${parseErr.message}` });
    }

    // Find header row
    const headerIdx = findHeaderRow(rawData);
    
    // Build structured frame
    const { headers, rows } = buildStructuredFrame(rawData, headerIdx);
    
    // Clean data
    const { headers: cleanedHeaders, rows: cleanedRows, audit, metadata } = cleanDataframe(rows, headers);
    
    // Analysis
    const monthlyData = monthlySummary(cleanedRows, cleanedHeaders, metadata);
    const buyersData = topBuyers(cleanedRows, cleanedHeaders, metadata);
    const productsData = topProducts(cleanedRows, cleanedHeaders, metadata);
    const insights = generateInsights(cleanedRows, cleanedHeaders, metadata, monthlyData, buyersData, productsData);

    // Create audit log message
    const auditWithHeader = [
      `Detected the real column-header row at spreadsheet row ${headerIdx + 1} ` +
      `(rows above it were letterhead/title text, preserved as-is in 'Raw Data').`,
      ...audit
    ];

    // Build workbook
    const wb = createWorkbook(rawData, { rows: cleanedRows, headers: cleanedHeaders }, cleanedHeaders, auditWithHeader, monthlyData, buyersData, productsData, insights);
    
    // Save to buffer instead of disk
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
    
    // Store in memory map (expires after some time)
    OUTPUT_MAP.set(jobId, {
      buffer,
      filename: 'Sales_Report_Dashboard.xlsx',
      timestamp: Date.now()
    });

    // Clean up old entries (older than 1 hour)
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    for (const [key, value] of OUTPUT_MAP.entries()) {
      if (value.timestamp < oneHourAgo) {
        OUTPUT_MAP.delete(key);
      }
    }

    return res.status(200).json({
      job_id: jobId,
      rows_processed: cleanedRows.length,
      audit_log: auditWithHeader,
      insights: insights,
      download_url: `/api/download/${jobId}`
    });

  } catch (err) {
    console.error('Processing error:', err);
    return res.status(500).json({ error: `Processing failed: ${err.message}` });
  }
}

// Export for module access
export { OUTPUT_MAP };
