# Handoff Brief for LLM Pipeline

This document contains the fully prepared, precomputed dataset and environment configuration required to build the backend and frontend for the F1 Team Radio Emotion Analysis project.

## 1. Data Locations
- **Final Labeled Dataset**: `/Users/shrujannam/Documents/f1-london-visit/final_labeled_dataset.csv`
  - *Schema*: `clip_id`, `gp`, `session`, `driver_code`, `driver_name`, `speaker`, `text`, `is_audio_only`, `human_label`, `human_label_intensity`, `audio_model_label`, `text_model_label`, `lap_number`, `lap_is_ambiguous`, `audio_url`
  - *Note*: The `lap_number` column has already been precomputed via FastF1, removing the need for live timezone alignment in the backend.
- **Audio Files Folder**: `/Users/shrujannam/Documents/f1-london-visit/backend/app/data/audio/`
  - *Note*: All audio files have been physically moved here. The backend should serve these static files. Filenames match the `clip_id` column exactly (e.g., `clip_id.mp3`).

## 2. Hugging Face Inference API Configuration
Please set `HF_TOKEN` in the `.env` file before starting the backend.

**Target Models**:
- **Text Sentiment**: `j-hartmann/emotion-english-distilroberta-base`
- **Audio Emotion**: `ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition`

*A test script `hf_api_test.py` has been provided to manually verify API access for these models.*

## 3. Demo "Hero" Clips (Task 15/16 Target)
These clips have been identified from the sample dataset as having a clear mood shift/story to highlight in the UI demo:
1. **clip_id: HAM_44_20260524_162056**
   - *Driver*: HAM (Lewis Hamilton)
   - *Emotion*: Frustrated (Intensity: 5)
2. **clip_id: LEC_16_20260523_164217**
   - *Driver*: LEC (Charles Leclerc)
   - *Emotion*: Dejected (Intensity: 4)
3. **clip_id: VER_3_20260523_165322**
   - *Driver*: VER (Max Verstappen)
   - *Emotion*: Frustrated (Intensity: 4)
4. **clip_id: RUS_63_20260523_170207**
   - *Driver*: RUS (George Russell)
   - *Emotion*: Happy (Intensity: 4)

---
**Implementation Agent Instructions**: 
You can now proceed directly with implementing the backend using these exact paths, schemas, and models. Do not attempt to query FastF1 for laps, as the `lap_number` is already provided in the CSV.
