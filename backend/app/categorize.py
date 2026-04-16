from __future__ import annotations

import json
import os
from typing import Any

from openai import OpenAI

DEFAULT_SEVERITY = "non_critical"


def _strip_markdown_fences(text: str) -> str:
    t = text.strip()
    if not t.startswith("```"):
        return t
    lines = t.split("\n")
    if lines and lines[0].startswith("```"):
        lines = lines[1:]
    if lines and lines[-1].strip() == "```":
        lines = lines[:-1]
    return "\n".join(lines).strip()


def _first_balanced_json_object(text: str) -> str | None:
    i = text.find("{")
    if i < 0:
        return None
    depth = 0
    for j in range(i, len(text)):
        c = text[j]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return text[i : j + 1]
    return None


def _parse_json_loose(text: str) -> dict[str, Any] | None:
    """Parse model JSON; tolerate markdown fences or extra prose around a single object."""
    if not text:
        return None
    t0 = text.strip()
    candidates = [t0, _strip_markdown_fences(t0)]
    jo = _first_balanced_json_object(t0)
    if jo:
        candidates.append(jo)
    seen: set[str] = set()
    for cand in candidates:
        if not cand or cand in seen:
            continue
        seen.add(cand)
        try:
            data = json.loads(cand)
            if isinstance(data, dict):
                return data
        except Exception:
            continue
    return None


def _client() -> OpenAI | None:
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        return None
    return OpenAI(api_key=key)


def pick_category_and_severity(
    *,
    model: str,
    categories: list[dict[str, Any]],
    uncategorised_category_id: str,
    email: dict[str, Any],
) -> tuple[str, str]:
    """
    Returns (category_id, severity) where severity is "critical" or "non_critical".
    Critical = explicit urgency, time pressure, or high business impact; otherwise non-critical.
    If the model or parsing fails, returns (uncategorised_category_id, non_critical).
    """
    client = _client()
    if client is None:
        return uncategorised_category_id, DEFAULT_SEVERITY

    cat_lines = []
    for c in categories:
        cat_lines.append(
            f"- id={c['id']} name={c.get('name','')} description={c.get('description','') or ''}"
        )
    categories_text = "\n".join(cat_lines)

    prompt = {
        "categories": categories,
        "email": {
            "from": email.get("from", ""),
            "to": email.get("to", ""),
            "subject": email.get("subject", ""),
            "date": email.get("date", ""),
            "body": (email.get("body", "") or "")[:8000],
        },
        "uncategorised_category_id": uncategorised_category_id,
    }

    instructions = (
        "You are categorizing emails into exactly one category and estimating severity.\n"
        "Pick the single best category_id from the list. If none match, use uncategorised_category_id.\n\n"
        "Severity (apply the same rules in any language — Danish, English, etc.):\n"
        '- Use "critical" when ANY of these apply: production/outage/security incident; legal, compliance, or '
        "contractual deadline; explicit escalation or \"needs immediate attention\"; the sender clearly demands "
        "a fast or immediate response (ASAP, today, within hours, \"reply urgently\", \"super hurtigt\", "
        "\"meget vigtig\" / \"MEGET VIGTIGT\" used as real urgency, not marketing fluff); repeated strong "
        "emphasis that a timely response is required; time-sensitive business risk.\n"
        '- Use "non_critical" for routine mail, FYI, newsletters, no deadline, generic politeness, or mild '
        "importance without time pressure.\n"
        "When in doubt between the two: if the sender stresses urgency or response speed, prefer \"critical\".\n\n"
        "Return STRICT JSON with exactly these keys: "
        '{"category_id":"<id>","severity":"critical"|"non_critical"}\n'
        "severity must be exactly the string critical or non_critical."
    )

    resp = client.responses.create(
        model=model,
        instructions=instructions,
        input=(
            "Available categories:\n"
            f"{categories_text}\n\n"
            "Classify the email below. Judge severity from subject + body (any language).\n\n"
            "Email:\n"
            f"{json.dumps(prompt['email'], ensure_ascii=False)}\n\n"
            f"uncategorised_category_id: {uncategorised_category_id}\n"
        ),
    )

    data = _parse_json_loose((resp.output_text or "").strip())
    if data is None:
        return uncategorised_category_id, DEFAULT_SEVERITY

    cid = str(data.get("category_id", "")).strip()
    if not cid:
        return uncategorised_category_id, DEFAULT_SEVERITY
    allowed = {c["id"] for c in categories} | {uncategorised_category_id}
    cid = cid if cid in allowed else uncategorised_category_id

    raw_sev = str(data.get("severity", "")).strip().lower().replace("-", "_")
    if raw_sev == "critical":
        sev = "critical"
    elif raw_sev in ("non_critical", "noncritical"):
        sev = "non_critical"
    else:
        sev = "non_critical"

    return cid, sev
