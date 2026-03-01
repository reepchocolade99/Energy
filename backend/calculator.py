import pandas as pd
import os

class EnergyCalculator:
    def __init__(self, input_csv_path):
        self.current_dir = os.path.dirname(os.path.abspath(__file__))
        self.input_path = input_csv_path
        self.vastrecht_pm = 7.00
        
        # Paden naar data
        self.prices_path = os.path.join(self.current_dir, 'data', 'Netherlands.csv')
        self.dynamic_path = os.path.join(self.current_dir, 'data', 'dynamic_contracts.csv')
        self.fixed_path = os.path.join(self.current_dir, 'data', 'vast_contract_energie.csv')

    def _clean_price(self, val):
        if isinstance(val, str):
            return float(val.replace(',', '.'))
        return val

    def calculate(self):
        """Voert de volledige berekening uit voor alle maanden in de data."""
        # 1. Verbruik inladen
        df = pd.read_csv(self.input_path)
        df['datetime'] = pd.to_datetime(df['only_date'] + ' ' + df['only_time'])
        df.set_index('datetime', inplace=True)
        
        # Groeperen per maand EN per uur voor de dynamische berekening
        monthly_usage = df[['low_used_diff', 'normal_used_diff']].resample('ME').sum()
        hourly_usage = df[['low_used_diff', 'normal_used_diff']].resample('h').sum()

        # 2. Spotprijzen inladen
        prices_df = pd.read_csv(self.prices_path)
        prices_df['Price(Eur/kWh)'] = prices_df['Price (EUR/MWhe)'] / 1000
        prices_df['Datetime (Local)'] = pd.to_datetime(prices_df['Datetime (Local)'])
        prices_df.set_index('Datetime (Local)', inplace=True)

        all_provider_results = []

        # --- DYNAMISCHE CONTRACTEN ---
        if os.path.exists(self.dynamic_path):
            dyn_providers = pd.read_csv(self.dynamic_path)
            for _, provider in dyn_providers.iterrows():
                name = provider['provider']
                opslag = provider['surcharge_incl_vat']
                
                # Bereken kosten per uur
                df_merged = hourly_usage.merge(prices_df[['Price(Eur/kWh)']], left_index=True, right_index=True)
                df_merged['cost'] = ((df_merged['Price(Eur/kWh)'] + opslag) * (df_merged['low_used_diff'] + df_merged['normal_used_diff']))
                
                # Groeperen per maand
                monthly_costs = df_merged['cost'].resample('ME').sum() + self.vastrecht_pm
                monthly_usage_norm = df_merged['normal_used_diff'].resample('ME').sum()
                monthly_usage_low = df_merged['low_used_diff'].resample('ME').sum()
                all_provider_results.append({
                    'provider': name,
                    'type': 'Dynamisch',
                    'monthly_breakdown': {
                        m.month: {
                            'totaal': round(c, 2),
                            'verbruik_normaal': round(monthly_usage_norm[m], 2), # Nu met verbruik!
                            'verbruik_dal': round(monthly_usage_low[m], 2)
                        } for m, c in monthly_costs.items()
                    },
                    'total_year': round(monthly_costs.sum(), 2)
                })
        # --- VASTE & VARIABELE CONTRACTEN ---
        if os.path.exists(self.fixed_path):
            fixed_df = pd.read_csv(self.fixed_path)
            for _, row in fixed_df.iterrows():
                p_normal = self._clean_price(row['Normaal'])
                p_dal = self._clean_price(row['Dal'])
                label = 'Vast' if 'Vast' in row['Contract'] else 'Variabel'
                
                # Bereken kosten per maand op basis van werkelijk verbruik in die maand
                monthly_detail = {}
                for timestamp, usage in monthly_usage.iterrows():
                    m_cost = (usage['low_used_diff'] * p_dal) + (usage['normal_used_diff'] * p_normal) + self.vastrecht_pm
                    monthly_detail[timestamp.month] = round(m_cost, 2)
                
                all_provider_results.append({
                    'provider': row['Energieleverancier'],
                    'contract_name': row['Contract'],
                    'type': label,
                    'monthly_breakdown': monthly_detail,
                    'total_year': round(sum(monthly_detail.values()), 2)
                })

        return all_provider_results

# HOE TE GEBRUIKEN:
# calculator = EnergyCalculator('usage.csv')
# results = calculator.calculate()