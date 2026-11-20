"""Structured logging with redaction: Aadhaar, PAN, phone numbers, bearer/JWT tokens and API keys never reach logs."""
import logging
import re

PATTERNS = [
    (re.compile(r"AIza[\w-]{8,}"), "[GOOGLE_API_KEY]"),
    (re.compile(r"sk-[\w-]{16,}"), "[API_KEY]"),
    (re.compile(r"(?<![+\d])[2-9]\d{3}\s?\d{4}\s?\d{4}(?!\d)"), "[AADHAAR]"),
    (re.compile(r"\b[A-Z]{5}\d{4}[A-Z]\b"), "[PAN]"),
    (re.compile(r"\+91[\s-]?[6-9]\d{9}\b|\b[6-9]\d{9}\b"), "[PHONE]"),
    (re.compile(r"eyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}"), "[JWT]"),
    (re.compile(r"(?i)(bearer\s+)[\w.-]+"), r"\1[TOKEN]"),
    (re.compile(r"(?i)(api[_-]?key|apikey|secret|password|token)(\W{0,3})[\w.-]{6,}"), r"\1\2[REDACTED]"),
]


def redact(text: str) -> str:
    for rx, rep in PATTERNS:
        text = rx.sub(rep, text)
    return text


class RedactFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.msg = redact(record.getMessage()); record.args = ()
        return True


def setup(level=logging.INFO):
    # a log line emitted after its stream is closed (e.g. at interpreter exit) must not print a traceback
    logging.raiseExceptions = False
    h = logging.StreamHandler()
    h.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
    h.addFilter(RedactFilter())
    root = logging.getLogger(); root.handlers = [h]; root.setLevel(level)
    for noisy in ("httpx", "httpcore", "chromadb", "urllib3"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
