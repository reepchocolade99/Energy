import pandas as pd
import os

def calculate_energy_costs(input_csv_path):
    # 1. Inladen van bestanden
    df_input = pd.read_csv(input_csv_path)
    current_dir = os.path.dirname(os.path.abspath(__file__))
    prices_path = os.path.join(current_dir, 'data', 'Netherlands.csv')
    
    print(f"[DEBUG] Proberen prijsbestand te laden: {prices_path}")
    try:
        prices_netherlands = pd.read_csv(prices_path)
        df_input = pd.read_csv(input_csv_path)
    except FileNotFoundError:
        print(f"[ERROR] Bestand niet gevonden op {prices_path}")
        # Als backup: probeer het absolute pad naar de backend map te forceren
        raise
    
    # 2. Prijzen voorbereiden (MWh naar kWh)
    prices_netherlands['Price(Eur/kWh)'] = prices_netherlands['Price (EUR/MWhe)'] / 1000
    prices_netherlands['Datetime (Local)'] = pd.to_datetime(prices_netherlands['Datetime (Local)'])
    prices_netherlands.set_index('Datetime (Local)', inplace=True)

    # 3. Input bestand naar datetime uren omzetten
    # We combineren de datum en tijd kolom
    df_input['datetime'] = pd.to_datetime(df_input['only_date'] + ' ' + df_input['only_time'])
    df_input.set_index('datetime', inplace=True)

    # 4. Groeperen naar uren (Resample)
    # We tellen de 'diff' waarden op per uur
    df_hourly = df_input[['low_used_diff', 'normal_used_diff']].resample('h').sum()

    # 5. Opslaan voor de check (tussenstap)
    check_path = 'data/check_hourly_usage.csv'
    df_hourly.to_csv(check_path)
    print(f"Check-bestand opgeslagen in: {check_path}")

    # 6. Mergen met de prijzen
    df_final = df_hourly.merge(
        prices_netherlands[['Price(Eur/kWh)']], 
        left_index=True, 
        right_index=True, 
        how='inner'
    )

    # 7. De berekening: prijs * low + prijs * normal
    opslag = 0.03795 
    df_final['kosten_variabel_uur'] = (
        ((df_final['Price(Eur/kWh)'] + opslag) * df_final['low_used_diff']) + 
        ((df_final['Price(Eur/kWh)'] + opslag) * df_final['normal_used_diff'])
    )
    total_cost = df_final['kosten_variabel_uur'].sum() + (7 * 12) # + vastrecht
    return total_cost, df_final