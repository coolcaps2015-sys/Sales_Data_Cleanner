"""
analysis.py
Rule-based (no AI) analysis of the cleaned sales DataFrame.
Produces:
- monthly_summary: DataFrame of month, total sales, tax, transaction count
- top_buyers / top_products: DataFrames
- insights: list of plain-English strings generated from fixed rules
  (this replaces the "AI summary" — deterministic and auditable)
"""

import pandas as pd


def _transaction_level(df):
    """
    Return only the rows that represent a whole transaction (not the
    line-item detail rows beneath it), to avoid double-counting revenue
    when a transaction's total already equals the sum of its line items.
    Falls back to the full frame if no Row Type flag exists.
    """
    if "Row Type" in df.columns:
        return df[df["Row Type"] == "Transaction"]
    return df


def monthly_summary(df):
    date_col = df.attrs.get("date_col")
    amount_col = df.attrs.get("amount_col")
    if not date_col or not amount_col:
        return pd.DataFrame()

    base = _transaction_level(df)
    tmp = base[[date_col, amount_col]].dropna(subset=[date_col])
    tmp["Month"] = tmp[date_col].dt.to_period("M").astype(str)
    grouped = tmp.groupby("Month").agg(
        Total_Sales=(amount_col, "sum"),
        Transactions=(amount_col, "count"),
        Avg_Transaction=(amount_col, "mean"),
    ).reset_index()
    grouped = grouped.sort_values("Month")
    grouped["Growth %"] = grouped["Total_Sales"].pct_change().mul(100).round(2)
    return grouped


def top_buyers(df, n=10):
    amount_col = df.attrs.get("amount_col")
    buyer_col = None
    for c in df.columns:
        if c.strip().lower() == "buyer":
            buyer_col = c
            break
    if buyer_col is None or amount_col is None:
        return pd.DataFrame()

    base = _transaction_level(df)
    grouped = (
        base.groupby(buyer_col)[amount_col]
        .sum()
        .sort_values(ascending=False)
        .head(n)
        .reset_index()
    )
    grouped.columns = ["Buyer", "Total Sales"]
    return grouped


def top_products(df, n=10):
    amount_col = df.attrs.get("amount_col")
    product_col = None
    for c in df.columns:
        if c.strip().lower() == "particulars":
            product_col = c
            break
    if product_col is None or amount_col is None:
        return pd.DataFrame()

    # Use line-item rows only: in split-row exports, the 'Particulars'
    # column holds the buyer/party name on the main transaction row but
    # the actual product/item name on the rows below it.
    if "Row Type" in df.columns:
        base = df[df["Row Type"] == "Line Item"]  # excludes Transaction rows AND Footer/Total rows
    else:
        base = df

    grouped = (
        base.groupby(product_col)[amount_col]
        .sum()
        .sort_values(ascending=False)
        .head(n)
        .reset_index()
    )
    grouped.columns = ["Product / Particulars", "Total Sales"]
    return grouped


def generate_insights(df, monthly_df, buyers_df, products_df):
    """
    Fixed, deterministic business rules -> plain-English insight strings.
    No AI / LLM involved: every line here is a hardcoded rule so output
    is 100% reproducible and auditable.
    """
    insights = []
    amount_col = df.attrs.get("amount_col")
    base = _transaction_level(df)

    if amount_col:
        total_sales = base[amount_col].sum()
        insights.append(f"Total sales value across all records: {total_sales:,.2f}")

    if not monthly_df.empty:
        latest = monthly_df.iloc[-1]
        insights.append(
            f"Most recent month in the data ({latest['Month']}) recorded "
            f"{latest['Total_Sales']:,.2f} in sales across {int(latest['Transactions'])} transactions."
        )
        if pd.notna(latest["Growth %"]):
            direction = "grew" if latest["Growth %"] >= 0 else "declined"
            insights.append(
                f"Sales {direction} by {abs(latest['Growth %'])}% compared to the previous month."
            )
        # Flag consecutive declining months
        declines = (monthly_df["Growth %"] < 0).astype(int)
        max_streak = 0
        streak = 0
        for v in declines:
            streak = streak + 1 if v == 1 else 0
            max_streak = max(max_streak, streak)
        if max_streak >= 2:
            insights.append(
                f"⚠ Suggestion: sales declined for {max_streak} consecutive months at some point "
                f"in this data — worth reviewing what changed in that period."
            )

    if not buyers_df.empty:
        top = buyers_df.iloc[0]
        total = buyers_df["Total Sales"].sum()
        share = (buyers_df.head(3)["Total Sales"].sum() / base[amount_col].sum() * 100) if amount_col else None
        insights.append(f"Top buyer: {top['Buyer']} ({top['Total Sales']:,.2f} total).")
        if share is not None and share >= 50:
            insights.append(
                f"⚠ Suggestion: your top 3 buyers account for {share:.1f}% of total sales — "
                f"high customer concentration risk. Consider diversifying the buyer base."
            )

    if not products_df.empty:
        top_p = products_df.iloc[0]
        insights.append(f"Best-selling product/line item: {top_p['Product / Particulars']} "
                         f"({top_p['Total Sales']:,.2f} total).")

    if not insights:
        insights.append("Not enough recognizable sales/date columns were found to generate insights.")

    return insights
