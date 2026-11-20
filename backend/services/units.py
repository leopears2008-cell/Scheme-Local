"""Shared parsing for money and land. Used by eligibility AND by answer grounding, so both agree.

Rules (deliberately strict):
  * Money: '₹1,000', '2,50,000', '2.5 lakh', '1.2 crore', '3k', plain numbers. Anything unclear returns None.
  * Land: a unit is REQUIRED. 'acre(s)' converts at 1 acre = 0.404686 ha. 'ha'/'hectare(s)' are used as-is.
    A bare number with no unit returns None so the caller reports 'unknown' and asks the user to state the unit.
"""
import re

ACRE_TO_HA = 0.404686
_MONEY_UNITS = {"lakh": 100_000, "lakhs": 100_000, "lac": 100_000, "lacs": 100_000,
                "crore": 10_000_000, "crores": 10_000_000, "k": 1_000}
_MONEY_RX = re.compile(r"(?:₹|rs\.?|inr)?\s*([\d][\d,]*(?:\.\d+)?|\.\d+)\s*(lakhs?|lacs?|crores?|k)?\b", re.I)
_LAND_RX = re.compile(r"^\s*([\d]+(?:\.\d+)?|\.\d+)\s*(acres?|acre|ha|hectares?|hectare)?\s*$", re.I)


def parse_money(x) -> float | None:
    """Single rupee amount, or None when it is not clearly a number."""
    if x is None or isinstance(x, bool):
        return None
    if isinstance(x, (int, float)):
        return float(x)
    t = str(x).strip().lower()
    m = re.fullmatch(r"(?:₹|rs\.?|inr)?\s*([\d][\d,]*(?:\.\d+)?|\.\d+)\s*(lakhs?|lacs?|crores?|k)?", t)
    if not m:
        return None
    try:
        base = float(m.group(1).replace(",", ""))
    except ValueError:
        return None
    return base * _MONEY_UNITS.get(m.group(2) or "", 1)


def extract_money(text: str) -> list[float]:
    """Every rupee-like amount in free text, as numbers (for grounding answers against records)."""
    out = []
    for m in _MONEY_RX.finditer(text or ""):
        num, unit = m.group(1), (m.group(2) or "").lower()
        if not num or num.startswith(".") and not unit:
            continue
        try:
            out.append(float(num.replace(",", "")) * _MONEY_UNITS.get(unit, 1))
        except ValueError:
            continue
    return out


def parse_land_hectares(x, unit_hint: str | None = None) -> tuple[float | None, str]:
    """Returns (hectares or None, note). The note always says what was assumed or why it is unknown."""
    if x is None or isinstance(x, bool):
        return None, "no land value given"
    if isinstance(x, (int, float)):
        if unit_hint:
            return _to_ha(float(x), unit_hint), f"converted from {unit_hint}"
        return None, "land unit missing: say whether this is acres or hectares"
    t = str(x).strip()
    m = _LAND_RX.match(t)
    if not m:
        return None, "land value not understood"
    value = float(m.group(1))
    unit = (m.group(2) or "").lower()
    if not unit:
        if unit_hint:
            return _to_ha(value, unit_hint), f"converted from {unit_hint}"
        return None, "land unit missing: say whether this is acres or hectares"
    if unit.startswith("acre"):
        return value * ACRE_TO_HA, f"{value:g} acre(s) = {value * ACRE_TO_HA:.3f} ha"
    return value, f"{value:g} ha"


def _to_ha(value: float, unit: str) -> float | None:
    u = unit.lower()
    if u.startswith("acre"):
        return value * ACRE_TO_HA
    if u in ("ha", "hectare", "hectares"):
        return value
    return None
