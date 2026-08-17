/**
 * analysis.js
 * Rule-based analysis of cleaned sales data
 */

function getTransactionLevel(rows, headers) {
  const hasRowType = headers.includes('Row Type');
  if (!hasRowType) return rows;
  return rows.filter(r => r['Row Type'] === 'Transaction');
}

function monthlySummary(rows, headers, metadata) {
  const { dateCol, amountCol } = metadata;
  
  if (!dateCol || !amountCol) return [];
  
  const base = getTransactionLevel(rows, headers);
  
  const monthMap = new Map();
  
  for (const row of base) {
    const date = row[dateCol];
    const amount = row[amountCol];
    
    if (!date || typeof amount !== 'number' || isNaN(amount)) continue;
    
    const d = new Date(date);
    const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    
    if (!monthMap.has(yearMonth)) {
      monthMap.set(yearMonth, { month: yearMonth, total: 0, count: 0, amounts: [] });
    }
    
    const m = monthMap.get(yearMonth);
    m.total += amount;
    m.count += 1;
    m.amounts.push(amount);
  }
  
  const result = Array.from(monthMap.values()).map(m => ({
    Month: m.month,
    Total_Sales: parseFloat(m.total.toFixed(2)),
    Transactions: m.count,
    Avg_Transaction: parseFloat((m.total / m.count).toFixed(2))
  }));
  
  result.sort((a, b) => a.Month.localeCompare(b.Month));
  
  // Add growth %
  for (let i = 1; i < result.length; i++) {
    const prev = result[i - 1].Total_Sales;
    const curr = result[i].Total_Sales;
    result[i].Growth_Percent = parseFloat(((curr - prev) / prev * 100).toFixed(2));
  }
  result[0].Growth_Percent = 0;
  
  return result;
}

function topBuyers(rows, headers, metadata, n = 10) {
  const { amountCol } = metadata;
  
  if (!amountCol) return [];
  
  const buyerCol = headers.find(c => c.toLowerCase().trim() === 'buyer');
  if (!buyerCol) return [];
  
  const base = getTransactionLevel(rows, headers);
  
  const buyerMap = new Map();
  
  for (const row of base) {
    const buyer = row[buyerCol];
    const amount = row[amountCol];
    
    if (!buyer || typeof amount !== 'number' || isNaN(amount)) continue;
    
    const key = String(buyer).trim();
    if (!buyerMap.has(key)) {
      buyerMap.set(key, 0);
    }
    buyerMap.set(key, buyerMap.get(key) + amount);
  }
  
  const result = Array.from(buyerMap.entries())
    .map(([buyer, total]) => ({ Buyer: buyer, Total_Sales: parseFloat(total.toFixed(2)) }))
    .sort((a, b) => b.Total_Sales - a.Total_Sales)
    .slice(0, n);
  
  return result;
}

function topProducts(rows, headers, metadata, n = 10) {
  const { amountCol } = metadata;
  
  if (!amountCol) return [];
  
  const productCol = headers.find(c => c.toLowerCase().trim() === 'particulars');
  if (!productCol) return [];
  
  let base = rows;
  if (headers.includes('Row Type')) {
    base = rows.filter(r => r['Row Type'] === 'Line Item');
  }
  
  const productMap = new Map();
  
  for (const row of base) {
    const product = row[productCol];
    const amount = row[amountCol];
    
    if (!product || typeof amount !== 'number' || isNaN(amount)) continue;
    
    const key = String(product).trim();
    if (!productMap.has(key)) {
      productMap.set(key, 0);
    }
    productMap.set(key, productMap.get(key) + amount);
  }
  
  const result = Array.from(productMap.entries())
    .map(([product, total]) => ({ 
      'Product / Particulars': product,
      Total_Sales: parseFloat(total.toFixed(2))
    }))
    .sort((a, b) => b.Total_Sales - a.Total_Sales)
    .slice(0, n);
  
  return result;
}

function generateInsights(rows, headers, metadata, monthlyData, buyersData, productsData) {
  const { amountCol } = metadata;
  const insights = [];
  
  const base = getTransactionLevel(rows, headers);
  
  if (amountCol) {
    const totalSales = base.reduce((sum, r) => {
      const v = r[amountCol];
      return sum + (typeof v === 'number' && !isNaN(v) ? v : 0);
    }, 0);
    insights.push(`Total sales value across all records: ${totalSales.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
  }
  
  if (monthlyData.length > 0) {
    const latest = monthlyData[monthlyData.length - 1];
    insights.push(
      `Most recent month in the data (${latest.Month}) recorded ` +
      `${latest.Total_Sales.toLocaleString('en-IN', { maximumFractionDigits: 2 })} in sales across ${latest.Transactions} transactions.`
    );
    
    if (latest.Growth_Percent !== undefined) {
      const direction = latest.Growth_Percent >= 0 ? 'grew' : 'declined';
      insights.push(
        `Sales ${direction} by ${Math.abs(latest.Growth_Percent)}% compared to the previous month.`
      );
    }
  }
  
  if (buyersData.length > 0) {
    const top = buyersData[0];
    const topThreeTotal = buyersData.slice(0, 3).reduce((sum, b) => sum + b.Total_Sales, 0);
    const totalSales = base.reduce((sum, r) => {
      const v = r[amountCol];
      return sum + (typeof v === 'number' && !isNaN(v) ? v : 0);
    }, 0);
    const share = (topThreeTotal / totalSales * 100).toFixed(1);
    
    insights.push(`Top buyer: ${top.Buyer} (${top.Total_Sales.toLocaleString('en-IN', { maximumFractionDigits: 2 })} total).`);
    
    if (share >= 50) {
      insights.push(
        `⚠️ Suggestion: your top 3 buyers account for ${share}% of total sales — ` +
        `high customer concentration risk. Consider diversifying the buyer base.`
      );
    }
  }
  
  if (productsData.length > 0) {
    const top = productsData[0];
    insights.push(
      `Best-selling product/line item: ${top['Product / Particulars']} ` +
      `(${top.Total_Sales.toLocaleString('en-IN', { maximumFractionDigits: 2 })} total).`
    );
  }
  
  if (insights.length === 0) {
    insights.push('Not enough recognizable sales/date columns were found to generate insights.');
  }
  
  return insights;
}

module.exports = {
  monthlySummary,
  topBuyers,
  topProducts,
  generateInsights
};
