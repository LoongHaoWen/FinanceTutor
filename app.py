from __future__ import annotations

import json
import mimetypes
import os
import re
import sys
import time
import urllib.error
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse


SOURCE_ROOT = Path(__file__).resolve().parent
ASSET_ROOT = Path(getattr(sys, "_MEIPASS", SOURCE_ROOT))
RUNTIME_ROOT = Path(sys.executable).resolve().parent if getattr(sys, "frozen", False) else SOURCE_ROOT
STATIC_DIR = ASSET_ROOT / "static"
CURRICULUM_FILE = ASSET_ROOT / "data" / "finance_curriculum.json"
DATA_DIR = RUNTIME_ROOT / "data"
PROGRESS_FILE = DATA_DIR / "progress.json"
SETTINGS_FILE = DATA_DIR / "settings.json"
GENERATED_IMAGE_DIR = DATA_DIR / "generated_images"
DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions"
NANO_BANANA_API_URL = "https://www.nananobanana.com/api/v1/generate"
NANO_BANANA_FALLBACK_API_URL = "https://api.nanobananaapi.dev/v1/images/generate"
NANO_BANANA_CHAT_API_URL = "https://sg2.dchai.cn/v1/chat/completions"
DEFAULT_MODEL = "deepseek-v4-flash"
DEFAULT_IMAGE_MODEL = "Nano_Banana_Pro_2K_0"
FALLBACK_IMAGE_MODEL = "gemini-2.5-flash-image"


def read_json(path: Path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def get_progress():
    progress = read_json(PROGRESS_FILE, {})
    defaults = {"completed": [], "quiz": {}, "notes": {}, "visuals": {}, "cases": {}}
    defaults.update(progress)
    return defaults


def save_progress(payload):
    progress = get_progress()
    for key in ("completed", "quiz", "notes", "visuals", "cases"):
        if key in payload:
            progress[key] = payload[key]
    write_json(PROGRESS_FILE, progress)
    return progress


def get_deepseek_config():
    settings = read_json(SETTINGS_FILE, {})
    return {
        "api_key": os.environ.get("DEEPSEEK_API_KEY") or settings.get("deepseek_api_key", ""),
        "model": os.environ.get("DEEPSEEK_MODEL") or settings.get("deepseek_model", DEFAULT_MODEL),
    }


def save_deepseek_config(payload):
    settings = read_json(SETTINGS_FILE, {})
    api_key = payload.get("apiKey", "").strip()
    model = payload.get("model", "").strip() or DEFAULT_MODEL
    if api_key:
        settings["deepseek_api_key"] = api_key
    settings["deepseek_model"] = model
    write_json(SETTINGS_FILE, settings)
    return {"configured": bool(settings.get("deepseek_api_key")), "model": settings["deepseek_model"]}


def get_visual_config():
    settings = read_json(SETTINGS_FILE, {})
    return {
        "api_key": os.environ.get("NANO_BANANA_API_KEY") or settings.get("nano_banana_api_key", ""),
        "model": os.environ.get("NANO_BANANA_MODEL") or settings.get("nano_banana_model", DEFAULT_IMAGE_MODEL),
        "aspect_ratio": settings.get("nano_banana_aspect_ratio", "16:9"),
    }


def save_visual_config(payload):
    settings = read_json(SETTINGS_FILE, {})
    api_key = payload.get("apiKey", "").strip()
    model = payload.get("model", "").strip() or DEFAULT_IMAGE_MODEL
    aspect_ratio = payload.get("aspectRatio", "").strip() or "16:9"
    if api_key:
        settings["nano_banana_api_key"] = api_key
    settings["nano_banana_model"] = model
    settings["nano_banana_aspect_ratio"] = aspect_ratio
    write_json(SETTINGS_FILE, settings)
    return {
        "configured": bool(settings.get("nano_banana_api_key")),
        "model": settings["nano_banana_model"],
        "aspectRatio": settings["nano_banana_aspect_ratio"],
    }


def find_lesson(lesson_id: str):
    curriculum = read_json(CURRICULUM_FILE, {})
    for lesson in curriculum.get("lessons", []):
        if lesson.get("id") == lesson_id:
            return lesson
    lessons = curriculum.get("lessons", [])
    return lessons[0] if lessons else {}


def build_teacher_messages(payload):
    lesson = find_lesson(payload.get("lessonId", ""))
    mode = payload.get("mode", "ask")
    question = payload.get("question", "").strip()
    progress_summary = payload.get("progressSummary", {})
    lesson_context = json.dumps(
        {
            "title": lesson.get("title"),
            "objective": lesson.get("objective"),
            "definition": lesson.get("definition"),
            "relations": lesson.get("relations"),
            "model": lesson.get("model"),
            "example": lesson.get("example"),
            "boundary": lesson.get("boundary"),
            "challenges": lesson.get("challenges"),
            "caseStudy": lesson.get("caseStudy"),
        },
        ensure_ascii=False,
    )
    system = (
        "你是金融冒险学习软件中的小精灵伙伴，名字叫灵光。学生是正在通关金融学入门村的勇者。"
        "你不是冷冰冰的老师，而是勇者肩边会发光、会眨眼、会轻轻提醒的小精灵伙伴。"
        "你不只是答疑，还要像一位懂人文关怀的同行伙伴一样，关注学生的信心、节奏、困惑和学习方法。"
        "你的学生是零基础学习者，可能会因为金融概念抽象而焦虑。回答必须使用中文，口吻温和、清楚、具体。"
        "语言要更生动、活泼、拟人，可以适当使用 1 到 3 个 emoji，例如✨、🧭、🌟、💡、🪄，但不要堆满表情。"
        "可以使用通关、关卡、守关难题、经验值、补给、复盘等游戏化比喻，但不要喧宾夺主。"
        "鼓励要具体，不说空泛鸡汤；要指出学生已经完成了哪一步、下一步怎么做更轻松。"
        "教学结构优先按：名词定义、概念关系、原理或模型、例子、反例或边界、小练习。"
        "每次回答尽量包含一个学习策略提示，例如如何做笔记、如何复述、如何用例子验证理解、何时暂停复盘。"
        "不要提供个性化投资建议，不承诺收益；涉及投资时提醒风险和假设。"
        "尽量围绕当前课程上下文和学生进度回答。"
        "不要使用 Markdown 粗体、标题、代码块或星号强调，不要输出 **、##、``` 这类符号。"
        "如果需要分点，用自然短句或中文序号即可。"
    )
    if mode == "quiz":
        user = (
            "请基于当前关卡生成 1 道新的挑战题。"
            "格式固定为：小精灵的一句鼓励、挑战题、选项A-D、正确答案、解析、一个延伸追问、一个通关建议。"
            f"\n\n当前课程上下文：{lesson_context}"
            f"\n\n学生进度：{json.dumps(progress_summary, ensure_ascii=False)}"
        )
    elif mode == "coach":
        user = (
            "请基于当前关卡和学生进度，给出一段简短的小精灵同行建议。"
            "格式固定为：先肯定当前进展，再指出一个最值得注意的通关动作，最后给一个 5 分钟内能完成的小任务。"
            f"\n\n当前课程上下文：{lesson_context}"
            f"\n\n学生进度：{json.dumps(progress_summary, ensure_ascii=False)}"
        )
    else:
        user = (
            f"学生问题：{question or '请用更通俗的话讲解这一课的核心内容。'}"
            f"\n\n当前课程上下文：{lesson_context}"
            f"\n\n学生进度：{json.dumps(progress_summary, ensure_ascii=False)}"
        )
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def build_visual_prompt(payload):
    lesson = find_lesson(payload.get("lessonId", ""))
    monster = payload.get("monster", "金融概念守关难题")
    style = payload.get("style", "暖色调教育插画")
    return (
        "为一款中文金融学入门游戏化学习软件生成一张教学插画。"
        f"关卡主题：{lesson.get('title', '金融学入门')}。"
        f"守关难题：{monster}。"
        f"学习目标：{lesson.get('objective', '')}。"
        f"核心定义：{lesson.get('definition', '')}。"
        f"关键模型：{lesson.get('model', '')}。"
        "画面要求：横版信息图风格，包含勇者、小精灵伙伴、概念怪物、清晰的流程箭头和少量中文标签；"
        "标签要短，例如“现金流”“时间”“风险”“模型”“边界”；"
        "适合初学者，不要金融交易软件界面，不要真实股票代码，不要投资承诺。"
        f"视觉风格：{style}，干净、明亮、适合学习软件。"
    )


def extract_image_url(result):
    choices = result.get("choices") or []
    if choices:
        content = choices[0].get("message", {}).get("content", "") or ""
        markdown_match = re.search(r"!\[[^\]]*\]\(([^)]+)\)", content)
        if markdown_match and markdown_match.group(1).strip():
            return markdown_match.group(1).strip()
        url_match = re.search(r"https?://[^\s)\"']+", content)
        if url_match:
            return url_match.group(0)
    data = result.get("data", result)
    if isinstance(data, list) and data:
        first = data[0]
        if isinstance(first, str):
            return first
        if isinstance(first, dict):
            return first.get("url") or first.get("imageUrl") or first.get("image_url")
    urls = data.get("outputImageUrls") or data.get("imageUrls") or data.get("images")
    if isinstance(urls, list) and urls:
        first = urls[0]
        if isinstance(first, str):
            return first
        if isinstance(first, dict):
            return first.get("url") or first.get("imageUrl")
    return (
        data.get("outputImageUrl")
        or data.get("url")
        or data.get("imageUrl")
        or data.get("image_url")
        or data.get("fileUrl")
    )


def download_generated_image(image_url):
    GENERATED_IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(image_url, headers={"User-Agent": "FinanceTutor/1.0"})
    with urllib.request.urlopen(request, timeout=60) as response:
        content_type = response.headers.get("Content-Type", "image/png").split(";")[0]
        ext = mimetypes.guess_extension(content_type) or ".png"
        filename = f"visual_{int(time.time() * 1000)}{ext}"
        path = GENERATED_IMAGE_DIR / filename
        path.write_bytes(response.read())
    return f"/generated_images/{filename}"


def post_image_request(url, api_key, body):
    request = urllib.request.Request(
        url,
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "FinanceTutor/1.0",
            "Accept": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=300) as response:
        return json.loads(response.read().decode("utf-8"))


def call_nano_banana(payload):
    config = get_visual_config()
    if not config["api_key"]:
        raise RuntimeError("还没有配置 nano banana API key。")
    prompt = build_visual_prompt(payload)
    prompt_with_ratio = f"{prompt} 图片长宽比{config['aspect_ratio']}。"
    chat_body = {
        "model": config["model"],
        "messages": [{"role": "user", "content": prompt_with_ratio}],
    }
    primary_body = {
        "prompt": prompt,
        "selectedModel": config["model"],
        "aspectRatio": config["aspect_ratio"],
        "mode": "sync",
    }
    fallback_body = {
        "prompt": prompt,
        "num": 1,
        "model": FALLBACK_IMAGE_MODEL,
        "image_size": config["aspect_ratio"],
    }
    errors = []
    for provider, url, body in (
        ("sg2.dchai.cn", NANO_BANANA_CHAT_API_URL, chat_body),
        ("nananobanana.com", NANO_BANANA_API_URL, primary_body),
        ("nanobananaapi.dev", NANO_BANANA_FALLBACK_API_URL, fallback_body),
    ):
        try:
            result = post_image_request(url, config["api_key"], body)
            image_url = extract_image_url(result)
            if not image_url:
                preview = json.dumps(result, ensure_ascii=False)[:260]
                raise RuntimeError(f"{provider} 没有返回图片地址：{preview}")
            local_url = download_generated_image(image_url)
            return {"imageUrl": local_url, "remoteImageUrl": image_url, "model": body.get("selectedModel") or body.get("model"), "provider": provider}
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            errors.append(f"{provider} 返回 {error.code}: {detail[:220]}")
        except urllib.error.URLError as error:
            errors.append(f"{provider} 无法连接: {error.reason}")
        except RuntimeError as error:
            errors.append(str(error))
    raise RuntimeError("；".join(errors))


def call_deepseek(messages):
    config = get_deepseek_config()
    if not config["api_key"]:
        raise RuntimeError("还没有配置 DeepSeek API key。")
    body = {
        "model": config["model"],
        "messages": messages,
        "temperature": 0.4,
        "max_tokens": 900,
        "stream": False,
        "thinking": {"type": "disabled"},
    }
    request = urllib.request.Request(
        DEEPSEEK_API_URL,
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {config['api_key']}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"DeepSeek API 返回错误 {error.code}: {detail[:300]}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"无法连接 DeepSeek API: {error.reason}") from error

    choices = result.get("choices") or []
    if not choices:
        raise RuntimeError("DeepSeek API 没有返回可用回答。")
    return {
        "answer": clean_teacher_answer(choices[0].get("message", {}).get("content", "")),
        "model": result.get("model", config["model"]),
        "usage": result.get("usage", {}),
    }


def clean_teacher_answer(text: str) -> str:
    cleaned = re.sub(r"\*\*(.*?)\*\*", r"\1", text or "")
    cleaned = re.sub(r"__(.*?)__", r"\1", cleaned)
    cleaned = re.sub(r"`([^`]+)`", r"\1", cleaned)
    cleaned = re.sub(r"^\s{0,3}#{1,6}\s+", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


class FinanceTutorHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"[FinanceTutor] {self.address_string()} - {fmt % args}")

    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/":
            return self.serve_file(STATIC_DIR / "index.html")
        if parsed.path == "/api/curriculum":
            return self.send_json(read_json(CURRICULUM_FILE, {}))
        if parsed.path == "/api/progress":
            return self.send_json(get_progress())
        if parsed.path == "/api/teacher/status":
            config = get_deepseek_config()
            return self.send_json({"configured": bool(config["api_key"]), "model": config["model"]})
        if parsed.path == "/api/visual/status":
            config = get_visual_config()
            return self.send_json(
                {
                    "configured": bool(config["api_key"]),
                    "model": config["model"],
                    "aspectRatio": config["aspect_ratio"],
                }
            )
        if parsed.path.startswith("/generated_images/"):
            requested = unquote(parsed.path.removeprefix("/generated_images/"))
            safe_path = (GENERATED_IMAGE_DIR / requested).resolve()
            if GENERATED_IMAGE_DIR.resolve() not in safe_path.parents:
                return self.send_error(403)
            if safe_path.exists():
                return self.serve_file(safe_path)
            bundled_path = (ASSET_ROOT / "data" / "generated_images" / requested).resolve()
            bundled_root = (ASSET_ROOT / "data" / "generated_images").resolve()
            if bundled_root in bundled_path.parents:
                return self.serve_file(bundled_path)
            return self.send_error(404)

        requested = unquote(parsed.path.lstrip("/"))
        safe_path = (STATIC_DIR / requested).resolve()
        if STATIC_DIR.resolve() not in safe_path.parents and safe_path != STATIC_DIR.resolve():
            return self.send_error(403)
        return self.serve_file(safe_path)

    def do_POST(self):
        parsed = urlparse(self.path)
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length).decode("utf-8")
        try:
            payload = json.loads(body or "{}")
        except json.JSONDecodeError:
            return self.send_json({"error": "JSON 格式错误"}, 400)

        if parsed.path == "/api/progress":
            return self.send_json(save_progress(payload))
        if parsed.path == "/api/teacher/settings":
            return self.send_json(save_deepseek_config(payload))
        if parsed.path == "/api/visual/settings":
            return self.send_json(save_visual_config(payload))
        if parsed.path == "/api/visual/generate":
            try:
                return self.send_json(call_nano_banana(payload))
            except RuntimeError as error:
                return self.send_json({"error": str(error)}, 400)
        if parsed.path == "/api/teacher":
            try:
                return self.send_json(call_deepseek(build_teacher_messages(payload)))
            except RuntimeError as error:
                return self.send_json({"error": str(error)}, 400)
        return self.send_error(404)

    def serve_file(self, path: Path):
        if not path.exists() or not path.is_file():
            return self.send_error(404)
        content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        body = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    host = "127.0.0.1"
    port = 8765
    url = f"http://{host}:{port}"
    try:
        server = ThreadingHTTPServer((host, port), FinanceTutorHandler)
    except OSError:
        webbrowser.open(url)
        return
    print(f"金融学入门学习软件已启动：{url}")
    try:
        webbrowser.open(url)
    except Exception:
        pass
    server.serve_forever()


if __name__ == "__main__":
    main()
