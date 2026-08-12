"""
Label F1 radio messages using a HuggingFace emotion classification model,
then compare against your human labels with the same reliability stats
(Cohen's Kappa / weighted Kappa / Krippendorff's alpha) you used for
inter-rater reliability.

Install (run once):
    pip install transformers torch pandas scikit-learn krippendorff --upgrade

Run:
    python hf_emotion_labeling.py
"""

import pandas as pd
import numpy as np
from transformers import pipeline
from sklearn.metrics import cohen_kappa_score, confusion_matrix
import krippendorff

# ---------------------------------------------------------------------
# 1. Load your data
# ---------------------------------------------------------------------
INPUT_CSV = "sheet1.csv"     # change path as needed
df = pd.read_csv(INPUT_CSV)

# ---------------------------------------------------------------------
# 2. Load a HuggingFace emotion classifier
#    j-hartmann/emotion-english-distilroberta-base outputs 7 classes:
#    anger, disgust, fear, joy, neutral, sadness, surprise
#    (each with a confidence score, all classes returned when top_k=None)
# ---------------------------------------------------------------------
classifier = pipeline(
    task="text-classification",
    model="j-hartmann/emotion-english-distilroberta-base",
    top_k=None,          # return scores for all classes
    truncation=True,
)

# ---------------------------------------------------------------------
# 3. Map the model's 7 emotions onto your 4-class taxonomy
#    (happy / neutral / frustrated / dejected)
#    Adjust this mapping if you disagree with any of these calls --
#    this is a judgment call worth documenting in your writeup.
# ---------------------------------------------------------------------
EMOTION_MAP = {
    "joy": "happy",
    "neutral": "neutral",
    "surprise": "neutral",       # ambiguous; F1 radio "surprise" is usually neutral-ish
    "anger": "frustrated",
    "disgust": "frustrated",
    "sadness": "dejected",
    "fear": "dejected",          # rare in this domain; treat as negative/dejected
}

def classify_row(text):
    if not isinstance(text, str) or not text.strip():
        return "neutral", 1, 0.0
    scores = classifier(text)[0]                     # list of {label, score}
    scores = sorted(scores, key=lambda x: -x["score"])
    top_label = scores[0]["label"]
    top_score = scores[0]["score"]

    mapped_emotion = EMOTION_MAP.get(top_label, "neutral")

    # Intensity proxy: scale the model's confidence (0-1) onto a 1-5 scale.
    # This is a heuristic, not a validated intensity measure -- confidence
    # reflects how sure the model is about the *label*, not necessarily how
    # strongly the emotion is expressed. Treat it as a rough signal.
    intensity = int(np.clip(round(top_score * 5), 1, 5))

    return mapped_emotion, intensity, top_score

results = df["Message"].apply(classify_row)
df["LLM_Emotion"] = [r[0] for r in results]
df["LLM_Intensity"] = [r[1] for r in results]
df["LLM_Confidence"] = [r[2] for r in results]

# ---------------------------------------------------------------------
# 4. Compare LLM labels to your two human raters
#    (adjust column names if yours differ)
# ---------------------------------------------------------------------
r1_emo = df["Emotion"].str.strip().str.lower()
r2_emo = df["Emotion.1"].str.strip().str.lower()
r1_int = df["Intensity (1-5)"].astype(int)
r2_int = df["Intensity (1-5).1"].astype(int)
llm_emo = df["LLM_Emotion"]
llm_int = df["LLM_Intensity"]

def report_pair(name_a, a_emo, name_b, b_emo, a_int, b_int):
    print(f"\n--- {name_a} vs {name_b} ---")
    print(f"Emotion agreement: {(a_emo == b_emo).mean():.3f}")
    print(f"Emotion Cohen's Kappa: {cohen_kappa_score(a_emo, b_emo):.3f}")
    print(f"Intensity exact agreement: {(a_int == b_int).mean():.3f}")
    print(f"Intensity quadratic weighted Kappa: "
          f"{cohen_kappa_score(a_int, b_int, weights='quadratic'):.3f}")

report_pair("Rater1", r1_emo, "Rater2", r2_emo, r1_int, r2_int)
report_pair("Rater1", r1_emo, "LLM", llm_emo, r1_int, llm_int)
report_pair("Rater2", r2_emo, "LLM", llm_emo, r2_int, llm_int)

# 3-way Krippendorff's alpha (nominal, emotion)
alpha_emo_3way = krippendorff.alpha(
    reliability_data=[r1_emo.tolist(), r2_emo.tolist(), llm_emo.tolist()],
    level_of_measurement="nominal",
)
print(f"\n3-way Krippendorff's Alpha (emotion, Rater1/Rater2/LLM): {alpha_emo_3way:.3f}")

alpha_int_3way = krippendorff.alpha(
    reliability_data=[r1_int.tolist(), r2_int.tolist(), llm_int.tolist()],
    level_of_measurement="ordinal",
)
print(f"3-way Krippendorff's Alpha (intensity, Rater1/Rater2/LLM): {alpha_int_3way:.3f}")

# ---------------------------------------------------------------------
# 5. Save output
# ---------------------------------------------------------------------
df.to_csv("labels_with_llm.csv", index=False)
print("\nSaved: labels_with_llm.csv")
