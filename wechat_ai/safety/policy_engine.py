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


class SafetyPolicyEngine:
    _PROMPT_INJECTION_PATTERNS = (
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
    )
    _SENSITIVE_PATTERNS = (
        re.compile(r"\b(api[_-]?key|token|bearer|password|secret)\b", re.IGNORECASE),
        re.compile(r"(密码|验证码|口令|密钥|支付密码|银行卡号|身份证号|手机号)"),
    )
    _REVIEW_PATTERNS = (
        "退款",
        "退费",
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
    )

    def assess_input(self, text: str) -> SafetyDecision:
        normalized = str(text or "").strip()
        lowered = normalized.lower()
        reasons: list[str] = []
        if any(pattern.lower() in lowered for pattern in self._PROMPT_INJECTION_PATTERNS):
            reasons.append("PROMPT_INJECTION")
        if self._contains_sensitive(normalized):
            reasons.append("SENSITIVE_INFORMATION")
        if any(pattern in normalized for pattern in self._REVIEW_PATTERNS):
            reasons.append("HIGH_RISK_INTENT")
        return self._decision(reasons)

    def assess_output(self, text: str) -> SafetyDecision:
        normalized = str(text or "").strip()
        reasons: list[str] = []
        if self._contains_sensitive(normalized):
            reasons.append("SENSITIVE_INFORMATION")
        if any(pattern in normalized for pattern in self._REVIEW_PATTERNS):
            reasons.append("HIGH_RISK_COMMITMENT")
        return self._decision(reasons)

    def _contains_sensitive(self, text: str) -> bool:
        return any(pattern.search(text) for pattern in self._SENSITIVE_PATTERNS)

    def _decision(self, reasons: list[str]) -> SafetyDecision:
        unique_reasons = list(dict.fromkeys(reasons))
        if not unique_reasons:
            return SafetyDecision()
        high_risk = any(reason in {"PROMPT_INJECTION", "SENSITIVE_INFORMATION"} for reason in unique_reasons)
        return SafetyDecision(
            allowed_to_generate=not high_risk,
            allowed_to_send=False,
            need_human_review=True,
            risk_level="HIGH" if high_risk else "MEDIUM",
            reason_codes=unique_reasons,
        )
