"""
app.py
Flask web server. Endpoints:
  GET  /                 -> serves the upload page (frontend/index.html)
  POST /api/process      -> accepts an uploaded .xlsx/.csv, runs the full
                             clean -> analyze -> build pipeline, returns
                             a download link for the finished workbook
  GET  /api/download/<id> -> streams the generated workbook back to the user
"""

import os
import uuid
import traceback
from flask import Flask, request, jsonify, send_file, send_from_directory

from cleaning import clean_file
from analysis import monthly_summary, top_buyers, top_products, generate_insights
from excel_builder import build_workbook

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "..", "frontend")
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
OUTPUT_DIR = os.path.join(BASE_DIR, "outputs")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".xlsx", ".xls", ".csv"}
MAX_FILE_SIZE_MB = 25

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_FILE_SIZE_MB * 1024 * 1024


@app.route("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/api/process", methods=["POST"])
def process():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded."}), 400

    f = request.files["file"]
    if f.filename == "":
        return jsonify({"error": "Empty filename."}), 400

    ext = os.path.splitext(f.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        return jsonify({"error": f"Unsupported file type '{ext}'. Upload .xlsx, .xls, or .csv"}), 400

    job_id = uuid.uuid4().hex[:12]
    saved_path = os.path.join(UPLOAD_DIR, f"{job_id}{ext}")
    f.save(saved_path)

    try:
        result = clean_file(saved_path)
        raw_df = result["raw_df"]
        cleaned_df = result["cleaned_df"]
        audit_log = result["audit_log"]

        monthly_df = monthly_summary(cleaned_df)
        buyers_df = top_buyers(cleaned_df)
        products_df = top_products(cleaned_df)
        insights = generate_insights(cleaned_df, monthly_df, buyers_df, products_df)

        output_path = os.path.join(OUTPUT_DIR, f"{job_id}_report.xlsx")
        build_workbook(
            raw_df, cleaned_df, audit_log, monthly_df,
            buyers_df, products_df, insights, output_path
        )

        return jsonify({
            "job_id": job_id,
            "rows_processed": int(len(cleaned_df)),
            "audit_log": audit_log,
            "insights": insights,
            "download_url": f"/api/download/{job_id}",
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Processing failed: {str(e)}"}), 500

    finally:
        # keep upload for debugging only if you want; otherwise clean up:
        if os.path.exists(saved_path):
            os.remove(saved_path)


@app.route("/api/download/<job_id>")
def download(job_id):
    path = os.path.join(OUTPUT_DIR, f"{job_id}_report.xlsx")
    if not os.path.exists(path):
        return jsonify({"error": "File not found or already expired."}), 404
    return send_file(
        path,
        as_attachment=True,
        download_name="Sales_Report_Dashboard.xlsx",
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


if __name__ == "__main__":
    app.run(debug=True, port=5000)
