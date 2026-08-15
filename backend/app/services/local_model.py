import os
import pandas as pd
import joblib
import logging
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import make_pipeline
from pathlib import Path

logger = logging.getLogger(__name__)

# Paths
DATASET_PATH = Path("../final_labeled_dataset.csv")
MODEL_SAVE_PATH = Path("mood_model.pkl")

# We will use a fast pipeline: TF-IDF -> Naive Bayes
def train_local_model():
    """
    Reads the final_labeled_dataset.csv, trains a text classifier on 
    (text -> human_label), and saves the model to disk.
    """
    if not DATASET_PATH.exists():
        logger.warning(f"Dataset not found at {DATASET_PATH}")
        return False, "Dataset not found."

    try:
        # Load the dataset
        df = pd.read_csv(DATASET_PATH)

        # We only want rows that have text and a human_label
        df["target_label"] = df["human_label"].fillna(df["text_model_label"])
        
        # Drop rows missing text or a target label
        df = df.dropna(subset=["text", "target_label"])

        # Filter out random junk labels if any
        valid_labels = ["calm", "neutral", "stressed", "frustrated", "happy", "dejected", "angry", "annoyed"]
        df = df[df["target_label"].isin(valid_labels)]

        if len(df) < 5:
            return False, f"Not enough valid data to train. Found {len(df)} rows."

        # Prepare X and y
        X = df["text"].astype(str)
        y = df["target_label"].astype(str)

        # Build a fast text classification pipeline
        model = make_pipeline(TfidfVectorizer(stop_words="english", max_features=1000), MultinomialNB())
        
        # Train the model
        model.fit(X, y)

        # Save to disk
        joblib.dump(model, MODEL_SAVE_PATH)
        logger.info(f"Successfully trained and saved local model on {len(df)} rows.")
        return True, f"Successfully retrained model on {len(df)} clips."

    except Exception as e:
        logger.exception("Failed to train local model")
        return False, str(e)


def predict_mood_local(text: str) -> str:
    """
    Loads the local model and predicts the mood. 
    Returns None if the model doesn't exist yet.
    """
    if not MODEL_SAVE_PATH.exists():
        return None

    try:
        model = joblib.load(MODEL_SAVE_PATH)
        prediction = model.predict([text])[0]
        return prediction
    except Exception as e:
        logger.error(f"Error predicting with local model: {e}")
        return None
