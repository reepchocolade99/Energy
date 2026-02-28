import pandas as pd, os
base='backend/data'
prices_path = os.path.join(os.path.dirname(__file__), 'data', 'Netherlands.csv')
usage_path = os.path.join(os.path.dirname(__file__), 'data', 'check_hourly_usage.csv')

prices = pd.read_csv(prices_path)
prices['datetime'] = pd.to_datetime(prices.get('Datetime (UTC)') , errors='coerce')
prices['price'] = pd.to_numeric(prices.get('Price (EUR/MWhe)'), errors='coerce') / 1000
prices = prices.dropna(subset=['datetime']).set_index('datetime')

usage = pd.read_csv(usage_path)
usage['datetime'] = pd.to_datetime(usage.get('datetime'), errors='coerce')
usage = usage.dropna(subset=['datetime']).set_index('datetime')

print('prices range:', prices.index.min(), '->', prices.index.max(), 'len', len(prices))
print('usage range:', usage.index.min(), '->', usage.index.max(), 'len', len(usage))

common = usage.join(prices['price'], how='inner')
print('joined len:', len(common))
print('columns sample:', common.columns.tolist()[:20])

for col in ['low_returned_diff','normal_returned_diff','low_used_diff','normal_used_diff']:
    if col in common.columns:
        print(col, 'sum', common[col].sum())
    else:
        print(col, 'missing')

print('price sample (first 10 non-null):')
print(common['price'].dropna().head(10).to_string())

print('\njoined head:')
print(common.head(10).to_string())
