# PENJAGA NLP Model

This folder contains the trainable NLP classifier for daily security reports.

## Files

- `data/nlp-training-samples.json`  
  Realistic labelled dummy data that matches PENJAGA operations, posts, incidents and Malay security report wording.

- `model/nlp-model.json`  
  Generated model artifact. This file is created by the training script.

## Train

From the project root:

```bash
npm run train:nlp
```

Or from `backend`:

```bash
npm run train:nlp
```

The script trains a dependency-free multinomial Naive Bayes model and prints category/risk accuracy.
It also expands the seed dataset with deterministic operation-style synthetic samples for each incident category, so the dummy validation set covers more wording variations.

Current dummy validation target:

```text
Category accuracy: >= 99%
Risk accuracy: >= 99%
```

This target is for controlled dummy/synthetic validation data. Real production accuracy should be measured again after adding reviewed reports from actual Pengawal/Ketua operations.

## Use In Backend

`backend/server.js` automatically loads:

```text
backend/ml/model/nlp-model.json
```

If the model is missing or confidence is low, PENJAGA falls back to the existing keyword rules.

You can override the model path with:

```env
NLP_MODEL_PATH=C:\path\to\nlp-model.json
```

## Improve Over Time

Add real reviewed reports into `data/nlp-training-samples.json` using this format:

```json
{
  "text": "Pintu belakang pejabat tidak berkunci semasa rondaan malam.",
  "category": "Keselamatan Fizikal",
  "risk": "Medium"
}
```

Retrain after adding examples.
