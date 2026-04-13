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
        
        # Constanten voor de Nederlandse markt (incl. BTW)
        self.EB_PER_KWH = 0.13165  
        self.NETBEHEER_JAAR = 560.00  
        
        self.df = self._load_and_shape_data()
        if not self.df.empty:
            self.df['is_normaal'] = self.df.index.map(self._is_normaal_tarief)

    def _is_normaal_tarief(self, dt):
        """Ma-vr 07:00-23:00 geldt als normaaltarief."""
        if dt.weekday() >= 5: return False
        return 7 <= dt.hour < 23

    def get_seasonal_factor(self, month, is_solar=False):
        """Geeft het gewicht van een specifieke maand voor een jaarlijkse schatting."""
        if is_solar:
            profiles = {1: 0.03, 2: 0.05, 3: 0.09, 4: 0.12, 5: 0.14, 6: 0.15,
                        7: 0.14, 8: 0.12, 9: 0.08, 10: 0.05, 11: 0.02, 12: 0.01}
        else:
            profiles = {1: 0.125, 2: 0.105, 3: 0.10, 4: 0.08, 5: 0.065, 6: 0.05,
                        7: 0.045, 8: 0.05, 9: 0.065, 10: 0.085, 11: 0.105, 12: 0.125}
        return profiles.get(month, 0.083)

    def _load_and_shape_data(self):
        """Parseert JSON, corrigeert tijdzones en filtert foutieve meterstanden."""
        with open(self.input_path, 'r') as f:
            raw_data = json.load(f)
        
        records = raw_data.get('energyassetbundles', [])
        if not records: return pd.DataFrame()

        df_raw = pd.DataFrame(records)
        
        # Converteer UTC naar NL tijd om datacorruptie over maandgrenzen (bijv. dec/jan) te voorkomen
        df_raw['timestamp'] = pd.to_datetime(df_raw['timestamp'], utc=True).dt.tz_convert('Europe/Amsterdam')

        # Categorie 27 = Verbruik, Categorie 26 = Teruglevering
        cons = df_raw[df_raw['energyassetcategory'] == 27].copy()
        ret = df_raw[df_raw['energyassetcategory'] == 26].copy()

        # .clip(lower=0) verwijdert negatieve pieken (storingen of herstarts van de slimme meter)
        cons['consumption_interval'] = cons['value'].clip(lower=0)
        ret['return_interval'] = ret['value'].clip(lower=0)

        cons = cons[['timestamp', 'consumption_interval']].set_index('timestamp')
        ret = ret[['timestamp', 'return_interval']].set_index('timestamp')

        df = pd.concat([cons['consumption_interval'], ret['return_interval']], axis=1).fillna(0)
        return df.sort_index()

    def calculate(self, manual_hoog=None, manual_laag=None):
        """Berekent de contractkosten op basis van data-schatting of handmatige invoer."""
        if self.df.empty: return []

        # 1. Bepaal het data-gedreven verbruik
        months_in_data = self.df.index.month.unique()
        weight_cons = sum(self.get_seasonal_factor(m, is_solar=False) for m in months_in_data)
        weight_solar = sum(self.get_seasonal_factor(m, is_solar=True) for m in months_in_data)

        actual_cons = self.df['consumption_interval'].sum()
        actual_ret = self.df['return_interval'].sum()

        est_yearly_return = (actual_ret / weight_solar) if weight_solar > 0 else actual_ret * 12

        # 2. Overschrijf verbruik als de gebruiker de UI-inputs gebruikt
        if manual_hoog is not None and manual_laag is not None:
            est_yearly_usage = float(manual_hoog) + float(manual_laag)
        else:
            est_yearly_usage = (actual_cons / weight_cons) if weight_cons > 0 else actual_cons * 12

        all_results = []
        if os.path.exists(self.fixed_path):
            fixed_df = pd.read_csv(self.fixed_path)
            for idx, row in fixed_df.iterrows():
                p_normaal = float(str(row['Normaal']).replace(',', '.'))
                
                # Salderen: Netto stroomverbruik (minimaal 0)
                netto_verbruik = max(0, est_yearly_usage - est_yearly_return)
                totaal_jaar = (netto_verbruik * (p_normaal + self.EB_PER_KWH)) + (7.0 * 12) + self.NETBEHEER_JAAR
                
                all_results.append({
                    'id': str(row.get('id', f"fix-{idx}")),
                    'provider': row['Energieleverancier'],
                    'type': 'Vast' if 'Vast' in str(row['Contract']) else 'Variabel',
                    'monthlyCost': round(totaal_jaar / 12, 2),
                    'yearlyCost': round(totaal_jaar, 2),
                    'estUsage': round(est_yearly_usage, 0),
                    'estReturn': round(est_yearly_return, 0)
                })
        return all_results

    def get_summary(self):
        total_used = float(self.df['consumption_interval'].sum())
        total_ret = float(self.df['return_interval'].sum())
        return {
            'total_kwh': round(total_used, 2),
            'total_return_kwh': round(total_ret, 2),
            'date_range': {'start': str(self.df.index.min()), 'end': str(self.df.index.max())}
        }

    def get_hourly_analytics(self):
        hourly = self.df.groupby(self.df.index.hour).agg({
            'consumption_interval': 'mean',
            'return_interval': 'mean'
        })
        return {str(h): {'verbruik': round(hourly.loc[h, 'consumption_interval'], 3),
                         'teruglevering': round(hourly.loc[h, 'return_interval'], 3)} for h in hourly.index}

    def get_full_analysis_json(self, manual_hoog=None, manual_laag=None):
        return {
            'success': True,
            'summary': self.get_summary(),
            'hourly_analytics': self.get_hourly_analytics(),
            'results': self.calculate(manual_hoog, manual_laag)
        }

    def get_daily_usage_for_month(self, month):
        df_month = self.df[self.df.index.month == month]
        daily = df_month.groupby(df_month.index.date).agg({
            'consumption_interval': 'sum',
            'return_interval': 'sum'
        })
        return [{
            'date': str(index),
            'verbruik': round(row['consumption_interval'], 3),
            'teruglevering': round(row['return_interval'], 3)
        } for index, row in daily.iterrows()]