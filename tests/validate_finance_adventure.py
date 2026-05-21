from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CURRICULUM = ROOT / "data" / "finance_curriculum.json"
APP_JS = ROOT / "static" / "app.js"


def test_curriculum_has_30_lessons_with_challenge_ladder():
    data = json.loads(CURRICULUM.read_text(encoding="utf-8"))
    lessons = data["lessons"]
    assert len(lessons) == 30

    expected = ["easy", "normal", "hard", "extreme"]
    expected_xp = {"easy": 20, "normal": 35, "hard": 55, "extreme": 90}

    for index, lesson in enumerate(lessons, start=1):
        assert lesson["title"].startswith(f"第 {index} 课：")
        challenges = lesson.get("challenges")
        assert [item["difficulty"] for item in challenges] == expected
        for challenge in challenges:
            assert challenge["xp"] == expected_xp[challenge["difficulty"]]
            assert challenge["question"]
            assert len(challenge["choices"]) >= 2
            assert challenge["answer"] in challenge["choices"]
            assert challenge["explain"]

        case_study = lesson.get("caseStudy")
        assert case_study and case_study["prompt"] and case_study["answer"]
        assert "场景：" in case_study["answer"]
        assert "分析：" in case_study["answer"]
        assert "边界：" in case_study["answer"]
        assert "标准答案示例：先用一句话说明" not in case_study["answer"]


def test_first_ten_lesson_visuals_are_bundled_assets():
    data = json.loads(CURRICULUM.read_text(encoding="utf-8"))
    first_ten_lessons = data["lessons"][:10]
    assert len(first_ten_lessons) == 10
    for lesson in first_ten_lessons:
        assert lesson["defaultVisual"].startswith("assets/lesson_visuals/")


def test_teacher_output_is_cleaned_for_readability():
    app_js = APP_JS.read_text(encoding="utf-8")
    assert "function cleanTeacherText" in app_js
    assert "payload.answer ||" not in app_js
