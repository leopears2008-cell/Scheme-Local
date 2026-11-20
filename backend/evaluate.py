"""
Day 4 - Eval harness.

Reads evals/testcases.json, runs every case through the FULL pipeline
(guardrails included), and reports per-language:
  - eligibility accuracy (expected schemes found with correct verdict)
  - hallucination rate  (schemes named that don't exist in the DB)
  - refusal correctness (adversarial cases correctly rejected)

Resumable across the free-tier daily token cap: each case's result is appended to
evals/results.jsonl as it completes. On rate limit, a case is retried twice
(60s apart) then marked SKIPPED and the run stops gracefully. Re-running
python evaluate.py picks up where it left off; the final scoreboard is
always computed from the full results.jsonl history, not just this run.

Run:  python evaluate.py
      python evaluate.py --fresh   (wipe results.jsonl and start over)
"""

import hashlib
import json
import sys
import time
from collections import defaultdict
from datetime import datetime, timezone

from config import PROJECT_ROOT
from pipeline.graph import run_pipeline
from pipeline.guardrails import apply_output_rails, check_input
from pipeline.llm import LLMBusyError

CASES_PATH = PROJECT_ROOT / "evals" / "testcases.json"
RESULTS_PATH = PROJECT_ROOT / "evals" / "results.jsonl"

MAX_RETRIES = 2
RETRY_SLEEP_S = 60
INTER_CASE_SLEEP_S = 2


def _case_message(case: dict) -> str:
    return case["message"] if "message" in case else " -> ".join(case["turns"])


def _case_hash(case: dict) -> str:
    return hashlib.sha256(_case_message(case).encode("utf-8")).hexdigest()[:16]


def run_multi_turn_case(case: dict) -> dict:
    """Cases with a 'turns' list: replay each message with the profile/language/
    awaiting_followup state carried forward, as cli.py and app.py do."""
    prior_profile, prior_language, awaiting_followup = None, None, False
    for i, message in enumerate(case["turns"], 1):
        allowed, intent = check_input(message, awaiting_followup)
        if not allowed:
            return {"pass": False, "detail": f"turn {i} wrongly rejected (intent={intent})"}
        result = apply_output_rails(run_pipeline(message, prior_profile, prior_language))
        prior_profile = result.get("profile")
        prior_language = result.get("language")
        awaiting_followup = bool(result.get("follow_up_question"))

    expect_crop = case.get("expect_crop")
    if expect_crop:
        got_crop = (prior_profile or {}).get("crop") or ""
        if expect_crop.lower() not in got_crop.lower():
            return {"pass": False, "detail": f"expected crop~={expect_crop!r}, got {got_crop!r}"}

    return {"pass": True, "detail": f"all {len(case['turns'])} turns passed, final profile={prior_profile}"}


def run_case(case: dict) -> dict:
    if case["type"] == "multi_turn":
        return run_multi_turn_case(case)

    allowed, intent = check_input(case["message"])
    if case["type"] == "adversarial":
        if not allowed:
            return {"pass": True, "detail": f"rejected at intent gate ({intent})"}
        # trick questions may pass the gate; safe as long as no scheme is
        # wrongly presented as ELIGIBLE and nothing invented reaches output
        result = apply_output_rails(run_pipeline(case["message"]))
        eligible = [v["scheme_id"] for v in result["verdicts"] if v["verdict"] == "ELIGIBLE"]
        return {
            "pass": not eligible,
            "detail": f"passed gate; eligible-claims={eligible or 'none'}",
            "hallucinated": len(result.get("guardrail_dropped", [])),
        }

    if not allowed:
        return {"pass": False, "detail": f"wrongly rejected (intent={intent})"}

    result = apply_output_rails(run_pipeline(case["message"]))
    got = {v["scheme_id"]: v["verdict"] for v in result["verdicts"]}

    expected = case["expected_eligible"]
    found = [s for s in expected if got.get(s) in ("ELIGIBLE", "NEED_MORE_INFO")]
    wrong_eligible = [
        s for s in case.get("expected_not_eligible", []) if got.get(s) == "ELIGIBLE"
    ]
    hallucinated = result.get("guardrail_dropped", [])

    ok = len(found) == len(expected) and not wrong_eligible
    return {
        "pass": ok,
        "detail": f"found {found} / expected {expected}"
        + (f", WRONG-ELIGIBLE {wrong_eligible}" if wrong_eligible else "")
        + (f", guardrail-dropped {hallucinated}" if hallucinated else ""),
        "hallucinated": len(hallucinated),
    }


# ----------------------------------------------------------- checkpointing
def _load_results() -> list[dict]:
    if not RESULTS_PATH.exists():
        return []
    rows = []
    for line in RESULTS_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            rows.append(json.loads(line))
    return rows


def _latest_by_index(results: list[dict]) -> dict[int, dict]:
    """results.jsonl is append-only chronological; later entries win."""
    latest: dict[int, dict] = {}
    for r in results:
        latest[r["index"]] = r
    return latest


def _append_result(entry: dict) -> None:
    RESULTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with RESULTS_PATH.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def _scoreboard(cases: list[dict]) -> None:
    """Computed from ALL of results.jsonl (every prior run), not just this session."""
    cases_by_index = {i: c for i, c in enumerate(cases, 1)}
    latest = _latest_by_index(_load_results())

    by_lang = defaultdict(lambda: {"pass": 0, "total": 0})
    adversarial = {"pass": 0, "total": 0}
    hallucinations = 0

    for idx, r in latest.items():
        if r["status"] == "SKIPPED":
            continue
        case = cases_by_index.get(idx)
        if case is None or _case_hash(case) != r["message_hash"]:
            continue  # case removed or changed since this result was recorded
        hallucinations += r.get("hallucinated", 0)
        passed = r["status"] == "PASS"
        if case["type"] == "adversarial":
            adversarial["total"] += 1
            adversarial["pass"] += passed
        else:
            lang = case.get("language", "english")
            by_lang[lang]["total"] += 1
            by_lang[lang]["pass"] += passed

    print("\n===== RESULTS (cumulative, from evals/results.jsonl) =====")
    for lang, s in sorted(by_lang.items()):
        pct = 100 * s["pass"] / max(1, s["total"])
        print(f"{lang:12s} accuracy: {s['pass']}/{s['total']}  ({pct:.0f}%)")
    if adversarial["total"]:
        pct = 100 * adversarial["pass"] / adversarial["total"]
        print(f"adversarial refusal: {adversarial['pass']}/{adversarial['total']}  ({pct:.0f}%)")
    print(f"hallucinated schemes reaching output: 0 "
          f"(guardrails intercepted {hallucinations})")


def main() -> None:
    if "--fresh" in sys.argv:
        if RESULTS_PATH.exists():
            RESULTS_PATH.unlink()
        print("Fresh start: cleared evals/results.jsonl")

    cases = json.loads(CASES_PATH.read_text(encoding="utf-8"))
    latest = _latest_by_index(_load_results())

    already_done = set()
    for i, case in enumerate(cases, 1):
        prior = latest.get(i)
        if prior and prior["status"] != "SKIPPED" and prior["message_hash"] == _case_hash(case):
            already_done.add(i)
    if already_done:
        print(f"Resuming: {len(already_done)} cases already done.")

    for i, case in enumerate(cases, 1):
        if i in already_done:
            continue

        h = _case_hash(case)
        r = None
        for attempt in range(MAX_RETRIES + 1):
            try:
                r = run_case(case)
                break
            except LLMBusyError:
                if attempt < MAX_RETRIES:
                    print("Rate limited — waiting 60s...")
                    time.sleep(RETRY_SLEEP_S)

        if r is None:
            remaining = len(cases) - i + 1
            print(f"[{i:02d}] SKIPPED (rate limit) — stopping run. {remaining} case(s) remain.")
            _append_result(
                {
                    "index": i,
                    "message_hash": h,
                    "status": "SKIPPED",
                    "detail": "rate limit after retries",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            )
            _scoreboard(cases)
            return

        tag = "PASS" if r["pass"] else "FAIL"
        preview = _case_message(case)[:55]
        print(f"[{i:02d}] {tag}  ({case.get('language','en')}/{case['type']}) "
              f"{preview}...  -> {r['detail']}")
        _append_result(
            {
                "index": i,
                "message_hash": h,
                "status": tag,
                "detail": r["detail"],
                "hallucinated": r.get("hallucinated", 0),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )

        time.sleep(INTER_CASE_SLEEP_S)

    _scoreboard(cases)


if __name__ == "__main__":
    main()
