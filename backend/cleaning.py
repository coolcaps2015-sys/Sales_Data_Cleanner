"""
cleaning.py
Cleans messy raw sales exports (e.g. Tally 'Sales Register' exports) into a
tidy, analysis-ready DataFrame WITHOUT dropping any original data.

Design goals:
- Zero data loss: original raw sheet is always kept as-is in a separate
  "Raw Data" sheet in the final workbook. Cleaning only produces an
  ADDITIONAL structured copy; nothing is deleted from the source.
- Works on real-world messy exports: letterhead junk rows at the top,
  a header row buried a few rows down, transactions split across
  multiple physical rows, numbers stored as text, scattered/duplicate
  tax columns, blank rows, merged-looking cells, etc.
"""

import re
import pandas as pd
import numpy as np

# Keywords we expect to see in a real header row of a sales export.
HEADER_KEYWORDS = [
    "date", "particulars", "buyer", "voucher", "quantity", "qty",
    "rate", "value", "amount", "total", "gst", "narration", "customer",
    "product", "item", "invoice"
]

# Columns that identify a "transaction" and should be forward-filled
# down across the split item-detail rows that follow it.
ID_COLUMNS_CANDIDATES = [
    "date", "buyer", "voucher type", "voucher no.",
    "voucher no", "voucher ref. no.", "gstin/uin", "pan no.", "customer",
    "narration"
]
# NOTE: 'particulars' is deliberately excluded from forward-fill. In many
# exports (e.g. Tally) it holds the buyer/party name on a transaction's
# main row but the individual product/item name on the detail rows below
# it -- forward-filling would overwrite real product names with the buyer
# name. It is treated as its own column instead.

# Any column whose header contains one of these tokens is a tax/duty
# column and will be summed into a single "Total Tax" column.
TAX_TOKENS = ["gst", "cgst", "sgst", "igst", "tcs", "tax", "duty"]

# Any column containing these tokens is treated as a freight/charge
# add-on rather than a tax (kept separate, still summed for transparency).
CHARGE_TOKENS = ["freight", "round off", "fluctuation"]


def _score_header_row(row_values):
    """Count how many cells in a row look like known header labels."""
    score = 0
    for v in row_values:
        if isinstance(v, str):
            low = v.strip().lower()
            if any(kw in low for kw in HEADER_KEYWORDS):
                score += 1
    return score


def find_header_row(raw_df):
    """
    Scan the first ~30 rows of a raw (header=None) DataFrame and return
    the index of the row that looks most like the real column-header row.
    """
    best_idx, best_score = 0, -1
    scan_limit = min(30, len(raw_df))
    for i in range(scan_limit):
        row = raw_df.iloc[i].tolist()
        score = _score_header_row(row)
        if score > best_score:
            best_score = score
            best_idx = i
    return best_idx


def load_raw_sheet(filepath, sheet_name=0):
    """Load a sheet with no header assumptions at all (pure raw grid)."""
    raw = pd.read_excel(filepath, sheet_name=sheet_name, header=None)
    return raw


def build_structured_frame(raw_df, header_idx):
    """
    Given the raw grid and the detected header row index, build a proper
    DataFrame with real column names, dropping the letterhead junk rows
    above the header (they are preserved separately in the Raw Data sheet,
    so nothing is actually lost).
    """
    headers = raw_df.iloc[header_idx].tolist()
    # Deduplicate + clean header labels
    clean_headers = []
    seen = {}
    for h in headers:
        name = str(h).strip() if pd.notna(h) else "Unnamed"
        name = re.sub(r"\s+", " ", name)
        if name in seen:
            seen[name] += 1
            name = f"{name} ({seen[name]})"
        else:
            seen[name] = 0
        clean_headers.append(name)

    body = raw_df.iloc[header_idx + 1:].copy()
    body.columns = clean_headers
    body.reset_index(drop=True, inplace=True)
    return body


def _looks_numeric(series):
    """Heuristic: does this column mostly contain numbers (or numeric text)?"""
    sample = series.dropna().astype(str).str.replace(",", "", regex=False)
    sample = sample.str.replace("₹", "", regex=False).str.strip()
    if len(sample) == 0:
        return False
    numeric_like = sample.str.match(r"^-?\d+(\.\d+)?$")
    return numeric_like.mean() > 0.6


def _to_numeric(series):
    cleaned = (
        series.astype(str)
        .str.replace(",", "", regex=False)
        .str.replace("₹", "", regex=False)
        .str.strip()
    )
    cleaned = cleaned.replace({"nan": np.nan, "": np.nan, "None": np.nan})
    return pd.to_numeric(cleaned, errors="coerce")


def clean_dataframe(body):
    """
    Main cleaning pass:
    1. Drop fully-empty rows/columns (pure whitespace rows Excel exports
       often contain) — these carry no data, so nothing is lost.
    2. Identify the identifying columns and forward-fill them, since
       Tally-style exports split one transaction across multiple rows
       (header row + one row per line item).
    3. Convert numeric-looking columns to real numbers.
    4. Parse date columns to real datetimes.
    5. Consolidate scattered tax columns into a single 'Total Tax' column
       (original columns are KEPT, not deleted — just added to).
    Returns: (cleaned_df, audit_log list of strings)
    """
    audit = []
    df = body.copy()

    # --- drop fully empty rows/cols ---
    before_rows, before_cols = df.shape
    df = df.dropna(axis=0, how="all")
    df = df.dropna(axis=1, how="all")
    audit.append(
        f"Removed {before_rows - df.shape[0]} completely blank rows and "
        f"{before_cols - df.shape[1]} completely blank columns (no data existed in them)."
    )

    # --- flag transaction (main) rows vs. line-item (detail) rows BEFORE
    #     forward-filling, using Voucher Type as the signal (only main
    #     rows have it filled in the original export). This matters a lot
    #     for accuracy: in exports like this, the main row's amount is
    #     already the SUM of its line items below it, so downstream
    #     analysis must sum only one or the other -- never both --
    #     or revenue gets double-counted. ---
    voucher_type_col = next(
        (c for c in df.columns if c.strip().lower() == "voucher type"), None
    )
    if voucher_type_col:
        df["Row Type"] = df[voucher_type_col].apply(
            lambda v: "Transaction" if pd.notna(v) and str(v).strip() != "" else "Line Item"
        )
        n_txn = (df["Row Type"] == "Transaction").sum()
        n_item = (df["Row Type"] == "Line Item").sum()
        audit.append(
            f"Tagged each row as 'Transaction' ({n_txn} rows) or 'Line Item' ({n_item} rows). "
            f"A transaction's total Value already equals the sum of its Line Item rows below it, "
            f"so totals are calculated from Transaction rows only (to avoid double-counting), "
            f"while product-level breakdowns use Line Item rows only."
        )

    # --- forward-fill identifying columns across split transaction rows ---
    id_cols_found = [
        c for c in df.columns
        if c.strip().lower() in ID_COLUMNS_CANDIDATES
    ]
    for col in id_cols_found:
        n_before = df[col].isna().sum()
        df[col] = df[col].replace("", np.nan).ffill()
        n_after = df[col].isna().sum()
        if n_before > n_after:
            audit.append(
                f"Filled {n_before - n_after} blank cells in '{col}' by carrying "
                f"forward the value from the transaction's main row "
                f"(Tally-style exports split each sale into multiple rows)."
            )

    # --- numeric conversion ---
    for col in df.columns:
        if col in id_cols_found:
            continue
        if df[col].dtype == object and _looks_numeric(df[col]):
            df[col] = _to_numeric(df[col])

    # --- date parsing ---
    date_cols = [c for c in df.columns if "date" in c.strip().lower()]
    for col in date_cols:
        df[col] = pd.to_datetime(df[col], errors="coerce", dayfirst=True)

    # --- consolidate tax columns ---
    tax_cols = [
        c for c in df.columns
        if any(tok in c.strip().lower() for tok in TAX_TOKENS)
        and pd.api.types.is_numeric_dtype(df[c])
    ]
    if tax_cols:
        df["Total Tax (calculated)"] = df[tax_cols].sum(axis=1, skipna=True)
        audit.append(
            f"Added 'Total Tax (calculated)' by summing {len(tax_cols)} separate "
            f"tax/duty columns found in the sheet ({', '.join(tax_cols[:6])}"
            f"{'...' if len(tax_cols) > 6 else ''}). Original columns kept unchanged."
        )

    charge_cols = [
        c for c in df.columns
        if any(tok in c.strip().lower() for tok in CHARGE_TOKENS)
        and pd.api.types.is_numeric_dtype(df[c])
    ]
    if charge_cols:
        df["Total Charges (calculated)"] = df[charge_cols].sum(axis=1, skipna=True)
        audit.append(
            f"Added 'Total Charges (calculated)' by summing {len(charge_cols)} "
            f"freight/round-off columns. Original columns kept unchanged."
        )

    # --- identify a best-guess "amount" column for analysis ---
    amount_col = None
    for candidate in ["value", "gross total", "amount", "total"]:
        matches = [c for c in df.columns if c.strip().lower() == candidate]
        if matches and pd.api.types.is_numeric_dtype(df[matches[0]]):
            amount_col = matches[0]
            break
    if amount_col is None:
        numeric_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
        if numeric_cols:
            amount_col = df[numeric_cols].sum().idxmax()

    # --- flag footer/total rows so they don't get treated as real data ---
    # Common export footers: a lone row like "Grand Total" / "Total" with
    # no date, voucher, or buyer info -- just a label and a number.
    footer_mask = pd.Series(False, index=df.index)
    text_col_for_footer = None
    for c in df.columns:
        if c.strip().lower() == "particulars":
            text_col_for_footer = c
            break
    if text_col_for_footer:
        footer_mask = df[text_col_for_footer].astype(str).str.strip().str.lower().isin(
            ["grand total", "total", "closing balance"]
        )
    n_footer = int(footer_mask.sum())
    if n_footer:
        df["Row Type"] = df.get("Row Type", pd.Series("Line Item", index=df.index))
        df.loc[footer_mask, "Row Type"] = "Footer/Total (excluded from analysis)"
        audit.append(
            f"Identified {n_footer} footer/total row(s) (e.g. 'Grand Total') and excluded "
            f"them from analysis calculations -- they remain visible in Cleaned Data, just tagged."
        )

    df.attrs["amount_col"] = amount_col
    df.attrs["date_col"] = date_cols[0] if date_cols else None
    df.attrs["id_cols"] = id_cols_found

    return df, audit


def clean_file(filepath, sheet_name=0):
    """
    Full pipeline entry point.
    Returns: dict with raw_df, cleaned_df, header_idx, audit_log
    """
    raw = load_raw_sheet(filepath, sheet_name=sheet_name)
    header_idx = find_header_row(raw)
    body = build_structured_frame(raw, header_idx)
    cleaned, audit = clean_dataframe(body)

    audit.insert(
        0,
        f"Detected the real column-header row at spreadsheet row {header_idx + 1} "
        f"(rows above it were letterhead/title text, preserved as-is in 'Raw Data')."
    )

    return {
        "raw_df": raw,
        "cleaned_df": cleaned,
        "header_idx": header_idx,
        "audit_log": audit,
    }
