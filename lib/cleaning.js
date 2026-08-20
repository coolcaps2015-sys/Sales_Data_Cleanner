/**
 * cleaning.js
 * Converts messy raw sales exports into clean, structured data
 */

const HEADER_KEYWORDS = [
  "date", "particulars", "buyer", "voucher", "quantity", "qty",
  "rate", "value", "amount", "total", "gst", "narration", "customer",
  "product", "item", "invoice"
];

const ID_COLUMNS_CANDIDATES = [
  "date", "buyer", "voucher type", "voucher no.",
  "voucher no", "voucher ref. no.", "gstin/uin", "pan no.", "customer",
  "narration"
];

const TAX_TOKENS = ["gst", "cgst", "sgst", "igst", "tcs", "tax", "duty"];
const CHARGE_TOKENS = ["freight", "round off", "fluctuation"];

function scoreHeaderRow(rowValues) {
  let score = 0;
  for (const v of rowValues) {
    if (typeof v === 'string') {
      const low = v.trim().toLowerCase();
      if (HEADER_KEYWORDS.some(kw => low.includes(kw))) {
        score++;
      }
    }
  }
  return score;
}

function findHeaderRow(data) {
  let bestIdx = 0, bestScore = -1;
  const scanLimit = Math.min(30, data.length);
  
  for (let i = 0; i < scanLimit; i++) {
    const row = data[i];
    const score = scoreHeaderRow(row);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  
  return bestIdx;
}

function looksNumeric(values) {
  const sample = values
    .filter(v => v != null)
    .map(v => String(v).replace(/,/g, '').replace(/₹/g, '').trim());
  
  if (sample.length === 0) return false;
  
  const numericCount = sample.filter(s => /^-?\d+(\.\d+)?$/.test(s)).length;
  return numericCount / sample.length > 0.6;
}

function toNumeric(value) {
  if (value == null) return NaN;
  const str = String(value).replace(/,/g, '').replace(/₹/g, '').trim();
  const num = parseFloat(str);
  return isNaN(num) ? NaN : num;
}

function buildStructuredFrame(rawData, headerIdx) {
  const headers = rawData[headerIdx];
  
  const cleanHeaders = [];
  const seen = {};
  
  for (let h of headers) {
    let name = (h != null ? String(h).trim() : "Unnamed");
    name = name.replace(/\s+/g, " ");
    
    if (seen[name]) {
      seen[name]++;
      name = `${name} (${seen[name]})`;
    } else {
      seen[name] = 0;
    }
    cleanHeaders.push(name);
  }
  
  const rows = [];
  for (let i = headerIdx + 1; i < rawData.length; i++) {
    const row = {};
    for (let j = 0; j < cleanHeaders.length; j++) {
      row[cleanHeaders[j]] = rawData[i][j];
    }
    rows.push(row);
  }
  
  return { headers: cleanHeaders, rows };
}

function isAllEmpty(row) {
  return Object.values(row).every(v => v == null || String(v).trim() === '');
}

function cleanDataframe(rows, headers) {
  const audit = [];
  const data = rows.filter(r => !isAllEmpty(r));
  
  audit.push(
    `Removed ${rows.length - data.length} completely blank rows (no data existed in them).`
  );
  
  // Flag transaction rows vs line items
  const voucherTypeCol = headers.find(c => c.toLowerCase().trim() === 'voucher type');
  
  if (voucherTypeCol) {
    for (const row of data) {
      const v = row[voucherTypeCol];
      row['Row Type'] = (v != null && String(v).trim() !== '') ? 'Transaction' : 'Line Item';
    }
    const nTxn = data.filter(r => r['Row Type'] === 'Transaction').length;
    const nItem = data.filter(r => r['Row Type'] === 'Line Item').length;
    audit.push(
      `Tagged each row as 'Transaction' (${nTxn} rows) or 'Line Item' (${nItem} rows). ` +
      `A transaction's total Value already equals the sum of its Line Item rows below it.`
    );
  }
  
  // Forward-fill identifying columns
  const idColsFound = headers.filter(c => 
    ID_COLUMNS_CANDIDATES.includes(c.toLowerCase().trim())
  );
  
  for (const col of idColsFound) {
    let nBefore = data.filter(r => r[col] == null || String(r[col]).trim() === '').length;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][col] == null || String(data[i][col]).trim() === '') {
        data[i][col] = data[i - 1][col];
      }
    }
    
    let nAfter = data.filter(r => r[col] == null || String(r[col]).trim() === '').length;
    if (nBefore > nAfter) {
      audit.push(
        `Filled ${nBefore - nAfter} blank cells in '${col}' by carrying forward ` +
        `the value from the transaction's main row.`
      );
    }
  }
  
  // Convert numeric columns
  for (const col of headers) {
    if (idColsFound.includes(col)) continue;
    
    const values = data.map(r => r[col]);
    if (looksNumeric(values)) {
      for (const row of data) {
        row[col] = toNumeric(row[col]);
      }
    }
  }
  
  // Parse dates
  const dateCols = headers.filter(c => c.toLowerCase().includes('date'));
  for (const col of dateCols) {
    for (const row of data) {
      if (row[col]) {
        const d = new Date(row[col]);
        row[col] = isNaN(d.getTime()) ? null : d;
      }
    }
  }
  
  // Consolidate tax columns
  const taxCols = headers.filter(c => 
    TAX_TOKENS.some(tok => c.toLowerCase().includes(tok))
  );
  
  if (taxCols.length > 0) {
    for (const row of data) {
      let sum = 0;
      for (const col of taxCols) {
        const val = row[col];
        if (typeof val === 'number' && !isNaN(val)) sum += val;
      }
      row['Total Tax (calculated)'] = sum > 0 ? sum : null;
    }
    audit.push(
      `Added 'Total Tax (calculated)' by summing ${taxCols.length} separate tax/duty columns.`
    );
    if (!headers.includes('Total Tax (calculated)')) {
      headers.push('Total Tax (calculated)');
    }
  }
  
  // Consolidate charge columns
  const chargeCols = headers.filter(c => 
    CHARGE_TOKENS.some(tok => c.toLowerCase().includes(tok))
  );
  
  if (chargeCols.length > 0) {
    for (const row of data) {
      let sum = 0;
      for (const col of chargeCols) {
        const val = row[col];
        if (typeof val === 'number' && !isNaN(val)) sum += val;
      }
      row['Total Charges (calculated)'] = sum > 0 ? sum : null;
    }
    audit.push(
      `Added 'Total Charges (calculated)' by summing ${chargeCols.length} freight/charge columns.`
    );
    if (!headers.includes('Total Charges (calculated)')) {
      headers.push('Total Charges (calculated)');
    }
  }
  
  // Identify amount column
  let amountCol = null;
  const candidates = ["value", "gross total", "amount", "total"];
  
  for (const cand of candidates) {
    const match = headers.find(c => c.toLowerCase().trim() === cand);
    if (match) {
      amountCol = match;
      break;
    }
  }
  
  // Flag footer rows
  const particularsCol = headers.find(c => c.toLowerCase().trim() === 'particulars');
  if (particularsCol) {
    const footerKeywords = ["grand total", "total", "closing balance"];
    for (const row of data) {
      const val = String(row[particularsCol] || '').trim().toLowerCase();
      if (footerKeywords.includes(val)) {
        row['Row Type'] = 'Footer/Total (excluded from analysis)';
      }
    }
  }
  
  return {
    headers,
    rows: data,
    audit,
    metadata: {
      amountCol,
      dateCol: dateCols[0] || null,
      idCols: idColsFound
    }
  };
}

export {
  findHeaderRow,
  buildStructuredFrame,
  cleanDataframe,
  // ...keep all the same names
};