from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
CSS = ROOT / "static" / "styles.css"


def test_hero_decoration_does_not_block_action_buttons():
    css = CSS.read_text(encoding="utf-8")
    assert ".hero::before" in css
    before_block = css.split(".hero::before", 1)[1].split("}", 1)[0]
    assert "pointer-events: none" in before_block
    match = re.search(r"\.hero-actions\s*\{(?P<body>[^}]+)\}", css)
    assert match
    actions_block = match.group("body")
    assert "z-index" in actions_block
