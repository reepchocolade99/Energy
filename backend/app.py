from flask import Flask, request, jsonify
import os
import traceback
from flask_cors import CORS
from dotenv import load_dotenv
from calculator import EnergyCalculator

load_dotenv()

app = Flask(__name__)

CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:5173", "http://127.0.0.1:5173"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

DATA_FILE = os.path.join(os.path.dirname(__file__), 'uploads', 'real_data.json')

@app.route('/api/load-local-data', methods=['GET'])
def load_local_data():
    try:
        if not os.path.exists(DATA_FILE):
            return jsonify({
                'success': False, 
                'error': f'Bestand {DATA_FILE} niet gevonden.'
            }), 404

        # Capture optional manual consumption parameters from query string
        manual_hoog = request.args.get('hoog', type=float, default=None)
        manual_laag = request.args.get('laag', type=float, default=None)

        calc = EnergyCalculator(DATA_FILE)
        response_data = calc.get_full_analysis_json(manual_hoog=manual_hoog, manual_laag=manual_laag)
        return jsonify(response_data), 200

    except Exception as e:
        print(f"[ERROR] load_local_data: {traceback.format_exc()}")
        return jsonify({'success': False, 'error': str(e)}), 500
    
@app.route('/api/month-detail/<int:month>', methods=['GET'])
def get_month_detail(month):
    try:
        if not os.path.exists(DATA_FILE):
            return jsonify({'error': 'Data niet gevonden'}), 404
            
        calc = EnergyCalculator(DATA_FILE)
        # Gebruik de methode uit de calculator, die regelt de logica voor JSON/Index
        data = calc.get_daily_usage_for_month(month)
        
        return jsonify(data), 200
    except Exception as e:
        print(f"[ERROR] month-detail: {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/hourly-detail/<int:month>', methods=['GET'])
def get_hourly_detail(month):
    calc = EnergyCalculator(DATA_FILE)
    df = calc.df[calc.df.index.month == month]
    
    hourly_stats = df.groupby(df.index.hour).agg({
        'consumption_interval': 'mean',
        'return_interval': 'mean'
    }).reset_index()
    
    hourly_stats.columns = ['hour', 'verbruik', 'teruglevering']
    return jsonify(hourly_stats.to_dict(orient='records'))

@app.route('/api/compare-contracts', methods=['GET'])
def compare_contracts():
    try:
        if not os.path.exists(DATA_FILE):
            return jsonify({'error': 'Geen data gevonden'}), 404

        calc = EnergyCalculator(DATA_FILE)
        results = calc.calculate()
        sorted_results = sorted(results, key=lambda x: x.get('yearlyCost', 0))
        
        return jsonify(sorted_results), 200
    except Exception as e:
        print(f"[ERROR] compare_contracts: {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500
# --- STATUS & LEGACY TRAPS ---

@app.route('/', methods=['GET'])
def status():
    return "<h1>⚡ Energy Backend is ONLINE (Port 5001)</h1><p>Gebruik GET /api/load-local-data</p>", 200


if __name__ == '__main__':
    # We draaien op 5001 om conflicten met AirPlay/andere diensten te vermijden
    app.run(debug=True, port=5001, host='0.0.0.0')