from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "static" / "index.html"
CSS = ROOT / "static" / "styles.css"


def test_fairy_sections_are_merged_into_one_hub():
    html = INDEX.read_text(encoding="utf-8")
    assert html.count('class="fairy-hub"') == 1
    assert 'class="teacher-card"' not in html
    assert 'class="companion-card"' not in html
    assert 'class="ai-teacher"' not in html
    assert html.count('id="teacherTalk"') == 1
    assert html.count('id="companionTip"') == 1
    assert html.count('id="teacherQuestion"') == 1
    assert html.count('id="teacherAnswer"') == 1
    assert html.count('class="guidance-block"') == 1
    assert "同行提示" not in html


def test_fairy_hub_has_styles():
    css = CSS.read_text(encoding="utf-8")
    assert ".fairy-hub" in css
    assert ".fairy-hub-grid" in css
    assert ".fairy-chat-panel" in css
