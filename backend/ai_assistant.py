"""
AI assistant layer — uses Google Gemini to (1) answer free-text questions
about the current schedule/conflicts (the ChatBot) and (2) generate
structured platform-reassignment recommendations from the current conflict
list (the Recommendations engine).

Uses the current `google-genai` SDK (the old `google-generativeai` package
is deprecated). Requires GEMINI_API_KEY in the environment — see
backend/.env.example.
"""
import json
import os
from typing import List, Dict, Optional

from dotenv import load_dotenv
from google import genai
from google.genai import types

from models import ScheduleEntry, ConflictLogEntry

load_dotenv()

_client: Optional[genai.Client] = None


class AIAssistantError(Exception):
    """Raised for any AI-layer failure — missing key, API error, bad response."""


def get_model() -> str:
    return os.getenv("GEMINI_MODEL", "gemini-flash-latest")


def is_configured() -> bool:
    return bool(os.getenv("GEMINI_API_KEY", ""))


def _get_client() -> genai.Client:
    global _client
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        raise AIAssistantError("GEMINI_API_KEY is not set (check backend/.env)")
    if _client is None:
        _client = genai.Client(api_key=api_key)
    return _client


def _build_context(schedule: List[ScheduleEntry], conflicts: List[ConflictLogEntry]) -> str:
    """Compact text summary of current system state — kept short deliberately,
    so we're not burning tokens re-describing all 15+ schedule rows in full."""
    lines = [f"Current schedule — {len(schedule)} train visits across all stations:"]
    for e in schedule:
        flag = " [OVERRIDE]" if e.is_override else (f" [DELAYED {e.delay_minutes}m]" if e.delay_minutes else "")
        lines.append(
            f"- {e.train_id} ({e.name}, {e.type}, priority {e.priority}) at {e.station_id}: "
            f"platform {e.assigned_platform}, {e.actual_arrival}-{e.actual_departure}{flag}. Reason: {e.reason}"
        )

    if conflicts:
        lines.append(f"\n{len(conflicts)} conflict(s) detected and resolved:")
        for c in conflicts:
            lines.append(
                f"- [{c.severity.upper()}] {', '.join(c.trains_involved)} at {c.station_id} "
                f"platform {c.platform}: {c.root_cause} -> {c.resolution}"
            )
    else:
        lines.append("\nNo conflicts currently detected.")

    return "\n".join(lines)


SYSTEM_INSTRUCTION = (
    "You are the AI assistant inside TrainVision AI, a railway platform-scheduling and "
    "conflict-resolution control center for Howrah Junction (HWH), Santragachi Junction (SRC), "
    "and Kharagpur Junction (KGP). You are shown the current live schedule and any detected conflicts. "
    "Answer the controller's questions clearly and concisely, referencing specific train IDs, "
    "platforms, and times from the data given. Do not invent trains, platforms, or times that "
    "are not in the provided context."
)


def answer_query(query: str, schedule: List[ScheduleEntry], conflicts: List[ConflictLogEntry]) -> str:
    """Free-text Q&A for the ChatBot — e.g. 'why was T104 delayed?'"""
    client = _get_client()
    context = _build_context(schedule, conflicts)
    prompt = f"{context}\n\nController's question: {query}"

    try:
        response = client.models.generate_content(
            model=get_model(),
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                temperature=0.3,
                max_output_tokens=512,
            ),
        )
    except Exception as e:
        raise AIAssistantError(f"Gemini request failed: {e}")

    if not response.text:
        raise AIAssistantError("Gemini returned an empty response")
    return response.text.strip()


RECOMMENDATION_SCHEMA = {
    "type": "object",
    "properties": {
        "recommendations": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "train_id": {"type": "string"},
                    "station_id": {"type": "string"},
                    "suggestion": {"type": "string"},
                    "rationale": {"type": "string"},
                    "priority_level": {"type": "string", "enum": ["low", "medium", "high"]},
                },
                "required": ["train_id", "station_id", "suggestion", "rationale", "priority_level"],
            },
        }
    },
    "required": ["recommendations"],
}


def generate_recommendations(schedule: List[ScheduleEntry], conflicts: List[ConflictLogEntry]) -> List[Dict]:
    """Structured recommendations derived from current conflicts. Returns [] if there's
    nothing worth recommending (e.g. no conflicts) rather than forcing the model to invent some."""
    if not conflicts:
        return []

    client = _get_client()
    context = _build_context(schedule, conflicts)
    prompt = (
        f"{context}\n\n"
        "Based on the conflicts above, suggest concrete follow-up actions a controller could take "
        "(e.g. further platform reassignment, priority reordering, watch for cascading delay). "
        "One recommendation per meaningfully distinct issue — don't pad the list."
    )

    try:
        response = client.models.generate_content(
            model=get_model(),
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                temperature=0.2,
                max_output_tokens=1024,
                response_mime_type="application/json",
                response_schema=RECOMMENDATION_SCHEMA,
            ),
        )
    except Exception as e:
        raise AIAssistantError(f"Gemini request failed: {e}")

    if not response.text:
        raise AIAssistantError("Gemini returned an empty response")

    try:
        parsed = json.loads(response.text)
    except json.JSONDecodeError as e:
        raise AIAssistantError(f"Gemini returned non-JSON output: {e}")

    return parsed.get("recommendations", [])