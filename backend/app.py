from flask import Flask, request, jsonify
import pandas as pd
from io import BytesIO
import os
from dotenv import load_dotenv
from flask_cors import CORS
import traceback
from werkzeug.utils import secure_filename

load_dotenv()

app = Flask(__name__)

# Use flask-cors middleware for API routes (only allow Vite frontend)
# This provides the Access-Control-* headers automatically for routes under /api/*
# Temporarily allow all origins for debugging CORS issues. Change back to specific origin after debugging.
CORS(app, resources={r"/api/*": {"origins": "*"}})


# Debug: log incoming requests (does not modify responses)
@app.before_request
def log_request_info():
    try:
        origin = request.headers.get('Origin')
        print(f"[DEBUG] Incoming request: {request.method} {request.path} from {request.remote_addr}", flush=True)
        print(f"[DEBUG] Origin: {origin}", flush=True)
        print(f"[DEBUG] Content-Length: {request.content_length}", flush=True)
        print(f"[DEBUG] Headers: {dict(request.headers)}", flush=True)
    except Exception:
        print("[DEBUG] Error while logging request info:\n" + traceback.format_exc(), flush=True)

def shaping_df(df, unit='kWh'): # Voeg 'unit' toe als tweede argument
    df = df.copy()
    df['date'] = pd.to_datetime(df['date'])
    df = df.set_index('date')
    
    # Zet om naar getallen
    df['total'] = pd.to_numeric(df['total'], errors='coerce')
    
    # Correctie op basis van de gekozen unit
    if unit == 'MWh':
        # Als de gebruiker zegt dat het MWh is, rekenen we het om naar kWh
        # (Meestal is x 1000 de standaard voor MWh -> kWh)
        df['total'] = df['total'] * 1000 
    
    # Bereken het verbruik per interval
    df['consumption_interval'] = df['total'].diff().fillna(0)
    df.loc[df['consumption_interval'] < 0, 'consumption_interval'] = 0
    
    # Bereken daggemiddelde
    df['daily_total'] = df['consumption_interval'].resample('D').sum().reindex(df.index, method='ffill')
    df['diff'] = df['consumption_interval']
    
    return df


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    print("[DEBUG] /health called", flush=True)
    return jsonify({'status': 'ok', 'message': 'Backend is running'}), 200


@app.route('/', methods=['GET'])
def root():
    """Root endpoint - shows backend status page"""
    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Energy Backend - Status</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #96c63e 0%, #7fa02f 100%);
            }
            .container {
                background: white;
                padding: 40px;
                border-radius: 10px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                text-align: center;
                max-width: 500px;
            }
            h1 {
                color: #373737;
                margin-top: 0;
                font-size: 28px;
            }
            .status {
                display: inline-block;
                background: #4caf50;
                color: white;
                padding: 10px 20px;
                border-radius: 20px;
                font-weight: 600;
                margin: 20px 0;
            }
            .info {
                background: #f5f5f5;
                padding: 20px;
                border-radius: 8px;
                text-align: left;
                margin: 20px 0;
                font-size: 14px;
                color: #666;
            }
            .info h3 {
                color: #373737;
                margin-top: 0;
            }
            .endpoint {
                background: #e8f5e9;
                padding: 10px;
                margin: 10px 0;
                border-radius: 4px;
                font-family: 'Courier New', monospace;
                color: #2e7d32;
            }
            .success-icon {
                font-size: 48px;
                margin: 20px 0;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="success-icon">⚡</div>
            <h1>Energy Backend</h1>
            <div class="status">✓ Running</div>
            
            <div class="info">
                <h3>API Endpoints:</h3>
                <div class="endpoint">GET /health</div>
                <div class="endpoint">POST /api/upload-smart-meter</div>
                <div class="endpoint">POST /api/calculate-savings</div>
            </div>
            
            <div class="info">
                <h3>Status:</h3>
                <p>✓ Backend is running on port 5000</p>
                <p>✓ CORS enabled</p>
                <p>✓ Ready to process requests</p>
            </div>
        </div>
    </body>
    </html>
    """
    return html, 200


@app.route('/api/upload-smart-meter', methods=['POST'])
def upload_smart_meter():
    """
    Handle smart meter file upload (CSV or Excel).
    
    Expected file formats:
    - CSV: date, total columns
    - Excel: date, total columns
    
    Returns:
        JSON with processed data summary and hourly analytics
    """
    try:
        print("[DEBUG] upload_smart_meter called", flush=True)
        if 'file' not in request.files:
            print("[DEBUG] No 'file' in request.files", flush=True)
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Save uploaded file to uploads directory
        upload_dir = os.path.join(os.path.dirname(__file__), 'uploads')
        os.makedirs(upload_dir, exist_ok=True)
        safe_name = secure_filename(file.filename)
        saved_path = os.path.join(upload_dir, safe_name)
        try:
            file.save(saved_path)
            print(f"[DEBUG] Saved uploaded file to: {saved_path}", flush=True)
        except Exception as e:
            print("[DEBUG] Error saving file:\n" + traceback.format_exc(), flush=True)
            return jsonify({'error': f'Error saving file: {str(e)}'}), 500
        
        # Check file extension
        filename = file.filename.lower()
        filename = safe_name.lower()
        
        # Read file based on type
        try:
            if filename.endswith('.csv'):
                df = pd.read_csv(saved_path)
            elif filename.endswith(('.xlsx', '.xls')):
                df = pd.read_excel(saved_path)
            else:
                print(f"[DEBUG] Unsupported file extension: {filename}", flush=True)
                return jsonify({'error': 'File must be CSV or Excel format'}), 400
            print(f"[DEBUG] Read file, shape={getattr(df, 'shape', None)}", flush=True)
            print(f"[DEBUG] Columns: {list(df.columns)}", flush=True)
        except Exception as e:
            print("[DEBUG] Error reading file:\n" + traceback.format_exc(), flush=True)
            return jsonify({'error': f'Error reading file: {str(e)}'}), 400
        
        # Validate required columns
        if 'date' not in df.columns or 'total' not in df.columns:
            return jsonify({'error': 'File must contain "date" and "total" columns'}), 400
        
        # Process the dataframe
        unit = request.form.get('unit', 'kWh')
        processed_df = shaping_df(df,'unit')
        
        # Calculate hourly analytics
        hourly_avg = processed_df.groupby(processed_df.index.hour).mean(numeric_only=True)
        
        hourly_data = {
            str(int(hour)): {
                'diff': float(value) if pd.notna(value) else 0,
                'total': float(processed_df[processed_df.index.hour == hour]['total'].mean(numeric_only=True)) if pd.notna(processed_df[processed_df.index.hour == hour]['total'].mean(numeric_only=True)) else 0
            }
            for hour, value in hourly_avg['diff'].items()
        }
        
        # Calculate daily totals
        daily_totals = processed_df.groupby(processed_df.index.date)['daily_total'].first()
        
        # Prepare response data
        response_data = {
            'success': True,
            'message': 'File processed successfully',
            'summary': {
                'total_records': len(processed_df),
                'date_range_start': str(processed_df.index.min()),
                'date_range_end': str(processed_df.index.max()),
                'average_daily_consumption': float(processed_df['daily_total'].mean()),
                'max_daily_consumption': float(processed_df['daily_total'].max()),
                'min_daily_consumption': float(processed_df['daily_total'].min()),
                'total_consumption': float(processed_df['daily_total'].sum()),
            },
            'hourly_analytics': hourly_data,
            'daily_totals': {str(date): float(value) for date, value in daily_totals.items()},
            'data': processed_df.to_dict(orient='records')
        }
        
        return jsonify(response_data), 200
        
    except Exception as e:
        print("[DEBUG] upload_smart_meter exception:\n" + traceback.format_exc(), flush=True)
        return jsonify({'error': f'Server error: {str(e)}'}), 500


@app.route('/api/calculate-savings', methods=['POST'])
def calculate_savings():
    """
    Calculate potential savings based on consumption data and contracts.
    
    Expected JSON:
    {
        "consumption": { "electricity": 500, "gas": 150 },
        "contracts": [
            { "id": 1, "provider": "...", "electricityRate": 0.24, "gasRate": 0.18, "monthlyFee": 5 }
        ]
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'consumption' not in data or 'contracts' not in data:
            return jsonify({'error': 'Missing consumption or contracts data'}), 400
        
        consumption = data['consumption']
        contracts = data['contracts']
        
        results = []
        for contract in contracts:
            monthly_cost = contract['monthlyFee']
            monthly_cost += consumption['electricity'] * contract['electricityRate']
            if 'gasRate' in contract and 'gas' in consumption:
                monthly_cost += consumption['gas'] * contract['gasRate']
            
            yearly_cost = monthly_cost * 12
            
            results.append({
                'provider': contract['provider'],
                'monthly_cost': round(monthly_cost, 2),
                'yearly_cost': round(yearly_cost, 2)
            })
        
        # Sort by yearly cost
        results.sort(key=lambda x: x['yearly_cost'])
        
        return jsonify({
            'success': True,
            'results': results,
            'cheapest': results[0] if results else None
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500


if __name__ == '__main__':
    # Default to 5001 to avoid conflicts with other local services (e.g. AirPlay)
    port = int(os.getenv('PORT', 5001))
    print(f"\n⚡ Energy Backend Starting...")
    print(f"🔗 Server: http://localhost:{port}")
    print(f"📊 Status: http://localhost:{port}/")
    print(f"✓ CORS enabled\n")
    app.run(debug=True, port=port)
