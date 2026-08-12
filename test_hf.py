import os

import requests

HF_TOKEN = os.environ.get("HF_TOKEN")
if not HF_TOKEN:
    raise SystemExit("Set HF_TOKEN before running this script.")

headers = {"Authorization": f"Bearer {HF_TOKEN}"}

models = [
    "superb/wav2vec2-base-superb-er",
    "facebook/wav2vec2-base-960h",
    "jonatasgrosman/wav2vec2-large-xlsr-53-english",
    "audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim"
]

for model in models:
    url = f"https://router.huggingface.co/hf-inference/models/{model}"
    print(f"Testing {model} ...")
    resp = requests.post(url, headers=headers, json={"inputs": "test"})
    print(resp.status_code, resp.text[:200])
