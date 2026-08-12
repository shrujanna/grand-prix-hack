import pandas as pd
import fastf1
import re
import os
from datetime import timedelta

def extract_datetime(row):
    # Try to get exact time from local audio file: e.g. ANT_12_20260523_121237.mp3
    filename = row.get('Local Audio File', '')
    date_str = row['Date']
    time_str = row['Time']
    match = re.search(r'\d{8}_(\d{6})', filename)
    if match:
        time_exact = match.group(1)
        h, m, s = time_exact[0:2], time_exact[2:4], time_exact[4:6]
        return pd.to_datetime(f"{date_str} {h}:{m}:{s}")
    else:
        return pd.to_datetime(f"{date_str} {time_str}:00")

def process_dataset(input_path, output_path):
    df = pd.read_csv(input_path)
    df['clip_id'] = df['Local Audio File'].apply(lambda x: os.path.basename(x).replace('.mp3', '') if pd.notna(x) else '')
    df['exact_datetime'] = df.apply(extract_datetime, axis=1)
    
    df['lap_number'] = None
    df['lap_is_ambiguous'] = False
    
    # group by GP and Session
    for (gp, session_name), group in df.groupby(['Grand Prix', 'Session']):
        # Map session_name to fastf1 format. For "Sprint" -> 'S', "Qualifying" -> 'Q', "Race" -> 'R', etc.
        s_map = {'Sprint': 'S', 'Sprint Shootout': 'SS', 'Sprint Qualifying': 'SQ', 'Qualifying': 'Q', 'Race': 'R', 'Practice 1': 'FP1', 'Practice 2': 'FP2', 'Practice 3': 'FP3'}
        session_id = s_map.get(session_name, 'R')
        try:
            print(f"Loading FastF1 for {gp} - {session_id}")
            # Note: year is hardcoded or from Date
            year = group['exact_datetime'].dt.year.iloc[0]
            session = fastf1.get_session(year, gp, session_id)
            session.load(laps=True, telemetry=False, weather=False, messages=False)
        except Exception as e:
            print(f"Failed to load {gp} {session_id}: {e}")
            continue
            
        for idx, row in group.iterrows():
            driver = row['Driver Code']
            msg_time = row['exact_datetime']
            
            try:
                laps = session.laps.pick_driver(driver)
                if laps.empty:
                    # try using driver number if code fails
                    laps = session.laps.pick_driver(str(row.get('Driver Code'))) # wait, might be a number in future
            except:
                print(f"No laps for driver {driver}")
                continue
                
            if laps.empty:
                print(f"Driver {driver} not found or no laps.")
                continue
                
            # Need timezone awareness. FastF1 lap start dates might not have tz, but they represent local time or UTC?
            # session.date is a datetime. LapStartDate is usually timezone unaware but in UTC? or local time?
            # Actually, `fastf1` 3.x LapStartDate is UTC. Let's force naive.
            
            # We don't have reliable absolute lap dates (LapStartDate is NaT).
            # Instead, we will convert msg_time into a Timedelta since the session's StartDate, 
            # and compare it to lap['LapStartTime'].
            # session_info['StartDate'] is usually localized. msg_time is naive.
            session_start = session.session_info['StartDate'].replace(tzinfo=None)
            msg_time_naive = msg_time.replace(tzinfo=None)
            
            # Since fastf1 session start might have different hour offset (e.g. UTC vs local),
            # we find the difference in hours and round it to 0.
            offset_total = msg_time_naive - session_start
            rounded_hours = round(offset_total.total_seconds() / 3600.0) * 3600
            
            # Adjust session start to match msg_time's timezone approx
            session_start_adj = session_start + pd.Timedelta(seconds=rounded_hours)
            
            # Session relative time of the message
            msg_rel_time = msg_time_naive - session_start_adj
            
            # Add 1 hour to msg_rel_time for races if needed? Wait, fastf1 lap times are relative to session start.
            # Usually formation lap starts at StartDate. So LapStartTime for Lap 1 is ~1-2 mins.
            
            matching_laps = laps[(laps['LapStartTime'] <= msg_rel_time) & (msg_rel_time <= (laps['LapStartTime'] + laps['LapTime']))]
            
            if len(matching_laps) > 0:
                lap_num = matching_laps.iloc[0]['LapNumber']
                df.at[idx, 'lap_number'] = lap_num
            else:
                # find closest lap
                laps['time_diff'] = (laps['LapStartTime'] - msg_rel_time).abs()
                closest_lap = laps.sort_values('time_diff').iloc[0]
                df.at[idx, 'lap_number'] = closest_lap['LapNumber']
                df.at[idx, 'lap_is_ambiguous'] = True
                
    # Renaming and reordering
    # clip_id, gp, session, driver_code, driver_name, speaker, text, is_audio_only, human_label, human_label_intensity, audio_model_label, text_model_label, lap_number, lap_is_ambiguous, audio_url
    df['gp'] = df['Grand Prix']
    df['session'] = df['Session']
    df['driver_code'] = df['Driver Code']
    df['driver_name'] = df['Driver Name']
    df['text'] = df['Message']
    df['speaker'] = df['Speaker']
    df['human_label'] = df['emotion']
    df['human_label_intensity'] = df['intensity']
    df['audio_url'] = df['Audio URL']
    df['is_audio_only'] = False
    df['audio_model_label'] = None
    df['text_model_label'] = None
    
    final_cols = ['clip_id', 'gp', 'session', 'driver_code', 'driver_name', 'speaker', 'text', 'is_audio_only', 'human_label', 'human_label_intensity', 'audio_model_label', 'text_model_label', 'lap_number', 'lap_is_ambiguous', 'audio_url']
    final_df = df[final_cols]
    final_df.to_csv(output_path, index=False)
    print(f"Saved to {output_path}")

if __name__ == '__main__':
    process_dataset('dataset.csv', 'final_labeled_dataset.csv')
