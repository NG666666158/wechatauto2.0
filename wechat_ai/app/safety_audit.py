from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any, Mapping


@dataclass(slots=True)
class SafetyPolicyAuditRecord:
    timestamp: str
    action: str
    changed_rule_groups: dict[str, bool] = field(default_factory=dict)
    reset_to_defaults: bool = False
    operator: str = "system"
    source: str = "service"


class SafetyPolicyAuditTrail:
    def __init__(self, path: Path) -> None:
        self.path = Path(path)

    def append_from_patch(
        self,
        patch: Mapping[str, object],
        *,
        operator: str = "system",
        source: str = "service",
    ) -> SafetyPolicyAuditRecord | None:
        safety_policy = patch.get("safety_policy")
        if not isinstance(safety_policy, Mapping):
            return None
        changed_rule_groups = _bool_mapping(safety_policy.get("rule_groups"))
        reset_to_defaults = bool(safety_policy.get("reset_to_defaults", False))
        action = "reset_to_defaults" if reset_to_defaults else "rule_groups_updated"
        if not changed_rule_groups and not reset_to_defaults:
            action = "policy_updated"
        record = SafetyPolicyAuditRecord(
            timestamp=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            action=action,
            changed_rule_groups=changed_rule_groups,
            reset_to_defaults=reset_to_defaults,
            operator=_clean_label(operator, default="system"),
            source=_clean_label(source, default="service"),
        )
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(asdict(record), ensure_ascii=False, separators=(",", ":")) + "\n")
        return record

    def list_recent(self, *, limit: int = 20) -> list[dict[str, Any]]:
        if not self.path.exists():
            return []
        limit = max(1, min(int(limit), 100))
        records: list[dict[str, Any]] = []
        with self.path.open("r", encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                try:
                    payload = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if isinstance(payload, dict):
                    records.append(_normalize_record(payload))
        return list(reversed(records[-limit:]))


def _bool_mapping(value: object) -> dict[str, bool]:
    if not isinstance(value, Mapping):
        return {}
    result: dict[str, bool] = {}
    for key, enabled in value.items():
        group = str(key).strip()
        if group:
            result[group] = bool(enabled)
    return result


def _clean_label(value: object, *, default: str) -> str:
    label = str(value or "").strip()
    return label[:128] if label else default


def _normalize_record(payload: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "timestamp": str(payload.get("timestamp", "")),
        "action": str(payload.get("action", "")),
        "changed_rule_groups": _bool_mapping(payload.get("changed_rule_groups")),
        "reset_to_defaults": bool(payload.get("reset_to_defaults", False)),
        "operator": _clean_label(payload.get("operator"), default="system"),
        "source": _clean_label(payload.get("source"), default="service"),
    }
