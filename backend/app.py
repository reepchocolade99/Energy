from flask import Flask, request, jsonify
import pandas as pd
from io import BytesIO
import os
from dotenv import load_dotenv
from flask_cors import CORS
import traceback
from werkzeug.utils import secure_filename
from calculator import calculate_energy_costs
load_dotenv()

app = Flask(__name__)

# Use flask-cors middleware for API routes (only allow Vite frontend)
# This provides the Access-Control-* headers automatically for routes under /api/*
# Temporarily allow all origins for debugging CORS issues. Change back to specific origin after debugging.
CORS(app, resources={
    r"/api/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})
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

def shaping_df(df, unit='kWh'):
    df = df.fillna(0)
    df = df.copy()
    
    # 1. Datum en tijd verwerken (Ondersteunt beide formaten)
    if 'only_date' in df.columns and 'only_time' in df.columns:
        # Voor jouw nieuwe CSV: combineer de kolommen naar één datetime index
        df['datetime'] = pd.to_datetime(df['only_date'].astype(str) + ' ' + df['only_time'].astype(str))
        df = df.set_index('datetime')
    elif 'date' in df.columns:
        # Voor het oude formaat
        df['date'] = pd.to_datetime(df['date'])
        df = df.set_index('date')
    else:
        # Mocht er helemaal geen datumkolom zijn
        raise ValueError("Geen geldige datumkolom gevonden (verwacht 'only_date' of 'date')")

    # 2. Verbruik (diff) en Totaal bepalen
    if 'total' in df.columns:
        # Logica voor bestanden met een meterstand
        df['total'] = pd.to_numeric(df['total'], errors='coerce')
        if unit == 'MWh':
            df['total'] = df['total'] * 1000 
        df['consumption_interval'] = df['total'].diff().fillna(0)
    else:
        # Logica voor jouw nieuwe CSV (direct verbruik per kwartier)
        # We tellen de lage en normale uren bij elkaar op voor het algemene verbruik
        low_val = pd.to_numeric(df['low_used_diff'], errors='coerce').fillna(0) if 'low_used_diff' in df.columns else 0
        norm_val = pd.to_numeric(df['normal_used_diff'], errors='coerce').fillna(0) if 'normal_used_diff' in df.columns else 0
        
        df['consumption_interval'] = low_val + norm_val
        # We maken een 'fake' total kolom door de intervallen op te tellen (voor compatibiliteit)
        df['total'] = df['consumption_interval'].cumsum()

    # 3. Opschonen van negatieve waarden
    df.loc[df['consumption_interval'] < 0, 'consumption_interval'] = 0
    df['diff'] = df['consumption_interval']
    
    # 4. Daggemiddelde berekenen (voor de grafieken in de frontend)
    df['daily_total'] = df['consumption_interval'].resample('D').sum().reindex(df.index, method='ffill')
    
    return df
def calculate_deals(monthly_kwh):
    # Inladen van je CSV bestand
    df_contracts = pd.read_csv('vast_contract_energie.csv')
    
    # Maak de getallen schoon (komma's naar punten voor Python)
    for col in ['Enkel', 'Normaal', 'Dal']:
        df_contracts[col] = df_contracts[col].str.replace(',', '.').astype(float)
    
    results = []
    yearly_kwh = monthly_kwh * 12

    for index, row in df_contracts.iterrows():
        # Basis berekening (simpel)
        # Je kunt hier later vastrecht en gas aan toevoegen
        yearly_cost = yearly_kwh * row['Enkel']
        
        results.append({
            'provider': row['Energieleverancier'],
            'contract': row['Contract'],
            'monthly_cost': round(yearly_cost / 12, 2),
            'yearly_cost': round(yearly_cost, 2),
            'rate': row['Enkel']
        })
    
    # Sorteer op goedkoopste eerst
    return sorted(results, key=lambda x: x['monthly_cost'])

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
    try:
        print("[DEBUG] upload_smart_meter called", flush=True)
        if 'file' not in request.files:
            return jsonify({'error': 'Geen bestand gevonden'}), 400
        
        file = request.files['file']
        upload_dir = os.path.join(os.path.dirname(__file__), 'uploads')
        os.makedirs(upload_dir, exist_ok=True)
        saved_path = os.path.join(upload_dir, secure_filename(file.filename))
        file.save(saved_path)
        
        # 1. Bereken variabele kosten en haal df_final op
        total_variable_cost, df_final = calculate_energy_costs(saved_path)
        df_final = df_final.fillna(0)
        
        # 2. VERBRUIK BEREKENEN (De fix voor de 485 kWh)
        total_kwh = df_final['low_used_diff'].sum() + df_final['normal_used_diff'].sum()
        
        # Bereken de tijdsduur van het bestand
        start_date = df_final.index.min()
        end_date = df_final.index.max()
        num_days = (end_date - start_date).days or 1
        
        # Bereken maandverbruik: (Totaal / dagen) * 30.44 (gemiddelde maandlengte)
        avg_daily = total_kwh / num_days
        monthly_val = avg_daily * 30.44 
        
        # 3. Hourly analytics (voor de grafiek)
        hourly_avg = df_final.groupby(df_final.index.hour).mean(numeric_only=True)
        hourly_data = {
            str(int(hour)): {
                'diff': float(row['low_used_diff'] + row['normal_used_diff']),
                'price': float(row['Price(Eur/kWh)']) if 'Price(Eur/kWh)' in row else 0
            }
            for hour, row in hourly_avg.iterrows()
        }

        # 4. JSON Antwoord met het nieuwe monthlyConsumption veld
        response_data = {
            'success': True,
            'isFromSmartMeter': True,
            'summary': {
                'total_kwh': float(total_kwh),
                'monthlyConsumption': float(monthly_val), 
                'average_daily_consumption': float(avg_daily),
                'variable_costs_total': float(total_variable_cost),
                'date_range_start': str(start_date),
                'date_range_end': str(end_date)
            },
            'hourly_analytics': hourly_data
        }
        
        print(f"--- DEBUG VERBRUIK ---")
        print(f"Totaal in CSV: {total_kwh:.2f} kWh")
        print(f"Aantal dagen: {num_days}")
        print(f"Berekend Maandgemiddelde: {monthly_val:.2f} kWh") # Check of hier ~485 staat!
        print(f"----------------------")
        
        return jsonify(response_data), 200
        
    except Exception as e:
        print(f"[ERROR] {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/compare-contracts', methods=['POST'])
def compare_contracts():
    data = request.json
    monthly_kwh = float(data.get('monthlyConsumption', 0))
    
    try:
        # We proberen eerst met ; en dan met , als backup
        try:
            df = pd.read_csv('vast_contract_energie.csv', sep=';')
            if 'Enkel' not in df.columns:
                raise Exception("Probeer komma")
        except:
            df = pd.read_csv('vast_contract_energie.csv', sep=',')

        # Verwijder spaties rondom kolomnamen
        df.columns = df.columns.str.strip()
        
        # Debug: print de kolommen die Python WEL ziet in je terminal
        print(f"Gevonden kolommen: {df.columns.tolist()}")

        results = []
        for _, row in df.iterrows():
            # Haal tarieven op en vervang komma's door punten
            rate_str = str(row['Enkel']).replace(',', '.')
            rate = float(rate_str)
            
            monthly_cost = monthly_kwh * rate
            
            results.append({
                'provider': row['Energieleverancier'],
                'contractName': row['Contract'],
                'rate': rate,
                'monthlyCost': round(monthly_cost, 2),
                'yearlyCost': round(monthly_cost * 12, 2)
            })
            
        sorted_results = sorted(results, key=lambda x: x['monthlyCost'])
        return jsonify(sorted_results)
    
    except Exception as e:
        print(f"Gedetailleerde fout: {e}")
        return jsonify({"error": f"Kolom niet gevonden of datafout: {str(e)}"}), 500

if __name__ == '__main__':
    # Default to 5001 to avoid conflicts with other local services (e.g. AirPlay)
    port = int(os.getenv('PORT', 5001))
    print(f"\n⚡ Energy Backend Starting...")
    print(f"🔗 Server: http://127.0.0.1:{port}")
    print(f"📊 Status: http://127.0.0.1:{port}/")
    print(f"✓ CORS enabled\n")
    app.run(debug=True, port=5001, host='0.0.0.0')

@app.route('/api/upload-usage', methods=['POST'])
def upload_file():
    file = request.files['file']
    file.save('backend/data/temp_input.csv')
    
    # Roep de berekeningsfunctie aan
    kosten, df = calculate_energy_costs('backend/data/temp_input.csv')
    
    return {
        "variabele_kosten": round(kosten, 2),
        "status": "success"
    }

def calculate_variable_costs(processed_df):
    try:
        # 1. Laad de prijzen
        prices_path = os.path.join(os.path.dirname(__file__), 'data', 'Netherlands.csv')
        if not os.path.exists(prices_path):
            return 0, None
            
        prices_df = pd.read_csv(prices_path)
        prices_df['Price(Eur/kWh)'] = prices_df['Price (EUR/MWhe)'] / 1000
        prices_df['Datetime (Local)'] = pd.to_datetime(prices_df['Datetime (Local)'])
        prices_df.set_index('Datetime (Local)', inplace=True)

        # 2. Resample de processed_df (die al uit upload_smart_meter komt) naar uren
        # We gebruiken de kolommen die jij specifiek noemde
        needed_cols = ['low_used_diff', 'normal_used_diff']
        # Check of deze kolommen bestaan, anders vallen we terug op 'diff'
        cols_to_use = [c for c in needed_cols if c in processed_df.columns]
        
        if not cols_to_use:
            # Fallback naar de standaard 'diff' kolom uit je shaping_df
            df_hourly = processed_df[['diff']].resample('H').sum()
            df_hourly.rename(columns={'diff': 'total_used_diff'}, inplace=True)
        else:
            df_hourly = processed_df[cols_to_use].resample('H').sum()
            df_hourly['total_used_diff'] = df_hourly.sum(axis=1)

        # 3. Opslaan voor de check
        check_dir = os.path.join(os.path.dirname(__file__), 'data')
        os.makedirs(check_dir, exist_ok=True)
        df_hourly.to_csv(os.path.join(check_dir, 'check_hourly_usage.csv'))

        # 4. Merge met prijzen
        df_final = df_hourly.merge(
            prices_df[['Price(Eur/kWh)']], 
            left_index=True, 
            right_index=True, 
            how='inner'
        )

        # 5. Berekening
        df_final['kosten_variabel_uur'] = df_final['total_used_diff'] * df_final['Price(Eur/kWh)']
        
        return float(df_final['kosten_variabel_uur'].sum()), df_final
    except Exception as e:
        print(f"Fout in variabele berekening: {e}")
        return 0, None