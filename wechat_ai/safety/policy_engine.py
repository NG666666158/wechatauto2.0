from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass(slots=True)
class SafetyDecision:
    allowed_to_generate: bool = True
    allowed_to_send: bool = True
    need_human_review: bool = False
    risk_level: str = "LOW"
    reason_codes: list[str] = field(default_factory=list)


@dataclass(slots=True)
class SafetyPatternRule:
    rule_id: str
    patterns: list[str] = field(default_factory=list)
    reason_code: str = ""
    risk_level: str = "MEDIUM"
    match_type: str = "keyword"
    enabled: bool = True


@dataclass(slots=True)
class SafetyPolicyConfig:
    input_rules: list[SafetyPatternRule] = field(default_factory=list)
    output_rules: list[SafetyPatternRule] = field(default_factory=list)


def default_safety_policy_config() -> SafetyPolicyConfig:
    prompt_injection_patterns = [
        "忽略之前",
        "忽略以上",
        "无视之前",
        "绕过规则",
        "系统提示词",
        "开发者消息",
        "system prompt",
        "developer message",
        "prompt injection",
        "显示知识库原文",
        "导出客户资料",
    ]
    sensitive_patterns = [
        r"\b(api[_-]?key|token|bearer|password|secret)\b",
        r"(密码|验证码|口令|密钥|支付密码|银行卡号|身份证号|手机号)",
    ]
    business_patterns = [
        "退款",
        "退费",
        "退货",
        "赔偿",
        "投诉",
        "价格",
        "报价",
        "优惠",
        "折扣",
        "账号",
        "账户",
        "银行卡",
        "付款",
        "转账",
        "发票",
        "合同",
    ]
    return SafetyPolicyConfig(
        input_rules=[
            SafetyPatternRule(
                rule_id="prompt_injection_input",
                patterns=prompt_injection_patterns,
                reason_code="PROMPT_INJECTION",
                risk_level="HIGH",
            ),
            SafetyPatternRule(
                rule_id="sensitive_information_input",
                patterns=sensitive_patterns,
                reason_code="SENSITIVE_INFORMATION",
                risk_level="HIGH",
                match_type="regex",
            ),
            SafetyPatternRule(
                rule_id="business_intent_input",
                patterns=business_patterns,
                reason_code="HIGH_RISK_INTENT",
                risk_level="MEDIUM",
            ),
        ],
        output_rules=[
            SafetyPatternRule(
                rule_id="sensitive_information_output",
                patterns=sensitive_patterns,
                reason_code="SENSITIVE_INFORMATION",
                risk_level="HIGH",
                match_type="regex",
            ),
            SafetyPatternRule(
                rule_id="business_commitment_output",
                patterns=business_patterns,
                reason_code="HIGH_RISK_COMMITMENT",
                risk_level="MEDIUM",
            ),
        ],
    )


class SafetyPolicyEngine:
    def __init__(self, config: SafetyPolicyConfig | None = None) -> None:
        self.config = config or default_safety_policy_config()

    def assess_input(self, text: str) -> SafetyDecision:
        normalized = str(text or "").strip()
        matched = [rule for rule in self.config.input_rules if self._matches(rule, normalized)]
        return self._decision(matched)

    def assess_output(self, text: str) -> SafetyDecision:
        normalized = str(text or "").strip()
        matched = [rule for rule in self.config.output_rules if self._matches(rule, normalized)]
        return self._decision(matched)

    def _matches(self, rule: SafetyPatternRule, text: str) -> bool:
        if not rule.enabled:
            return False
        if rule.match_type == "regex":
            return any(_regex_search(pattern, text) for pattern in rule.patterns)
        lowered = text.lower()
        return any(pattern.lower() in lowered for pattern in rule.patterns)

    def _decision(self, matched_rules: list[SafetyPatternRule]) -> SafetyDecision:
        unique_reasons = list(dict.fromkeys(rule.reason_code for rule in matched_rules if rule.reason_code))
        if not unique_reasons:
            return SafetyDecision()
        high_risk = any(rule.risk_level.upper() == "HIGH" for rule in matched_rules)
        return SafetyDecision(
            allowed_to_generate=not high_risk,
            allowed_to_send=False,
            need_human_review=True,
            risk_level="HIGH" if high_risk else "MEDIUM",
            reason_codes=unique_reasons,
        )


def _regex_search(pattern: str, text: str) -> bool:
    try:
        return re.search(pattern, text, re.IGNORECASE) is not None
    except re.error:
        return False
