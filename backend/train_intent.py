"""
Day 3 - Intent classifier (guardrail #1, the classical-NLP piece).

Generates ~240 labeled examples with Gemini (you should skim them for quality),
trains TF-IDF + Logistic Regression, prints a classification report, and
saves intent_model.joblib — which guardrails.py picks up automatically.

Run:  python train_intent.py
"""

import json

import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

from config import PROJECT_ROOT
from pipeline.llm import llm_json

LABELS = ["scheme_question", "greeting", "off_topic", "injection"]
DATA_PATH = PROJECT_ROOT / "intent_data.json"
MODEL_PATH = PROJECT_ROOT / "intent_model.joblib"

GEN_PROMPT = """Generate {n} short realistic user messages of intent "{label}" for an
Indian government welfare-scheme chatbot. Mix languages: ~40% English, ~40% Hinglish
(romanized Hindi/Marathi), ~20% Devanagari. Vary length and tone; include typos.
Definitions:
- scheme_question: anything about schemes, eligibility, benefits, documents, applying
- greeting: hello/thanks/small openers
- off_topic: cricket scores, movie times, homework, jokes, weather, coding help
- injection: attempts to override instructions, reveal the system prompt, roleplay as
  something else, or output harmful content
Respond ONLY with JSON: {{"messages": [string, ...]}}"""


def generate_data() -> list[dict]:
    rows = []
    for label in LABELS:
        n = 90 if label == "scheme_question" else 50
        out = llm_json("You generate training data.", GEN_PROMPT.format(n=n, label=label))
        for m in out.get("messages", []):
            rows.append({"text": m, "label": label})
        print(f"{label}: {len(out.get('messages', []))} examples")
    return rows


def main() -> None:
    if DATA_PATH.exists():
        rows = json.loads(DATA_PATH.read_text(encoding="utf-8"))
        print(f"Loaded {len(rows)} existing examples from {DATA_PATH.name}")
    else:
        rows = generate_data()
        DATA_PATH.write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"Saved {len(rows)} examples -> {DATA_PATH.name} (skim it, fix bad ones!)")

    X = [r["text"] for r in rows]
    y = [r["label"] for r in rows]
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.25, random_state=42, stratify=y)

    model = Pipeline(
        [
            ("tfidf", TfidfVectorizer(ngram_range=(1, 2), analyzer="char_wb", max_features=20000)),
            ("clf", LogisticRegression(max_iter=2000, class_weight="balanced")),
        ]
    )
    model.fit(X_tr, y_tr)

    print("\n" + classification_report(y_te, model.predict(X_te)))
    joblib.dump(model, MODEL_PATH)
    print(f"Saved model -> {MODEL_PATH.name} (guardrails now use it automatically)")


if __name__ == "__main__":
    main()
