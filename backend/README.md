# Energy Backend - Python Flask Server & Streamlit Analysis

A Python backend with two components:
1. **Flask API** - REST API for React frontend
2. **Streamlit App** - Interactive data analysis tool

## Features

- Smart meter file upload (CSV/Excel)
- Energy consumption data processing with pandas
- Contract savings calculation
- CORS enabled for frontend communication
- Streamlit dashboard for personal analytics

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Create Environment File

```bash
cp .env.example .env
```

## Running Both Services

### Option A: Run Simultaneously (Recommended for Development)

**Terminal 1 - Flask Backend:**
```bash
python app.py
```
The Flask API will start on `http://localhost:5000`

**Terminal 2 - Streamlit App:**
```bash
streamlit run streamlit_app.py
```
The Streamlit app will open in your browser (usually `http://localhost:8501`)

### Option B: Run Flask Only (for React Frontend)
```bash
python app.py
```

## API Endpoints

### Health Check
- **GET** `/health`
- Returns server status

### Upload Smart Meter Data
- **POST** `/api/upload-smart-meter`
- File upload (CSV or Excel)
- Required columns: `date`, `total`
- Returns: Processed data summary with consumption statistics and hourly analytics

### Calculate Savings
- **POST** `/api/calculate-savings`
- Body: `{ consumption: {electricity, gas}, contracts: [...] }`
- Returns: Savings analysis sorted by yearly cost

## Streamlit App Features

The Streamlit app provides an interactive interface with:

### 📊 Persoonlijke Gegevens Tab
- Key metrics (total records, period, average daily consumption, total consumption)
- Hourly consumption pattern graph
- Peak hour and lowest hour statistics

### 📈 Details Tab
- Daily consumption trends
- Monthly consumption breakdown
- Detailed statistics table

### 📋 Data Tab
- Raw processed data view
- Download processed data as CSV

## File Format

Your smart meter file should have:
```
date,total
2024-01-01,15.5
2024-01-02,16.2
```

## Integration with React Frontend

### Flow:
1. User uploads file in React HomePage
2. Flask backend processes the file
3. Analytics data is passed to PersonalDataPage tab
4. User can view their energy profile
5. User can navigate to ComparePage for contract comparison

### File Upload Code:
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
const response = await fetch('http://localhost:5000/api/upload-smart-meter', {
  method: 'POST',
  body: formData
});
```

## React Components

- **HomePage** - Form for entering household info and uploading files
- **PersonalDataPage** - Shows energy consumption analytics
- **ComparePage** - Compare energy contracts based on consumption

## Development

### Flask Development
The Flask development server auto-reloads on file changes.

### Streamlit Development
Streamlit automatically detects file changes and reruns the app.

### CORS Settings
Currently allows requests from all origins. For production, update CORS settings in `app.py`:
```python
CORS(app, resources={r"/api/*": {"origins": "https://yourdomain.com"}})
```

## Production Deployment

### Flask:
1. Set `FLASK_ENV=production`
2. Use a production WSGI server (Gunicorn, uWSGI)
3. Update CORS origins to specific domain
4. Use environment variables for sensitive data

### Streamlit:
1. Deploy on Streamlit Cloud or VPS
2. Update backend URL in configuration
3. Set up SSL/TLS certificates

## Data Processing

The `shaping_df()` function processes smart meter data:
- Converts date strings to datetime index
- Calculates daily totals using resampling
- Computes quarter-hour differences
- Forward-fills missing values

## Troubleshooting

**Backend not connecting:**
- Ensure Flask server is running on `http://localhost:5000`
- Check CORS settings
- Verify file format has `date` and `total` columns

**Streamlit not loading:**
- Ensure Streamlit is installed: `pip install streamlit`
- Check port 8501 is available
- Try: `streamlit run streamlit_app.py --logger.level=debug`

**File upload errors:**
- Verify CSV/Excel file format
- Check column names are exactly `date` and `total`
- Ensure dates are in a recognized format (YYYY-MM-DD, DD/MM/YYYY, etc.)

