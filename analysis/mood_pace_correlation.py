import pandas as pd
import numpy as np
import fastf1
import os
import re
import matplotlib.pyplot as plt
import statsmodels.api as sm
from scipy.stats import fisher_exact, chi2_contingency
import warnings
warnings.filterwarnings('ignore')

fastf1.Cache.enable_cache('backend/app/data/fastf1_cache') # Use existing cache

df = pd.read_csv('final_labeled_dataset.csv')

# Drop ambiguous laps
initial_count = len(df)
df = df[df['lap_is_ambiguous'] != True].copy()
ambiguous_removed = initial_count - len(df)

df['next_lap_slower'] = np.nan
df['is_pit_lap'] = False
df['is_sc_lap'] = False
df['is_wet_lap'] = False
df['current_lap_time'] = np.nan
df['next_lap_time'] = np.nan

# Map session names
s_map = {'Sprint': 'S', 'Sprint Shootout': 'SS', 'Sprint Qualifying': 'SQ', 'Qualifying': 'Q', 'Race': 'R', 'Practice 1': 'FP1', 'Practice 2': 'FP2', 'Practice 3': 'FP3'}

for (gp, session_name), group in df.groupby(['gp', 'session']):
    session_id = s_map.get(session_name, 'R')
    try:
        session = fastf1.get_session(2026, gp, session_id)
        session.load(laps=True, telemetry=False, weather=True, messages=False)
    except Exception as e:
        print(f"Failed to load FastF1 for {gp} {session_id}: {e}")
        continue
        
    for idx, row in group.iterrows():
        driver = row['driver_code']
        lap_num = row['lap_number']
        
        if pd.isna(lap_num):
            continue
            
        try:
            # Fix pick_driver warning
            laps = session.laps.pick_drivers([driver]) if hasattr(session.laps, 'pick_drivers') else session.laps.pick_driver(driver)
            if laps.empty:
                continue
                
            curr_lap = laps[laps['LapNumber'] == lap_num]
            next_lap = laps[laps['LapNumber'] == lap_num + 1]
            
            if curr_lap.empty:
                continue
                
            curr_lap = curr_lap.iloc[0]
            
            # Times
            if pd.notna(curr_lap['LapTime']):
                df.at[idx, 'current_lap_time'] = curr_lap['LapTime'].total_seconds()
            
            if not next_lap.empty and pd.notna(next_lap.iloc[0]['LapTime']):
                df.at[idx, 'next_lap_time'] = next_lap.iloc[0]['LapTime'].total_seconds()
                
            # Pit stops
            if pd.notna(curr_lap['PitInTime']) or pd.notna(curr_lap['PitOutTime']):
                df.at[idx, 'is_pit_lap'] = True
                
            # SC / VSC (TrackStatus)
            status = str(curr_lap['TrackStatus'])
            if '4' in status or '6' in status or '7' in status:
                df.at[idx, 'is_sc_lap'] = True
                
            # Wet lap
            weather = session.weather_data
            if not weather.empty:
                lap_start = curr_lap['LapStartTime']
                weather_near = weather[weather['Time'] <= lap_start]
                if not weather_near.empty:
                    w = weather_near.iloc[-1]
                    if w.get('Rainfall') and w['Rainfall'] > 0:
                        df.at[idx, 'is_wet_lap'] = True
                        
        except Exception as e:
            print(f"Error processing {driver} lap {lap_num}: {e}")
            pass

# Compute target variable
df['next_lap_slower'] = np.where(
    df['next_lap_time'] > df['current_lap_time'] + 0.5, 1,
    np.where(pd.notna(df['next_lap_time']) & pd.notna(df['current_lap_time']), 0, np.nan)
)

# Sanity Checks
df_clean = df.dropna(subset=['next_lap_slower', 'human_label'])
total_usable = len(df_clean)

# Group human_label into Stressed vs Calm
def map_mood(l):
    l = str(l).lower()
    if l in ['frustrated', 'dejected', 'angry']:
        return 'Stressed'
    elif l in ['neutral', 'happy', 'calm']:
        return 'Calm'
    return 'Other'

df_clean['mood_group'] = df_clean['human_label'].apply(map_mood)
df_clean = df_clean[df_clean['mood_group'] != 'Other']

# Filter out external factors for simple tests/plots
df_filtered = df_clean[(~df_clean['is_pit_lap']) & (~df_clean['is_sc_lap']) & (~df_clean['is_wet_lap'])]

results_text = f"# Mood vs Pace Correlation Analysis\n\n"
results_text += f"## Baseline Sanity Checks\n"
results_text += f"- Initial rows: {initial_count}\n"
results_text += f"- Rows removed due to ambiguous lap timing: {ambiguous_removed}\n"
results_text += f"- Usable rows with valid lap times and mood labels: {total_usable}\n"
results_text += f"- Usable rows after removing pit, SC, and wet laps: {len(df_filtered)}\n\n"

results_text += f"### Class Balances (Filtered Dataset)\n"
results_text += f"Mood labels: {df_filtered['mood_group'].value_counts().to_dict()}\n"
results_text += f"Next lap slower: {df_filtered['next_lap_slower'].value_counts().to_dict()}\n\n"

if len(df_filtered) < 30:
    results_text += "> [!WARNING]\n"
    results_text += "> **UNDERPOWERED SAMPLE**\n"
    results_text += "> The total usable sample size after excluding noise (pit stops, safety cars, wet track) is too small to run a reliable logistic regression or claim statistical significance. Any results presented to the judges should be heavily caveated as exploratory.\n\n"

results_text += "## Analysis Results\n"

if len(df_filtered) >= 30:
    # Logistic Regression
    df_clean['mood_num'] = (df_clean['mood_group'] == 'Stressed').astype(int)
    X = df_clean[['mood_num', 'is_pit_lap', 'is_sc_lap', 'is_wet_lap']]
    X = sm.add_constant(X)
    y = df_clean['next_lap_slower']
    try:
        model = sm.Logit(y, X.astype(float))
        result = model.fit()
        pval = result.pvalues['mood_num']
        coef = result.params['mood_num']
        effect_size = np.exp(coef) # Odds ratio
        results_text += f"**Logistic Regression** (controlling for pit, SC, wet):\n"
        results_text += f"- P-value for Mood (Stressed): {pval:.3f}\n"
        results_text += f"- Odds Ratio: {effect_size:.2f} (A stressed driver is {effect_size:.2f}x as likely to have a slower next lap, adjusting for context).\n"
    except Exception as e:
        results_text += f"Regression failed: {e}\n"
else:
    # Simple test
    contingency = pd.crosstab(df_filtered['mood_group'], df_filtered['next_lap_slower'])
    if contingency.shape == (2,2):
        oddsratio, pvalue = fisher_exact(contingency)
        results_text += f"**Fisher's Exact Test** (Pit/SC/Wet laps excluded):\n"
        results_text += f"- P-value: {pvalue:.3f}\n"
        results_text += f"- Odds Ratio: {oddsratio:.2f} (Stressed vs Calm -> Next lap slower)\n"
    else:
        results_text += "Not enough data across groups to run Fisher's exact test.\n"

# Summary
results_text += "\n## Pitch-Ready Summary\n"
results_text += "> [!NOTE]\n"
results_text += "> **Correlation vs Causation:** This analysis measures correlation. A stressed mood might cause a driver to push too hard and lose time, but losing time (or tyre degradation) could also be causing the stressed mood.\n\n"

if len(df_filtered) < 30:
    results_text += "Our dataset of isolated incidents is currently too small to make confident statistical claims. When we filter out external factors like pit stops and safety cars, we don't have enough clear instances of frustration immediately preceding a clean lap to prove it degrades pace. We are building the pipeline to ingest more races so we can definitively answer this soon."
else:
    if 'pval' in locals() and pval < 0.05:
        results_text += f"When controlling for race context like pit stops and safety cars, a driver exhibiting a stressed or frustrated mood is {effect_size:.1f}x more likely to lose time on their subsequent lap. This proves that our psychological signals correlate with real-world pace degradation."
    else:
        results_text += "When controlling for external factors, we did not find a statistically significant correlation between a driver's mood and an immediate drop in pace on the very next lap. This suggests that elite drivers are largely able to compartmentalize frustration and maintain their delta in the short term."

with open("results.md", "w") as f:
    f.write(results_text)

# Plot
summary = df_filtered.groupby('mood_group')['next_lap_slower'].mean() * 100
fig, ax = plt.subplots(figsize=(6, 4))
summary.plot(kind='bar', color=['#4caf50', '#f44336'], ax=ax)
ax.set_title("Probability of Next Lap Being Slower (>0.5s)")
ax.set_ylabel("% of occurrences")
ax.set_xlabel("Driver Mood")
plt.xticks(rotation=0)
plt.tight_layout()
plt.savefig("mood_pace_plot.png")

import json
insights_data = {
    "calm_slower_percentage": float(summary.get("Calm", 0) if "Calm" in summary else 0),
    "stressed_slower_percentage": float(summary.get("Stressed", 0) if "Stressed" in summary else 0)
}
with open("insights.json", "w") as f:
    json.dump(insights_data, f)

print("Analysis complete. Check results.md, mood_pace_plot.png, and insights.json")
