# Sales Data Auto-Cleaner & Dashboard Builder
## Deployed on Vercel ☁️

A production-ready web application that automatically cleans messy sales data exports, performs analysis, and generates professional Excel reports with charts.

### Features

✅ **Automatic Header Detection** - Finds real column headers even with junk rows above  
✅ **Data Cleaning** - Handles merged cells, text numbers, date parsing, missing values  
✅ **Automatic Analysis** - Monthly summaries, top buyers/products, growth trends, business insights  
✅ **Professional Reports** - Multi-sheet Excel workbooks with native charts (not images)  
✅ **Zero Data Loss** - Original raw data preserved alongside cleaned version  
✅ **Vercel Ready** - Serverless deployment, auto-scaling, global CDN

### Supported File Formats

- Excel (.xlsx, .xls)
- CSV
- Maximum file size: 25 MB

### Project Structure

```
salesapp_project/
├── api/                      # Vercel serverless functions
│   ├── process.js           # Main upload & processing endpoint
│   ├── download.js          # File download endpoint
│   └── index.js             # Frontend serving
├── lib/                      # Core logic modules
│   ├── cleaning.js          # Data cleaning pipeline
│   ├── analysis.js          # Business analysis & insights
│   └── excel_builder.js     # Excel workbook generation
├── public/                   # Frontend files
│   └── index.html           # Web UI
├── package.json             # Dependencies
├── vercel.json              # Vercel configuration
└── server.js                # Local dev server
```

### Installation & Local Development

1. **Clone/setup the project:**
   ```bash
   cd salesapp_project
   npm install
   ```

2. **Start local development server:**
   ```bash
   npm run dev
   ```

   Server will run at `http://localhost:3000`

3. **Test the API:**
   - Upload a CSV/Excel file via the web interface
   - Or use curl:
   ```bash
   curl -X POST -F "file=@sample.xlsx" http://localhost:3000/api/process
   ```

### Deployment to Vercel

#### Option 1: Using Vercel CLI

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Deploy:**
   ```bash
   vercel
   ```

3. **Follow prompts** - Choose project settings and deploy

#### Option 2: Using GitHub (Recommended)

1. **Push code to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git push -u origin main
   ```

2. **Connect to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Select your GitHub repository
   - Vercel auto-detects Next.js/Express and configures automatically
   - Click "Deploy"

3. **Your app is live!** 🎉
   - Vercel provides a `.vercel.app` URL
   - Set custom domain in Vercel project settings

### API Endpoints

#### POST `/api/process`
Upload a file for processing

**Request:**
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch('/api/process', {
  method: 'POST',
  body: formData
});
```

**Response:**
```json
{
  "job_id": "abc123",
  "rows_processed": 1500,
  "audit_log": ["..."],
  "insights": ["..."],
  "download_url": "/api/download/abc123"
}
```

#### GET `/api/download/:id`
Download processed Excel file

```javascript
window.location.href = `/api/download/${jobId}`;
```

### Data Processing Pipeline

```
Upload → Parse → Detect Header → Clean Data → Analyze → Build Report → Download
  ↓         ↓          ↓              ↓         ↓          ↓
 .xlsx    Verify    Find real      Remove   Monthly    Multi-sheet
  .csv    format    headers        blanks   summaries  Excel with
                   Skip junk      Forward-  Top items  charts
                   rows           fill      Insights
```

### Key Technologies

- **Backend Runtime:** Node.js 18.x (Vercel)
- **File Handling:** `xlsx` (read/write Excel)
- **Date Parsing:** `date-fns`
- **File Upload:** `formidable`
- **Frontend:** Vanilla JavaScript (no build step needed)
- **API Framework:** Express.js (local dev)

### Environment Variables

Create a `.env.local` file for local development:

```env
NODE_ENV=development
PORT=3000
MAX_FILE_SIZE_MB=25
```

On Vercel, these are configured in `vercel.json` and can be overridden in Vercel dashboard settings.

### Performance & Limits

| Metric | Limit |
|--------|-------|
| Max File Size | 25 MB |
| Processing Timeout | 60 seconds |
| Memory per Function | 3 GB |
| Concurrent Uploads | Unlimited (serverless scales) |
| File Storage | In-memory (1 hour expiry) |

### Troubleshooting

**Issue: "File not found or already expired"**
- Downloads expire after 1 hour of processing
- Click "Process File" again and download immediately

**Issue: "Unsupported file type"**
- Only .xlsx, .xls, and .csv supported
- Export from Excel/Google Sheets as CSV or XLSX

**Issue: "Processing failed"**
- Check file format is valid
- Ensure file is under 25 MB
- Check browser console for detailed error

### Development Tips

1. **Add debugging:**
   ```javascript
   console.log('Processing:', jobId);
   ```

2. **Test with sample files:**
   - Create sample CSV/XLSX in `test-data/` folder
   - Upload via web interface

3. **Monitor Vercel logs:**
   - Go to vercel.com → Project → Deployments
   - Click latest deployment → Logs tab
   - Real-time output from serverless functions

### Contributing

To add features:
1. Modify lib files (cleaning.js, analysis.js, etc.)
2. Test locally: `npm run dev`
3. Deploy: `git push` (if using GitHub integration)

### Limitations & Future Improvements

**Current:**
- Files stored in-memory (suitable for 25 MB limit)
- Single-sheet input handling

**Could add:**
- Persistent storage (AWS S3, Vercel Blob)
- Multiple sheet processing
- Custom cleaning rules UI
- Data validation rules
- Scheduled/batch processing
- User accounts & file history

### License

MIT

### Support

For issues or questions:
1. Check Vercel dashboard logs
2. Review browser console errors
3. Test locally with sample file

---

**Ready to deploy?** Push to GitHub and Vercel auto-deploys! 🚀
