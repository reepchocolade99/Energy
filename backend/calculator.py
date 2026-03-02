import pandas as pd
import os

class EnergyCalculator:
    def __init__(self, input_csv_path):
        self.current_dir = os.path.dirname(os.path.abspath(__file__))
        self.input_path = input_csv_path

        
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
        hourly_usage = df[['low_used_diff', 'normal_used_diff']].resample('h').sum()
        
        # Groeperen per maand EN per uur voor de dynamische berekening
        monthly_usage = df[['low_used_diff', 'normal_used_diff']].resample('ME').sum()
        hourly_usage = df[['low_used_diff', 'normal_used_diff']].resample('h').sum()

        # 2. Spotprijzen inladen
        prices_df = pd.read_csv(self.prices_path)
        prices_df['Price(Eur/kWh)'] = prices_df['Price (EUR/MWhe)'] / 1000
        prices_df['Datetime (Local)'] = pd.to_datetime(prices_df['Datetime (Local)'])
        prices_df.set_index('Datetime (Local)', inplace=True)
        prices_df.index = prices_df.index.tz_localize(None) 
        hourly_usage.index = hourly_usage.index.tz_localize(None)

        all_provider_results = []

        # --- DYNAMISCHE CONTRACTEN ---
        if os.path.exists(self.dynamic_path):
            dyn_providers = pd.read_csv(self.dynamic_path)
            for _, provider in dyn_providers.iterrows():
                name = provider['provider']
                opslag = provider['surcharge_incl_vat']
                m_fee = float(str(provider['monthly_fee']).replace(',', '.'))
                
                print(f"DEBUG: Provider {name} heeft fee: {m_fee} ")
                # Bereken kosten per uur
                df_merged = hourly_usage.merge(prices_df[['Price(Eur/kWh)']], left_index=True, right_index=True)
                df_merged['cost'] = ((df_merged['Price(Eur/kWh)'] + opslag) * (df_merged['low_used_diff'] + df_merged['normal_used_diff']))
                energiekosten_variabel = df_merged['cost'].sum()
                vaste_lasten_totaal = m_fee * 12
                total_year_calc = float(energiekosten_variabel + vaste_lasten_totaal)

                # Groeperen per maand
                monthly_costs = df_merged['cost'].resample('ME').sum() + m_fee
                monthly_usage_norm = df_merged['normal_used_diff'].resample('ME').sum()
                monthly_usage_low = df_merged['low_used_diff'].resample('ME').sum()
                
                total_usage_norm = float(monthly_usage_norm.sum())
                total_usage_low = float(monthly_usage_low.sum())
                total_usage_combined = total_usage_norm + total_usage_low
                
            
                all_provider_results.append({
                    'provider': name,
                    'type': 'Dynamisch',
                    'monthly_fixed': round(m_fee, 2),
                    'monthly_breakdown': {
                        m.month: {
                            'totaal': round(c, 2),
                            'verbruik_normaal': round(monthly_usage_norm[m], 2), # Nu met verbruik!
                            'verbruik_dal': round(monthly_usage_low[m], 2)
                        } for m, c in monthly_costs.items()
                    },
                    'total_year_costs': round(total_year_calc, 2),
                    'average_month_costs': round(total_year_calc / 12, 2),
                    'total_usage_combined': round(total_usage_combined, 2),
                    'total_usage_low': round(total_usage_low, 2),
                    'total_usage_norm': round(total_usage_norm, 2),
                    'total_usage_year': round(total_usage_combined, 2)

                })
        # --- VASTE & VARIABELE CONTRACTEN ---
        if os.path.exists(self.fixed_path):
            fixed_df = pd.read_csv(self.fixed_path)
            for _, row in fixed_df.iterrows():
                p_normal = self._clean_price(row['Normaal'])
                p_dal = self._clean_price(row['Dal'])
                m_fee_fixed = 7.00  # Standaard vastrecht voor vaste contracten
                label = 'Vast' if 'Vast' in row['Contract'] else 'Variabel'
                
                monthly_detail = {}
                total_energy_costs = 0
                for timestamp, usage in monthly_usage.iterrows():
                    m_cost = (usage['low_used_diff'] * p_dal) + (usage['normal_used_diff'] * p_normal)
                    total_energy_costs += m_cost
                    monthly_detail[timestamp.month] = {
                        'totaal': round(m_cost + m_fee_fixed, 2),
                        'verbruik_normaal': round(usage['normal_used_diff'], 2),
                        'verbruik_dal': round(usage['low_used_diff'], 2)
                    }
                
                total_year_calc = float(total_energy_costs + (m_fee_fixed * 12))
                
                all_provider_results.append({
                    'provider': row['Energieleverancier'],
                    'type': label,
                    'monthly_fixed': m_fee_fixed,
                    'average_month_costs': round(total_year_calc / 12, 2),
                    'total_year_costs': round(total_year_calc, 2),
                    'total_usage_combined': round(float(monthly_usage.sum().sum()), 2),
                    'total_usage_low': round(float(monthly_usage['low_used_diff'].sum()), 2),
                    'total_usage_norm': round(float(monthly_usage['normal_used_diff'].sum()), 2),
                    'monthly_breakdown': monthly_detail
                })

        return all_provider_results
