import re

STATE_ALIASES = {
    "tamil nadu": "Tamil Nadu", "tamilnadu": "Tamil Nadu", "tn": "Tamil Nadu", "தமிழ்நாடு": "Tamil Nadu",
    "andhra pradesh": "Andhra Pradesh", "andhrapradesh": "Andhra Pradesh", "ap": "Andhra Pradesh",
    "karnataka": "Karnataka", "kerala": "Kerala", "telangana": "Telangana",
    "maharashtra": "Maharashtra", "rajasthan": "Rajasthan", "gujarat": "Gujarat",
    "uttar pradesh": "Uttar Pradesh", "bihar": "Bihar", "odisha": "Odisha",
    "west bengal": "West Bengal", "assam": "Assam", "punjab": "Punjab", "haryana": "Haryana",
}

WOMEN_TERMS = {
    "woman", "women", "female", "girl", "girls", "mahil", "mahila", "mahilae",
    "பெண்", "பெண்கள்", "மகளிர்", "महिला", "महिलाएं", "ladies", "lady"
}


def infer_state(raw_query: str) -> str | None:
    text = re.sub(r"[\\p{P}]+", " ", raw_query.lower()) if False else raw_query.lower()
    text = re.sub(r"[^\w\s\u0900-\u097f\u0b80-\u0bff]", " ", text)
    text = " ".join(text.split())
    for alias, canonical in STATE_ALIASES.items():
        if re.search(rf"(^|\\s){re.escape(alias.lower())}(\\s|$)", text):
            return canonical
    return None


def infer_category(raw_query: str) -> str | None:
    tokens = set(re.findall(r"[\w\u0900-\u097f\u0b80-\u0bff]+", raw_query.lower()))
    if tokens & WOMEN_TERMS:
        return "women"
    return None
