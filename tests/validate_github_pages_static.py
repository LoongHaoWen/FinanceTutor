from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP_JS = ROOT / "static" / "app.js"
INDEX = ROOT / "static" / "index.html"
ROOT_INDEX = ROOT / "index.html"
CURRICULUM = ROOT / "data" / "finance_curriculum.json"


def test_static_app_does_not_call_python_api_routes():
    app_js = APP_JS.read_text(encoding="utf-8")
    assert 'fetch("/api/' not in app_js
    assert "CURRICULUM_URL = \"../data/finance_curriculum.json\"" in app_js
    assert "localStorage" in app_js


def test_pages_paths_are_relative_to_repository_base():
    html = INDEX.read_text(encoding="utf-8")
    assert 'href="/' not in html
    assert 'src="/' not in html

    data = json.loads(CURRICULUM.read_text(encoding="utf-8"))
    for lesson in data["lessons"]:
        visual = lesson.get("defaultVisual", "")
        assert not visual.startswith("/")


def test_root_index_forwards_github_pages_to_static_app():
    html = ROOT_INDEX.read_text(encoding="utf-8")
    assert "static/index.html" in html


def test_public_static_build_does_not_collect_api_keys():
    html = INDEX.read_text(encoding="utf-8")
    app_js = APP_JS.read_text(encoding="utf-8")
    combined = html + app_js
    assert "apiKeyInput" not in combined
    assert "visualApiKeyInput" not in combined
    assert "saveApiKeyBtn" not in combined
    assert "saveVisualKeyBtn" not in combined
