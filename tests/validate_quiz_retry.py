from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP_JS = ROOT / "static" / "app.js"
CSS = ROOT / "static" / "styles.css"


def test_wrong_answers_can_be_retried_with_shuffled_choices():
    app_js = APP_JS.read_text(encoding="utf-8")
    assert "function shuffleChoices" in app_js
    assert "function getDisplayChoices" in app_js
    assert "retry-quiz-btn" in app_js
    assert "重新回答" in app_js
    assert "delete state.progress.quiz[lesson.id][challenge.difficulty]" in app_js


def test_retry_button_has_styles():
    css = CSS.read_text(encoding="utf-8")
    assert ".retry-quiz-btn" in css
