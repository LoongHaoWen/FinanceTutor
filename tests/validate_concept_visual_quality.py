from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP_JS = ROOT / "static" / "app.js"
CSS = ROOT / "static" / "styles.css"


def test_concept_visual_uses_professional_knowledge_map():
    app_js = APP_JS.read_text(encoding="utf-8")
    block = app_js.split("function renderConceptVisual()", 1)[1].split("function renderGeneratedVisual()", 1)[0]
    assert "concept-map" in block
    assert "核心议题" in block
    assert "关键变量" in block
    assert "分析工具" in block
    assert "现实场景" in block
    assert "风险边界" in block
    for outdated_label in ["勇者", "通关", ">定义<", ">关系<", ">模型<", ">练习<", "用概念、模型、例子击破"]:
        assert outdated_label not in block


def test_concept_map_has_dedicated_styles():
    css = CSS.read_text(encoding="utf-8")
    assert ".concept-map" in css
    assert ".map-node" in css
    assert ".map-layers" in css
