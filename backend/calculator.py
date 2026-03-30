import pandas as pd
import os
import json

class EnergyCalculator:
    def __init__(self, input_path):
        self.current_dir = os.path.dirname(os.path.abspath(__file__))
        self.input_path = input_path
        self.prices_path = os.path.join(self.current_dir, 'data', 'Netherlands.csv')
        self.dynamic_path = os.path.join(self.current_dir, 'data', 'dynamic_contracts.csv')
        self.fixed_path = os.path.join(self.current_dir, 'data', 'vast_contract_energie.csv')
        self.df = self._load_and_shape_data()
        print(f"Beschikbare maanden in data: {self.df.index.month.unique().tolist()}")

    def _clean_price(self, val):
        if isinstance(val, str):
            return float(val.replace(',', '.'))
        return val

    def _load_and_shape_data(self):
        """Laadt JSON, voorkomt KeyErrors en splitst Verbruik/Teruglevering."""
        with open(self.input_path, 'r') as f:
            raw_data = json.load(f)
        
        records = raw_data.get('energyassetbundles', [])
        if not records:
            return pd.DataFrame(columns=['consumption_interval', 'return_interval'])

        df = pd.DataFrame(records)
        
        # Tijdskolom zoeken
        time_col = next((c for c in df.columns if c.lower() in ['timestamp', 'date']), None)
        if time_col:
            df['timestamp'] = pd.to_datetime(df[time_col])
            df = df.set_index('timestamp').sort_index()
        else:
            df.index = pd.date_range(start='2024-01-01', periods=len(df), freq='15min')

        val_col = 'value' if 'value' in df.columns else 'diff'
        df['raw_value'] = pd.to_numeric(df[val_col], errors='coerce').fillna(0)
        
        df['consumption_interval'] = df['raw_value'].clip(lower=0)
        
        df['return_interval'] = df['raw_value'].clip(upper=0)
        
        df['diff'] = df['consumption_interval'] 
        return df   
        

    def calculate(self):
        """Berekent kosten: gebruikt splitsing indien aanwezig."""
        # FIX: "andatd" typo verwijderd
        has_split = 'low_used_diff' in self.df.columns and 'normal_used_diff' in self.df.columns
        
        if has_split:
            hourly_usage = self.df[['low_used_diff', 'normal_used_diff']].resample('h').sum()
        else:
            hourly_usage = self.df[['consumption_interval']].resample('h').sum()

        prices_df = pd.read_csv(self.prices_path)
        prices_df['Price(Eur/kWh)'] = prices_df['Price (EUR/MWhe)'] / 1000
        prices_df['Datetime (Local)'] = pd.to_datetime(prices_df['Datetime (Local)'])
        prices_df.set_index('Datetime (Local)', inplace=True)
        prices_df.index = prices_df.index.tz_localize(None)
        hourly_usage.index = hourly_usage.index.tz_localize(None)

        all_provider_results = []

        # 1. DYNAMISCH
        if os.path.exists(self.dynamic_path):
            dyn_providers = pd.read_csv(self.dynamic_path)
            for _, provider in dyn_providers.iterrows():
                m_fee = self._clean_price(provider['monthly_fee'])
                opslag = self._clean_price(provider['surcharge_incl_vat'])
                
                df_merged = hourly_usage.merge(prices_df[['Price(Eur/kWh)']], left_index=True, right_index=True)
                total_usage_h = df_merged['consumption_interval'] if not has_split else (df_merged['low_used_diff'] + df_merged['normal_used_diff'])
                
                df_merged['cost'] = (df_merged['Price(Eur/kWh)'] + opslag) * total_usage_h
                totaal_jaar = float(df_merged['cost'].sum() + (m_fee * 12))

                all_provider_results.append({
                    'provider': provider['provider'],
                    'type': 'Dynamisch',
                    'monthlyCost': round(totaal_jaar / 12, 2),
                    'yearlyCost': round(totaal_jaar, 2),
                    'fixedCosts': round(m_fee, 2)
                })

        # 2. VAST & VARIABEL
        if os.path.exists(self.fixed_path):
            fixed_df = pd.read_csv(self.fixed_path)
            for _, row in fixed_df.iterrows():
                p_normal = self._clean_price(row['Normaal'])
                p_dal = self._clean_price(row['Dal'])
                
                if has_split:
                    totaal_energie = (self.df['low_used_diff'].sum() * p_dal) + (self.df['normal_used_diff'].sum() * p_normal)
                else:
                    totaal_energie = self.df['consumption_interval'].sum() * p_normal
                
                totaal_jaar = float(totaal_energie + (7.00 * 12)) 

                all_provider_results.append({
                    'provider': row['Energieleverancier'],
                    'type': 'Vast' if 'Vast' in row['Contract'] else 'Variabel',
                    'monthlyCost': round(totaal_jaar / 12, 2),
                    'yearlyCost': round(totaal_jaar, 2),
                    'fixedCosts': 7.00
                })

        return all_provider_results

    def get_summary(self):
        start_date = self.df.index.min()
        end_date = self.df.index.max()
        num_days = (end_date - start_date).days or 1
        
        total_used = float(self.df['consumption_interval'].sum())
        total_returned = float(self.df['return_interval'].sum())
        avg_daily = total_used / num_days
        
        return {
            'total_kwh': total_used,
            'total_returned_kwh': total_returned,
            'average_daily_consumption': avg_daily,
            'monthly_consumption_estimate': avg_daily * 30.44,
            'date_range': {'start': str(start_date), 'end': str(end_date)}
        }

    def get_hourly_analytics(self):
        hourly_avg = self.df.groupby(self.df.index.hour).agg({
            'consumption_interval': 'mean',
            'return_interval': 'mean'
        })
        
        return {
            str(int(hour)): {
                'verbruik': float(hourly_avg.loc[hour, 'consumption_interval']), # 'diff' wordt 'verbruik'
                'teruglevering': float(hourly_avg.loc[hour, 'return_interval'])
            } for hour in range(24) if hour in hourly_avg.index
        }

    def get_full_analysis_json(self):
        summary = self.get_summary()
        return {
            'success': True,
            'smartMeterData': {
                'total_kwh': summary['total_kwh'],
                'total_returned_kwh': abs(summary['total_returned_kwh']), 
                'average_daily_consumption': summary['average_daily_consumption'],
                'date_range_start': summary['date_range']['start'],
                'date_range_end': summary['date_range']['end']
            },
            'summary': {
                'total_kwh': summary['total_kwh'],
                'monthlyConsumption': summary['monthly_consumption_estimate']
            },
            'hourly_analytics': self.get_hourly_analytics(),
            'results': self.calculate()
        }

    def get_daily_usage_for_month(self, month):
        month_df = self.df[self.df.index.month == month].copy()
        if month_df.empty:
            return []
            
        daily_res = month_df.resample('D').agg({
            'consumption_interval': 'sum',
            'return_interval': 'sum'
        }).reset_index()

        daily_res['day'] = daily_res['timestamp'].dt.day
        return daily_res.rename(columns={
            'consumption_interval': 'verbruik',
            'return_interval': 'teruglevering' 
        }).to_dict(orient='records')