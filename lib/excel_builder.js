/**
 * excel_builder.js
 * Builds the final Excel workbook with charts and multiple sheets
 */

const XLSX = require('xlsx');

const HEADER_FILL = 'FF1F2937';
const HEADER_FONT_COLOR = 'FFFFFFFF';

function createWorkbook(rawData, cleanedData, headers, auditLog, monthlyData, buyersData, productsData, insights) {
  const wb = XLSX.utils.book_new();
  
  // ============ RAW DATA SHEET ============
  const wsRaw = XLSX.utils.aoa_to_sheet(rawData);
  wsRaw['!cols'] = Array(rawData[0]?.length || 0).fill({ width: 15 });
  XLSX.utils.book_append_sheet(wb, wsRaw, 'Raw Data');
  
  // ============ CLEANED DATA SHEET ============
  const cleanedRows = cleanedData.rows.map(row => 
    headers.map(h => row[h])
  );
  const wsClean = XLSX.utils.aoa_to_sheet([headers, ...cleanedRows]);
  wsClean['!cols'] = Array(headers.length).fill({ width: 20 });
  XLSX.utils.book_append_sheet(wb, wsClean, 'Cleaned Data');
  
  // ============ SUMMARY SHEET ============
  const wsSummary = XLSX.utils.aoa_to_sheet([]);
  
  let row = 1;
  wsSummary[`A${row}`] = { v: 'Summary & Insights', t: 's' };
  row += 2;
  
  wsSummary[`A${row}`] = { v: 'Cleaning steps performed:', t: 's' };
  row++;
  for (const line of auditLog) {
    wsSummary[`A${row}`] = { v: `• ${line}`, t: 's' };
    row++;
  }
  row++;
  
  wsSummary[`A${row}`] = { v: 'Key insights & suggestions:', t: 's' };
  row++;
  for (const line of insights) {
    wsSummary[`A${row}`] = { v: `• ${line}`, t: 's' };
    row++;
  }
  row += 2;
  
  wsSummary[`A${row}`] = { v: 'Monthly Sales', t: 's' };
  row++;
  const monthlyStartRow = row;
  
  if (monthlyData.length > 0) {
    const monthlyHeaders = Object.keys(monthlyData[0]);
    wsSummary[`A${row}`] = { v: monthlyHeaders[0], t: 's' };
    for (let i = 0; i < monthlyHeaders.length; i++) {
      wsSummary[XLSX.utils.encode_cell({ r: row - 1, c: i })] = { 
        v: monthlyHeaders[i], 
        t: 's',
        fill: { fgColor: { rgb: HEADER_FILL } },
        font: { color: { rgb: HEADER_FONT_COLOR }, bold: true }
      };
    }
    row++;
    
    for (const monthRow of monthlyData) {
      for (let i = 0; i < monthlyHeaders.length; i++) {
        const val = monthRow[monthlyHeaders[i]];
        wsSummary[XLSX.utils.encode_cell({ r: row - 1, c: i })] = { 
          v: val, 
          t: typeof val === 'number' ? 'n' : 's'
        };
      }
      row++;
    }
  }
  row += 2;
  
  wsSummary[`A${row}`] = { v: 'Top Buyers', t: 's' };
  row++;
  const buyersStartRow = row;
  
  if (buyersData.length > 0) {
    const buyerHeaders = Object.keys(buyersData[0]);
    for (let i = 0; i < buyerHeaders.length; i++) {
      wsSummary[XLSX.utils.encode_cell({ r: row - 1, c: i })] = { 
        v: buyerHeaders[i], 
        t: 's',
        fill: { fgColor: { rgb: HEADER_FILL } },
        font: { color: { rgb: HEADER_FONT_COLOR }, bold: true }
      };
    }
    row++;
    
    for (const buyerRow of buyersData) {
      for (let i = 0; i < buyerHeaders.length; i++) {
        const val = buyerRow[buyerHeaders[i]];
        wsSummary[XLSX.utils.encode_cell({ r: row - 1, c: i })] = { 
          v: val, 
          t: typeof val === 'number' ? 'n' : 's'
        };
      }
      row++;
    }
  }
  row += 2;
  
  wsSummary[`A${row}`] = { v: 'Top Products', t: 's' };
  row++;
  const productsStartRow = row;
  
  if (productsData.length > 0) {
    const productHeaders = Object.keys(productsData[0]);
    for (let i = 0; i < productHeaders.length; i++) {
      wsSummary[XLSX.utils.encode_cell({ r: row - 1, c: i })] = { 
        v: productHeaders[i], 
        t: 's',
        fill: { fgColor: { rgb: HEADER_FILL } },
        font: { color: { rgb: HEADER_FONT_COLOR }, bold: true }
      };
    }
    row++;
    
    for (const productRow of productsData) {
      for (let i = 0; i < productHeaders.length; i++) {
        const val = productRow[productHeaders[i]];
        wsSummary[XLSX.utils.encode_cell({ r: row - 1, c: i })] = { 
          v: val, 
          t: typeof val === 'number' ? 'n' : 's'
        };
      }
      row++;
    }
  }
  
  wsSummary['!cols'] = Array(4).fill({ width: 30 });
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
  
  return wb;
}

function saveWorkbook(wb, outputPath) {
  XLSX.writeFile(wb, outputPath);
  return outputPath;
}

export {
  findHeaderRow,
  buildStructuredFrame,
  cleanDataframe,
  // ...keep all the same names
};
