# F1 Radio AI: Continuous Learning System

## Overview

F1 Radio AI is a comprehensive, real-time transcription, telemetry, and sentiment analysis pipeline built for Formula 1 team radios. 

While generic AI models struggle with high-stress environments and highly specific team jargon, this system introduces a powerful **Human-In-The-Loop (HITL)** continuous learning architecture, seamlessly integrated with **FastF1** telemetry data to provide unparalleled context to driver communications.

It allows Race Engineers to not only listen and transcribe live radio, but to intercept AI predictions, correct them, and instantly retrain the local machine learning model in milliseconds. This ensures the AI adapts to specific driver personalities and team codes, getting smarter every single race.

---

## 🏎️ Core F1 Capabilities

### 1. FastF1 Telemetry Integration
Words are meaningless without context. F1 Radio AI integrates directly with **FastF1** to pull live and historical session data:
- **Session Sync:** Automatically fetches driver lists, team mappings, and session schedules (e.g., Hungarian Grand Prix, Race).
- **Telemetry Match:** Maps a radio transmission directly to the exact lap, showing sector times, tyre compound, and track position at the moment the driver hit the radio button.

### 2. Automated Audio Pipeline
- **Livetiming & S3 Sync:** Automatically scrapes and pulls `.mp3` radio files from official F1 livetiming feeds and archive sources.
- **OpenAI Whisper:** Utilizes state-of-the-art speech-to-text to transcribe noisy F1 radios (complete with 15,000 RPM engine noise in the background) into accurate text.

### 3. F1 Dashboard
A sleek, premium React frontend built to match Formula 1 broadcast aesthetics:
- **Radio Archive Library:** Browse and replay historical radios.
- **Live Transcript Stream:** Displays the decoded radio message word-for-word.
- **Driver State Integration:** Shows contextual information about the driver, Grand Prix, and Session to provide a complete psychological picture of the cockpit.

---

## 🧠 The Continuous Learning Flywheel (HITL)

Formula 1 is highly dynamic. A driver cursing might mean "normal race mode" for one driver (like Yuki Tsunoda), but "catastrophic failure" for another (like Oscar Piastri). Generic AI doesn't know the difference and applies a one-size-fits-all approach.

To solve this, we built a **Human-In-The-Loop (HITL)** system:
- **AI Training Studio:** A built-in admin dashboard for engineers to review the AI's transcription and sentiment predictions in real-time.
- **Instant Correction:** If the AI misinterprets a strategy code like "Plan G" or misunderstands a driver's baseline mood, the engineer can manually edit the transcript, adjust the mood label (e.g., Frustrated, Happy, Neutral, Dejected), and dial in the exact intensity (Levels 1-5).
- **One-Click Retrain:** Clicking "Retrain Local Model" instantly writes the correction to the golden dataset (`final_labeled_dataset.csv`) and triggers a complete backend model recompilation.

---

## ⚡ The Custom Machine Learning Architecture

To achieve **instant retraining** without requiring massive GPU clusters or waiting hours for a heavy LLM to fine-tune, we implemented a highly optimized, lightweight text classification architecture:

1. **Transcription Layer:** Uses OpenAI's Whisper for high-fidelity speech-to-text.
2. **Local Sentiment Engine:** The brain of the operation is powered by a **Multinomial Naive Bayes (`MultinomialNB`)** classifier coupled with a **TF-IDF Vectorizer** (Term Frequency-Inverse Document Frequency) using `scikit-learn`.
   - **Why this model?** Speed and adaptability. A Naive Bayes text classifier can retrain on hundreds or thousands of labeled F1 radio clips in *milliseconds*. 
   - **How it works:** It maps the mathematical frequency of words (including newly learned F1 jargon like "box box" or "strat 5") directly to the corrected human labels. 
   - **The Result:** The moment the engineer clicks retrain, the model's weights are completely updated locally. The very next radio clip that comes in will be analyzed using the newly acquired knowledge, entirely offline.

---

## Technical Stack

- **Frontend:** React, Vite, TypeScript. Custom CSS styling mirroring the official F1 design system.
- **Backend:** Python, FastAPI, Uvicorn.
- **Data Engineering:** FastF1, FFmpeg (Audio processing).
- **Machine Learning:** Scikit-learn (`MultinomialNB`, `TfidfVectorizer`), Pandas, NumPy, OpenAI Whisper.
- **Data Layer:** Golden source-of-truth CSV (`final_labeled_dataset.csv`) that acts as the persistent memory for the local model.

---

## Getting Started

### 1. Environment Setup
You will need an OpenAI API key for the Whisper transcription. Create a `.env` file in the `backend/` directory:
```
OPENAI_API_KEY=your_key_here
```

### 2. Backend Setup
Navigate to the backend directory, initialize your virtual environment, install the ML dependencies, and start the FastAPI server:
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 3. Frontend Setup
Navigate to the frontend directory, install the Node packages, and spin up the Vite development server:
```bash
cd frontend
npm install
npm run dev
```

## How to Demo the HITL Loop
1. Select a radio clip from the dashboard.
2. Observe the AI's initial **NLP Text Sentiment** prediction and the associated **FastF1** telemetry data.
3. Open the **AI Training Studio (Admin)** panel.
4. Edit the transcript to fix any hallucinated words, or change the Mood Label and Intensity to reflect the true context.
5. Click **1. SAVE EDITS TO DATASET**.
6. Click **2. RETRAIN LOCAL MODEL**.
7. The system will instantly retrain, and the AI will now permanently understand that specific phrasing for future analysis!
