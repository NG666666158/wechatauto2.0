from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path
from typing import Any, Mapping

from wechat_ai.safety import SafetyPatternRule, SafetyPolicyConfig, default_safety_policy_config, set_rule_group_enabled

from .embedding_config import DesktopEmbeddingConfig
from .model_config import DesktopModelConfig
from .models import PrivacyPolicy, ScheduleBlock, SettingsSnapshot, WorkHours


class DesktopSettingsStore:
    def __init__(self, path: Path) -> None:
        self.path = Path(path)

    def load(self) -> SettingsSnapshot:
        if not self.path.exists():
            return SettingsSnapshot()
        with self.path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
        return self._deserialize(payload if isinstance(payload, dict) else {})

    def update(self, patch: Mapping[str, object]) -> SettingsSnapshot:
        current = self.load()
        updated = self._apply_patch(current, patch)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("w", encoding="utf-8") as handle:
            json.dump(self._serialize(updated), handle, ensure_ascii=False, indent=2)
        return updated

    def _serialize(self, settings: SettingsSnapshot) -> dict[str, Any]:
        payload = asdict(settings)
        payload["model_config"] = settings.model_config.to_storage_dict()
        payload["embedding_config"] = settings.embedding_config.to_storage_dict()
        return payload

    def _deserialize(self, payload: Mapping[str, Any]) -> SettingsSnapshot:
        work_hours_payload = payload.get("work_hours", {})
        if not isinstance(work_hours_payload, Mapping):
            work_hours_payload = {}
        schedule_blocks_payload = payload.get("schedule_blocks", [])
        if not isinstance(schedule_blocks_payload, list):
            schedule_blocks_payload = []
        privacy_payload = payload.get("privacy", {})
        if not isinstance(privacy_payload, Mapping):
            privacy_payload = {}
        safety_policy_payload = payload.get("safety_policy", {})
        if not isinstance(safety_policy_payload, Mapping):
            safety_policy_payload = {}
        embedding_config_payload = payload.get("embedding_config", {})
        if not isinstance(embedding_config_payload, Mapping):
            embedding_config_payload = {}
        model_config_payload = payload.get("model_config", {})
        if not isinstance(model_config_payload, Mapping):
            model_config_payload = {}
        return SettingsSnapshot(
            auto_reply_enabled=bool(payload.get("auto_reply_enabled", True)),
            reply_style=str(payload.get("reply_style", "自然友好")),
            new_customer_auto_create=bool(payload.get("new_customer_auto_create", True)),
            sensitive_message_review=bool(payload.get("sensitive_message_review", True)),
            work_hours=WorkHours(
                enabled=bool(work_hours_payload.get("enabled", True)),
                start_day=str(work_hours_payload.get("start_day", "mon")).strip() or "mon",
                end_day=str(work_hours_payload.get("end_day", "fri")).strip() or "fri",
                start=str(work_hours_payload.get("start", "09:00")),
                end=str(work_hours_payload.get("end", "18:00")),
            ),
            knowledge_chunk_size=int(payload.get("knowledge_chunk_size", 1000)),
            knowledge_chunk_overlap=int(payload.get("knowledge_chunk_overlap", 200)),
            run_silently=bool(payload.get("run_silently", True)),
            esc_action=str(payload.get("esc_action", "pause")),
            force_stop_hotkey=str(payload.get("force_stop_hotkey", "ctrl+shift+f12")).strip() or "ctrl+shift+f12",
            schedule_enabled=bool(payload.get("schedule_enabled", False)),
            schedule_blocks=[
                ScheduleBlock(
                    day_of_week=str(item.get("day_of_week", "")),
                    start=str(item.get("start", "09:00")),
                    end=str(item.get("end", "18:00")),
                    label=str(item.get("label", "")),
                    enabled=bool(item.get("enabled", True)),
                )
                for item in schedule_blocks_payload
                if isinstance(item, Mapping)
            ],
            privacy=PrivacyPolicy(
                redact_sensitive_logs=bool(privacy_payload.get("redact_sensitive_logs", True)),
                log_retention_days=max(int(privacy_payload.get("log_retention_days", 14)), 1),
                memory_retention_days=max(int(privacy_payload.get("memory_retention_days", 90)), 1),
                max_recent_log_events=max(int(privacy_payload.get("max_recent_log_events", 100)), 1),
            ),
            human_takeover_sessions=_string_list(payload.get("human_takeover_sessions", [])),
            paused_sessions=_string_list(payload.get("paused_sessions", [])),
            whitelist=_string_list(payload.get("whitelist", [])),
            blacklist=_string_list(payload.get("blacklist", [])),
            request_timeout_seconds=max(float(payload.get("request_timeout_seconds", 30.0)), 1.0),
            retry_attempts=max(int(payload.get("retry_attempts", 2)), 0),
            real_send_enabled=bool(payload.get("real_send_enabled", False)),
            model_config=DesktopModelConfig.from_dict(model_config_payload),
            embedding_config=DesktopEmbeddingConfig.from_dict(embedding_config_payload),
            safety_policy=_safety_policy(safety_policy_payload),
        )

    def _apply_patch(self, current: SettingsSnapshot, patch: Mapping[str, object]) -> SettingsSnapshot:
        payload = asdict(current)
        for key, value in patch.items():
            if key == "work_hours" and isinstance(value, Mapping):
                merged_work_hours = dict(payload["work_hours"])
                for nested_key, nested_value in value.items():
                    if nested_key in merged_work_hours:
                        merged_work_hours[nested_key] = nested_value
                payload["work_hours"] = merged_work_hours
            elif key == "schedule_blocks" and isinstance(value, list):
                payload["schedule_blocks"] = value
            elif key == "privacy" and isinstance(value, Mapping):
                merged_privacy = dict(payload["privacy"])
                for nested_key, nested_value in value.items():
                    if nested_key in merged_privacy:
                        merged_privacy[nested_key] = nested_value
                payload["privacy"] = merged_privacy
            elif key == "safety_policy" and isinstance(value, Mapping):
                current_policy = dict(payload["safety_policy"])
                if bool(value.get("reset_to_defaults", False)):
                    payload["safety_policy"] = {"reset_to_defaults": True}
                elif (
                    "rule_groups" in value
                    and "input_rules" not in value
                    and "output_rules" not in value
                ):
                    current_policy["rule_groups"] = value.get("rule_groups")
                    current_policy["_apply_rule_groups"] = True
                    payload["safety_policy"] = current_policy
                else:
                    for nested_key, nested_value in value.items():
                        current_policy[nested_key] = nested_value
                    payload["safety_policy"] = current_policy
            elif key == "embedding_config" and isinstance(value, Mapping):
                current_config = current.embedding_config
                payload["embedding_config"] = current_config.apply_patch(value).to_storage_dict()
            elif key == "model_config" and isinstance(value, Mapping):
                current_config = current.model_config
                payload["model_config"] = current_config.apply_patch(value).to_storage_dict()
            elif key in payload:
                payload[key] = value
        return self._deserialize(payload)


def _string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def _safety_policy(payload: Mapping[str, Any]) -> SafetyPolicyConfig:
    defaults = default_safety_policy_config()
    if bool(payload.get("reset_to_defaults", False)):
        return defaults
    input_rules = _safety_rules(payload.get("input_rules"), defaults.input_rules)
    output_rules = _safety_rules(payload.get("output_rules"), defaults.output_rules)
    rule_groups_payload = payload.get("rule_groups")
    config = SafetyPolicyConfig(
        input_rules=input_rules,
        output_rules=output_rules,
        rule_groups=(
            _rule_groups(rule_groups_payload, defaults.rule_groups)
            if isinstance(rule_groups_payload, Mapping) and bool(payload.get("_apply_rule_groups", False))
            else _derived_rule_groups(input_rules + output_rules, defaults.rule_groups)
        ),
    )
    if (
        isinstance(rule_groups_payload, Mapping)
        and bool(payload.get("_apply_rule_groups", False))
    ):
        for rule_group, enabled in config.rule_groups.items():
            config = set_rule_group_enabled(config, rule_group, enabled)
    return config


def _safety_rules(value: object, defaults: list[SafetyPatternRule]) -> list[SafetyPatternRule]:
    if not isinstance(value, list):
        return defaults
    rules: list[SafetyPatternRule] = []
    defaults_by_id = {rule.rule_id: rule for rule in defaults}
    for item in value:
        if not isinstance(item, Mapping):
            continue
        rule_id = str(item.get("rule_id", "")).strip()
        if not rule_id:
            continue
        default_rule = defaults_by_id.get(rule_id)
        has_patterns = "patterns" in item
        patterns_value = item.get("patterns", default_rule.patterns if default_rule else [])
        patterns = _string_list(patterns_value)
        if not has_patterns and not patterns and default_rule:
            patterns = list(default_rule.patterns)
        rules.append(
            SafetyPatternRule(
                rule_id=rule_id,
                rule_group=str(item.get("rule_group", default_rule.rule_group if default_rule else "")),
                enabled=bool(item.get("enabled", default_rule.enabled if default_rule else True)),
                match_type=str(item.get("match_type", default_rule.match_type if default_rule else "keyword")),
                patterns=patterns,
                reason_code=str(item.get("reason_code", default_rule.reason_code if default_rule else "")),
                risk_level=str(item.get("risk_level", default_rule.risk_level if default_rule else "MEDIUM")),
            )
        )
    return rules or defaults


def _rule_groups(value: object, defaults: dict[str, bool]) -> dict[str, bool]:
    rule_groups = dict(defaults)
    if isinstance(value, Mapping):
        for key, enabled in value.items():
            group = str(key).strip()
            if group:
                rule_groups[group] = bool(enabled)
    return rule_groups


def _derived_rule_groups(rules: list[SafetyPatternRule], defaults: dict[str, bool]) -> dict[str, bool]:
    rule_groups = dict(defaults)
    grouped_rules: dict[str, list[SafetyPatternRule]] = {}
    for rule in rules:
        if rule.rule_group:
            grouped_rules.setdefault(rule.rule_group, []).append(rule)
    for group, group_rules in grouped_rules.items():
        rule_groups[group] = all(rule.enabled for rule in group_rules)
    return rule_groups
