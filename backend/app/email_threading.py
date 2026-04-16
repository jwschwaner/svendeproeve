"""Thread-level rules for categorization: only root messages use AI; replies inherit."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pymongo.collection import Collection

from app.categorize import DEFAULT_SEVERITY


def is_reply_message(email: dict[str, Any]) -> bool:
    """True if this looks like a follow-up in a thread (not the initial message)."""
    irt = email.get("in_reply_to") or []
    refs = email.get("references") or []
    return bool(irt) or bool(refs)


def inherited_thread_categorization(
    emails: Collection,
    org_id: str,
    thread_id: str,
    unc_id: str,
    *,
    exclude_email_id: Any,
) -> tuple[str, str]:
    """
    Category and severity from the earliest other message in the thread that already has a category.
    Falls back to (unc_id, non_critical) if none.
    """
    if not (thread_id or "").strip():
        return unc_id, DEFAULT_SEVERITY
    sibling = emails.find_one(
        {
            "org_id": org_id,
            "thread_id": thread_id,
            "_id": {"$ne": exclude_email_id},
            "category_id": {"$exists": True, "$ne": None},
        },
        sort=[("created_at", 1)],
    )
    if sibling and sibling.get("category_id") is not None:
        cid = str(sibling["category_id"])
        sev = sibling.get("severity") or DEFAULT_SEVERITY
        if sev not in ("critical", "non_critical"):
            sev = DEFAULT_SEVERITY
        return cid, sev
    return unc_id, DEFAULT_SEVERITY


def set_thread_categorization(
    emails: Collection,
    org_id: str,
    thread_id: str,
    email_id: Any,
    *,
    category_id: str,
    severity: str,
    now: datetime,
    model: str,
) -> None:
    """Assign category and severity to the whole thread when thread_id is known, else only this document."""
    if severity not in ("critical", "non_critical"):
        severity = DEFAULT_SEVERITY
    payload = {
        "$set": {
            "category_id": category_id,
            "severity": severity,
            "categorized_at": now,
            "categorization_model": model,
        }
    }
    tid = (thread_id or "").strip()
    if tid:
        emails.update_many({"org_id": org_id, "thread_id": tid}, payload)
    else:
        emails.update_one({"_id": email_id}, payload)
