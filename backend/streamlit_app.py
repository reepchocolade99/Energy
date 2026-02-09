import streamlit as st
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import io
from datetime import datetime

def shaping_df(df):
    """Shape and process energy consumption data"""
    df = df.set_index(['date'])
    df.index = pd.to_datetime(df.index)
    
    daily = df['total'].resample('D').mean()
    daily = daily.to_frame()
    daily['diff'] = daily['total'].diff().fillna(0)
    
    df['daily_total'] = df['total'].resample('D').mean().reindex(df.index, method='ffill')
    df['diff'] = df['total'].diff().fillna(0)
    
    return df


def main():
    st.set_page_config(page_title="Energy Analysis", layout="wide")
    
    st.title("⚡ Persoonlijke Energie Analyse")
    st.markdown("---")
    
    # File upload section
    st.header("📤 Upload je slimme meter data")
    uploaded_file = st.file_uploader(
        "Kies een CSV of Excel bestand",
        type=['csv', 'xlsx', 'xls'],
        help="Bestand moet 'date' en 'total' kolommen bevatten"
    )
    
    if uploaded_file is not None:
        try:
            # Read file
            if uploaded_file.name.endswith('.csv'):
                df = pd.read_csv(uploaded_file)
            else:
                df = pd.read_excel(uploaded_file)
            
            # Validate columns
            if 'date' not in df.columns or 'total' not in df.columns:
                st.error("❌ Bestand moet 'date' en 'total' kolommen bevatten")
                return
            
            # Process data
            df_processed = shaping_df(df.copy())
            
            # Create tabs
            tab1, tab2, tab3 = st.tabs(["📊 Persoonlijke Gegevens", "📈 Details", "📋 Data"])
            
            # Tab 1: Personal Data
            with tab1:
                st.header("Jouw Energieverbruik Profiel")
                
                # Key metrics
                col1, col2, col3, col4 = st.columns(4)
                
                with col1:
                    st.metric(
                        "Totaal Records",
                        len(df_processed),
                        help="Aantal metingen in het bestand"
                    )
                
                with col2:
                    st.metric(
                        "Periode",
                        f"{df_processed.index.min().strftime('%d-%m-%Y')} tot {df_processed.index.max().strftime('%d-%m-%Y')}",
                        help="Datumrange van de data"
                    )
                
                with col3:
                    avg_consumption = df_processed['daily_total'].mean()
                    st.metric(
                        "Gem. Dagelijks Verbruik",
                        f"{avg_consumption:.2f} kWh",
                        help="Gemiddeld dagelijks energieverbruik"
                    )
                
                with col4:
                    total_consumption = df_processed['daily_total'].sum()
                    st.metric(
                        "Totaal Verbruik",
                        f"{total_consumption:.2f} kWh",
                        help="Totaal energieverbruik in periode"
                    )
                
                st.markdown("---")
                
                # Hourly analysis
                st.subheader("⏰ Gemiddeld Verbruik per Uur")
                
                # Group by hour
                hour_of_day_avg = df_processed.groupby(df_processed.index.hour).mean()
                
                # Create figure
                fig, ax = plt.subplots(figsize=(12, 6))
                ax.plot(
                    hour_of_day_avg.index,
                    hour_of_day_avg['diff'],
                    marker='o',
                    color='#96c63e',
                    linewidth=2,
                    markersize=8,
                    label='Gemiddeld Verbruik (kWh)'
                )
                
                ax.set_xlabel('Uur van de Dag', fontsize=12, fontweight='bold')
                ax.set_ylabel('Gemiddeld Kwart-uur Verschil (kWh)', fontsize=12, fontweight='bold')
                ax.set_title('Gemiddeld Energieverbruik per Uur', fontsize=14, fontweight='bold')
                ax.legend(fontsize=11)
                ax.grid(True, alpha=0.3, linestyle='--')
                ax.set_xticks(range(0, 24))
                
                plt.tight_layout()
                st.pyplot(fig)
                
                # Statistics
                st.markdown("### 📊 Statistieken per Uur")
                col1, col2, col3 = st.columns(3)
                
                with col1:
                    peak_hour = hour_of_day_avg['diff'].idxmax()
                    peak_value = hour_of_day_avg['diff'].max()
                    st.metric("🔴 Piekuur", f"{peak_hour}:00", f"{peak_value:.3f} kWh")
                
                with col2:
                    low_hour = hour_of_day_avg['diff'].idxmin()
                    low_value = hour_of_day_avg['diff'].min()
                    st.metric("🟢 Laagste Uur", f"{low_hour}:00", f"{low_value:.3f} kWh")
                
                with col3:
                    avg_hourly = hour_of_day_avg['diff'].mean()
                    st.metric("📈 Gemiddelde", "", f"{avg_hourly:.3f} kWh")
            
            # Tab 2: Detailed Analysis
            with tab2:
                st.header("📈 Gedetailleerde Analyse")
                
                # Daily consumption
                st.subheader("Dagelijks Verbruik")
                daily_data = df_processed.groupby(df_processed.index.date)['daily_total'].first()
                
                fig, ax = plt.subplots(figsize=(14, 5))
                ax.plot(daily_data.index, daily_data.values, marker='o', linewidth=1.5, color='#373737', markersize=4)
                ax.fill_between(daily_data.index, daily_data.values, alpha=0.3, color='#96c63e')
                ax.set_xlabel('Datum', fontsize=11, fontweight='bold')
                ax.set_ylabel('Dagelijks Verbruik (kWh)', fontsize=11, fontweight='bold')
                ax.set_title('Dagelijks Energieverbruik Trend', fontsize=13, fontweight='bold')
                ax.grid(True, alpha=0.3)
                plt.xticks(rotation=45)
                plt.tight_layout()
                st.pyplot(fig)
                
                # Monthly analysis
                st.subheader("Maandelijks Verbruik")
                monthly_data = df_processed.groupby(df_processed.index.to_period('M'))['daily_total'].sum()
                
                fig, ax = plt.subplots(figsize=(12, 5))
                bars = ax.bar(range(len(monthly_data)), monthly_data.values, color='#96c63e', alpha=0.8, edgecolor='#373737')
                ax.set_xlabel('Maand', fontsize=11, fontweight='bold')
                ax.set_ylabel('Maandelijks Verbruik (kWh)', fontsize=11, fontweight='bold')
                ax.set_title('Maandelijks Energieverbruik', fontsize=13, fontweight='bold')
                ax.set_xticks(range(len(monthly_data)))
                ax.set_xticklabels([str(m) for m in monthly_data.index], rotation=45)
                ax.grid(True, alpha=0.3, axis='y')
                plt.tight_layout()
                st.pyplot(fig)
                
                # Statistics table
                st.markdown("### Maandstatistieken")
                monthly_stats = pd.DataFrame({
                    'Maand': [str(m) for m in monthly_data.index],
                    'Totaal Verbruik (kWh)': monthly_data.values.round(2),
                    'Gemiddelde per Dag (kWh)': (monthly_data.values / [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][:len(monthly_data)]).round(2)
                })
                st.dataframe(monthly_stats, use_container_width=True, hide_index=True)
            
            # Tab 3: Raw Data
            with tab3:
                st.header("📋 Ruwe Data")
                st.dataframe(df_processed, use_container_width=True)
                
                # Download button
                csv = df_processed.to_csv()
                st.download_button(
                    label="📥 Download verwerkte data als CSV",
                    data=csv,
                    file_name=f"energy_data_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
                    mime="text/csv"
                )
        
        except Exception as e:
            st.error(f"❌ Fout bij verwerken bestand: {str(e)}")
    
    else:
        st.info("👆 Upload een CSV of Excel bestand om je energie analyse te zien")


if __name__ == "__main__":
    main()
