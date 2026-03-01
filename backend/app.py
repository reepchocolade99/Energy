from flask import Flask, request, jsonify
import pandas as pd
from io import BytesIO
import os
from dotenv import load_dotenv
from flask_cors import CORS
import traceback
from werkzeug.utils import secure_filename
from calculator import EnergyCalculator
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
def get_dynamic_surcharges():
    try:
        path = os.path.join(os.path.dirname(__file__), 'data', 'dynamic_contracts.csv')
        if os.path.exists(path):
            df_dyn = pd.read_csv(path)
            # Maak een dictionary: {'Zonneplan': 0.0200, 'Tibber': 0.0248, ...}
            return {row['provider'].strip(): float(str(row['surcharge_incl_vat']).replace(',', '.')) 
                    for _, row in df_dyn.iterrows()}
    except Exception as e:
        print(f"Fout bij laden dynamic_contracts.csv: {e}")
    return {}

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
        
        # 1. Gebruik de nieuwe calculator voor de data verwerking
        # We maken een instantie aan om toegang te krijgen tot de interne dataframes
        calc = EnergyCalculator(saved_path)
        all_results = calc.calculate() # Bereken alle contract opties
        
        # We hebben het verwerkte dataframe nodig voor de grafieken
        # Hiervoor moeten we even een kleine helper methode aanroepen of toevoegen aan de class
        df = pd.read_csv(saved_path)
        df['datetime'] = pd.to_datetime(df['only_date'] + ' ' + df['only_time'])
        df = df.set_index('datetime')
        
        # 2. VERBRUIK STATISTIEKEN
        total_kwh = float(df['low_used_diff'].sum() + df['normal_used_diff'].sum())
        start_date = df.index.min()
        end_date = df.index.max()
        num_days = (end_date - start_date).days or 1
        
        avg_daily = total_kwh / num_days
        monthly_val = avg_daily * 30.44 

        # 3. Hourly analytics (voor de profiel-grafiek)
        hourly_avg = df.groupby(df.index.hour).mean(numeric_only=True)
        hourly_data = {
            str(int(hour)): {
                'diff': float(row['low_used_diff'] + row['normal_used_diff'])
            } for hour, row in hourly_avg.iterrows()
        }
        
        # Zoek de 'Zonneplan' of eerste dynamische resultaat voor de 'variable_costs_total'
        # Dit vervangt de oude total_variable_cost
        dynamic_res = next((r for r in all_results if r['type'] == 'Dynamisch'), all_results[0])
        total_variable_cost = dynamic_res['total_year']

        # 4. JSON Antwoord samenstellen
        response_data = {
            'success': True,
            'isFromSmartMeter': True,
            'smartMeterData': { # Belangrijk voor PersonalDataPage.jsx
                'total_kwh': total_kwh,
                'average_daily_consumption': avg_daily,
                'date_range_start': str(start_date),
                'date_range_end': str(end_date)
            },
            'summary': {
                'total_kwh': total_kwh,
                'monthlyConsumption': monthly_val, 
                'variable_costs_total': total_variable_cost,
            },
            'hourly_analytics': hourly_data,
            'consumption_split': {
                'monthly_normal_used': (df['normal_used_diff'].sum() / num_days) * 30.44,
                'monthly_low_used': (df['low_used_diff'].sum() / num_days) * 30.44
            }
        }
        
        return jsonify(response_data), 200
        
    except Exception as e:
        print(f"[ERROR] {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/compare-contracts', methods=['POST'])
def compare_contracts():
    try:
        # 1. Zoek het meest recente geüploade bestand
        upload_dir = os.path.join(os.path.dirname(__file__), 'uploads')
        files = [f for f in os.listdir(upload_dir) if f.endswith('.csv')]
        if not files:
            return jsonify({"error": "Upload eerst een bestand voor een nauwkeurige vergelijking."}), 400

        latest_file = os.path.join(upload_dir, sorted(files, key=lambda x: os.path.getmtime(os.path.join(upload_dir, x)))[-1])

        # 2. Gebruik de NIEUWE calculator class
        calculator = EnergyCalculator(latest_file)
        full_results = calculator.calculate()

        # 3. Omzetten naar het formaat dat je React frontend verwacht
        # De frontend verwacht 'monthlyCost' en 'yearlyCost'
        formatted_results = []
        for res in full_results:
            formatted_results.append({
                'provider': res['provider'],
                'contractName': res.get('contract_name', res['type']),
                'type': res['type'],
                'monthlyCost': res['total_year'] / 12, # Gemiddelde voor de hoofdlijst
                'yearlyCost': res['total_year'],
                'monthly_breakdown': res['monthly_breakdown'], # Voor de maandelijkse details
                'isVariable': res['type'] != 'Vast'
            })

        # Sorteren op goedkoopste jaarbedrag
        sorted_results = sorted(formatted_results, key=lambda x: x['yearlyCost'])
        
        return jsonify(sorted_results)

    except Exception as e:
        print(f"[ERROR] Fout in compare_contracts:\n{traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/upload-usage', methods=['POST'])
def upload_file():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'Geen bestand gevonden'}), 400
            
        file = request.files['file']
        # Zorg dat het pad naar de tijdelijke file klopt met je mappenstructuur
        temp_path = os.path.join(os.path.dirname(__file__), 'data', 'temp_input.csv')
        os.makedirs(os.path.dirname(temp_path), exist_ok=True)
        file.save(temp_path)
        
        # Gebruik de nieuwe calculator class
        calculator = EnergyCalculator(temp_path)
        results = calculator.calculate()
        
        # We pakken de 'total_year' van het eerste resultaat (meestal Zonneplan/Dynamisch)
        # als indicatie voor de variabele kosten
        kosten = results[0]['total_year'] if results else 0
        
        return {
            "variabele_kosten": round(kosten, 2),
            "status": "success"
        }
    except Exception as e:
        print(f"[ERROR] Fout bij upload-usage: {e}")
        return jsonify({'error': str(e)}), 500

def calculate_all_dynamic_contracts(monthly_normal_kwh, monthly_low_kwh):
   
    try:
        # 1. Laad Marktprijzen (Kale inkoopprijs)
        prices_path = os.path.join(os.path.dirname(__file__), 'data', 'Netherlands.csv')
        prices_df = pd.read_csv(prices_path)
        prices_df['datetime'] = pd.to_datetime(prices_df['Datetime (UTC)'])
        prices_df['price_kwh'] = prices_df['Price (EUR/MWhe)'] / 1000
        prices_df = prices_df[['datetime', 'price_kwh']].set_index('datetime')

        # 2. Laad Jouw Uuraantallen (Gebruik)
        usage_path = os.path.join(os.path.dirname(__file__), 'data', 'check_hourly_usage.csv')
        usage_df = pd.read_csv(usage_path)
        usage_df['datetime'] = pd.to_datetime(usage_df['datetime'])
        usage_df = usage_df.set_index('datetime')

        # 3. Combineer gebruik en prijzen
        combined = usage_df[['low_used_diff', 'normal_used_diff']].join(prices_df['price_kwh'], how='inner').dropna()

        # 4. Laad de Contracten uit je nieuwe CSV
        dyn_csv_path = os.path.join(os.path.dirname(__file__), 'data', 'dynamic_contracts.csv')
        df_providers = pd.read_csv(dyn_csv_path)
        
        all_dynamic_results = []

        # 5. Bereken voor ELKE provider in de CSV de kosten
        for _, row in df_providers.iterrows():
            provider_name = row['provider'].strip()
            surcharge = float(str(row['surcharge_incl_vat']).replace(',', '.'))
            
            # De Rekensom per uur:
            # Kosten = Verbruik * (Marktprijs + Inkoopvergoeding)
            combined['cost_per_hour'] = (
                (combined['low_used_diff'] + combined['normal_used_diff']) * (combined['price_kwh'] + surcharge)
            )

            # Groepeer per maand voor het gemiddelde
            combined['year_month'] = combined.index.to_period('M')
            monthly_sums = combined.groupby('year_month')['cost_per_hour'].sum()
            avg_monthly = float(monthly_sums.mean())
            
            # Bereken de gemiddelde 'rate' voor de display op de kaart
            total_kwh = (combined['low_used_diff'].sum() + combined['normal_used_diff'].sum())
            total_cost = combined['cost_per_hour'].sum()
            avg_rate = total_cost / total_kwh if total_kwh > 0 else 0

            all_dynamic_results.append({
                'provider': provider_name,
                'contractName': 'Dynamisch',
                'surcharge_incl_vat': surcharge,
                'normalRate': round(avg_rate, 4),
                'lowRate': round(avg_rate, 4),
                'monthlyCostExtra': 0.0, # Je kunt dit ook uit de CSV halen indien nodig
                'monthlyCost': round(avg_monthly, 2),
                'yearlyCost': round(avg_monthly * 12, 2),
                'monthlyCostNormal': round(avg_monthly * 0.7, 2), # Indicatieve split
                'monthlyCostLow': round(avg_monthly * 0.3, 2)
            })

        return all_dynamic_results
    except Exception as e:
        print(f"[ERROR] calculate_all_dynamic_contracts: {traceback.format_exc()}")
        return []


@app.route('/api/zonnenplan-monthly', methods=['POST', 'OPTIONS'])
def zonnenplan_monthly():
    # Handle preflight
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    try:
        prices_path = os.path.join(os.path.dirname(__file__), 'data', 'Netherlands.csv')
        if not os.path.exists(prices_path):
            return jsonify([])

        prices_df = pd.read_csv(prices_path)
        prices_df['datetime'] = pd.to_datetime(prices_df['Datetime (UTC)'])
        prices_df['price_eur_per_kwh'] = pd.to_numeric(prices_df['Price (EUR/MWhe)'], errors='coerce') / 1000
        prices_df = prices_df[['datetime', 'price_eur_per_kwh']].set_index('datetime')

        # Prefer most recent upload in uploads/ (contains returned columns)
        upload_dir = os.path.join(os.path.dirname(__file__), 'uploads')
        files = [f for f in os.listdir(upload_dir) if f.endswith('.csv')] if os.path.exists(upload_dir) else []
        if not files:
            return jsonify([])
        latest_file = os.path.join(upload_dir, sorted(files, key=lambda x: os.path.getmtime(os.path.join(upload_dir, x)))[-1])

        usage_df = pd.read_csv(latest_file)
        # some uploads may have only_date/only_time; try to parse datetime robustly
        if 'datetime' in usage_df.columns:
            usage_df['datetime'] = pd.to_datetime(usage_df['datetime'], errors='coerce')
        elif 'only_date' in usage_df.columns and 'only_time' in usage_df.columns:
            usage_df['datetime'] = pd.to_datetime(usage_df['only_date'].astype(str) + ' ' + usage_df['only_time'].astype(str), errors='coerce')
        else:
            # try to find any date-like column
            if 'date' in usage_df.columns:
                usage_df['datetime'] = pd.to_datetime(usage_df['date'], errors='coerce')

        usage_df = usage_df.dropna(subset=['datetime']).set_index('datetime')

        combined = usage_df.join(prices_df['price_eur_per_kwh'], how='inner').fillna(0)

        # Ensure columns exist
        for col in ['low_used_diff', 'normal_used_diff', 'low_returned_diff', 'normal_returned_diff']:
            if col not in combined.columns:
                combined[col] = 0

        # Costs computation
        combined['normal_used_cost'] = combined['normal_used_diff'] * (combined['price_eur_per_kwh'] + 0.19)
        combined['low_used_cost'] = combined['low_used_diff'] * (combined['price_eur_per_kwh'] + 0.19)
        combined['normal_return_comp'] = combined['normal_returned_diff'] * combined['price_eur_per_kwh']
        combined['low_return_comp'] = combined['low_returned_diff'] * combined['price_eur_per_kwh']
        combined['net_cost'] = combined['normal_used_cost'] + combined['low_used_cost'] - (combined['normal_return_comp'] + combined['low_return_comp'])

        combined['year_month'] = combined.index.to_period('M')
        grouped = combined.groupby('year_month')

        month_map = {1: 'Jan', 2: 'Feb', 3: 'Mrt', 4: 'Apr', 5: 'Mei', 6: 'Jun', 7: 'Jul', 8: 'Aug', 9: 'Sep', 10: 'Okt', 11: 'Nov', 12: 'Dec'}
        out = []
        for period, grp in grouped:
            month_num = int(period.month)
            normal_used_sum = float(grp['normal_used_cost'].sum())
            low_used_sum = float(grp['low_used_cost'].sum())
            normal_return_sum = float(grp['normal_return_comp'].sum())
            low_return_sum = float(grp['low_return_comp'].sum())

            normal_cost = normal_used_sum - normal_return_sum
            low_cost = low_used_sum - low_return_sum
            total = float(grp['net_cost'].sum())
            verbruik_normaal = float(grp['normal_used_diff'].sum())
            verbruik_dal = float(grp['low_used_diff'].sum())

            out.append({
                'month': month_map.get(month_num, str(month_num)),
                'normaal': round(normal_cost, 2),
                'dal': round(low_cost, 2),
                'totaal': round(total, 2),
                'verbruik_normaal': round(verbruik_normaal, 2),
                'verbruik_dal': round(verbruik_dal, 2),
                'vergoeding_normaal': round(normal_return_sum, 2),
                'vergoeding_dal': round(low_return_sum, 2),
                'vergoeding_totaal': round(normal_return_sum + low_return_sum, 2)
            })

        # sort by month order
        month_order = list(month_map.values())
        out_sorted = sorted(out, key=lambda x: month_order.index(x['month']) if x['month'] in month_order else 0)
        return jsonify(out_sorted)
    except Exception as e:
        print(f"[ERROR] zonnenplan_monthly: {e}")
        return jsonify([]), 500

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
    

@app.route('/api/monthly-detail', methods=['POST'])
def monthly_detail():
    try:
        data = request.json
        target_month = int(data.get('month', 1))
        
        # We pakken het meest recente bestand uit de uploads map
        upload_dir = os.path.join(os.path.dirname(__file__), 'uploads')
        files = [f for f in os.listdir(upload_dir) if f.endswith('.csv')]
        if not files:
            return jsonify([])

        latest_file = os.path.join(upload_dir, sorted(files, key=lambda x: os.path.getmtime(os.path.join(upload_dir, x)))[-1])
        
        # Inladen
        df = pd.read_csv(latest_file)
        
        # Datum conversie
        df['datetime'] = pd.to_datetime(df['only_date'])
        df = df.set_index('datetime')
        
        # Filter op geselecteerde maand
        df_month = df[df.index.month == target_month]
        
        # Groepeer per dag en bereken verbruik en teruglevering
        daily = df_month.resample('D').sum(numeric_only=True)
        
        chart_data = []
        for d, row in daily.iterrows():
            # Separate normal and low usage for accurate cost calculation on frontend
            low_used = float(row.get('low_used_diff', 0))
            normal_used = float(row.get('normal_used_diff', 0))
            verbruik = low_used + normal_used

            low_returned = float(row.get('low_returned_diff', 0))
            normal_returned = float(row.get('normal_returned_diff', 0))
            teruglevering = low_returned + normal_returned

            chart_data.append({
                "day": d.day,
                "verbruik": round(verbruik, 2),
                "teruglevering": round(teruglevering, 2),
                "low": round(low_used, 2),
                "normal": round(normal_used, 2)
            })
        
        return jsonify(chart_data)
    except Exception as e:
        print(f"Grafiek fout: {e}")
        return jsonify([]), 500

@app.route('/api/hourly-detail', methods=['POST'])
def hourly_detail():
    try:
        data = request.json
        target_month = int(data.get('month', 1))
        
        # We pakken het meest recente bestand uit de uploads map
        upload_dir = os.path.join(os.path.dirname(__file__), 'uploads')
        files = [f for f in os.listdir(upload_dir) if f.endswith('.csv')]
        if not files:
            return jsonify([])

        latest_file = os.path.join(upload_dir, sorted(files, key=lambda x: os.path.getmtime(os.path.join(upload_dir, x)))[-1])
        
        # Inladen
        df = pd.read_csv(latest_file)
        
        # Datum + Tijd conversie
        df['datetime'] = pd.to_datetime(df['only_date'] + ' ' + df['only_time'])
        df = df.set_index('datetime')
        
        # Filter op geselecteerde maand
        df_month = df[df.index.month == target_month]
        
        # Groepeer per uur (0-23) en bereken gemiddeld verbruik en teruglevering per uur
        hourly = df_month.groupby(df_month.index.hour)[['low_used_diff', 'normal_used_diff', 'low_returned_diff', 'normal_returned_diff']].mean(numeric_only=True)
        
        chart_data = []
        for hour, row in hourly.iterrows():
            verbruik = float(row.get('low_used_diff', 0)) + float(row.get('normal_used_diff', 0))
            teruglevering = float(row.get('low_returned_diff', 0)) + float(row.get('normal_returned_diff', 0))
            
            chart_data.append({
                "hour": int(hour), 
                "verbruik": round(verbruik, 2),
                "teruglevering": round(teruglevering, 2)
            })
        
        # Sorteer op uur
        chart_data.sort(key=lambda x: x['hour'])
        
        return jsonify(chart_data)
    except Exception as e:
        print(f"Uurgrafiek fout: {e}")
        return jsonify([]), 500

if __name__ == '__main__':
    # Default to 5001 to avoid conflicts with other local services (e.g. AirPlay)
    port = int(os.getenv('PORT', 5001))
    print(f"\n⚡ Energy Backend Starting...")
    print(f"🔗 Server: http://127.0.0.1:{port}")
    print(f"📊 Status: http://127.0.0.1:{port}/")
    print(f"✓ CORS enabled\n")
    app.run(debug=True, port=5001, host='0.0.0.0')