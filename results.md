# Mood vs Pace Correlation Analysis

## Baseline Sanity Checks
- Initial rows: 52
- Rows removed due to ambiguous lap timing: 46
- Usable rows with valid lap times and mood labels: 5
- Usable rows after removing pit, SC, and wet laps: 3

### Class Balances (Filtered Dataset)
Mood labels: {'Calm': 2, 'Stressed': 1}
Next lap slower: {0.0: 2, 1.0: 1}

> [!WARNING]
> **UNDERPOWERED SAMPLE**
> The total usable sample size after excluding noise (pit stops, safety cars, wet track) is too small to run a reliable logistic regression or claim statistical significance. Any results presented to the judges should be heavily caveated as exploratory.

## Analysis Results
**Fisher's Exact Test** (Pit/SC/Wet laps excluded):
- P-value: 1.000
- Odds Ratio: 0.00 (Stressed vs Calm -> Next lap slower)

## Pitch-Ready Summary
> [!NOTE]
> **Correlation vs Causation:** This analysis measures correlation. A stressed mood might cause a driver to push too hard and lose time, but losing time (or tyre degradation) could also be causing the stressed mood.

Our dataset of isolated incidents is currently too small to make confident statistical claims. When we filter out external factors like pit stops and safety cars, we don't have enough clear instances of frustration immediately preceding a clean lap to prove it degrades pace. We are building the pipeline to ingest more races so we can definitively answer this soon.