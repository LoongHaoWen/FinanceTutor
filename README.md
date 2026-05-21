# 金融勇者学院

这是一个面向完全没有金融学基础学习者的金融学习软件。软件采用打怪通关模式：每一课是一关，每个概念都是一个可以击破的守关难题。

## GitHub Pages 公开访问

仓库根目录已经提供 `index.html`，可以直接用 GitHub Pages 发布为静态站点。

发布方式：

1. 推送到 GitHub。
2. 打开仓库 Settings -> Pages。
3. Source 选择 `Deploy from a branch`。
4. Branch 选择 `main`，目录选择 `/root`。
5. 保存后访问 GitHub 给出的 Pages 地址。

公开静态版会从 `data/finance_curriculum.json` 读取课程内容，并把朋友各自的学习进度、答题记录和笔记保存在他们自己浏览器的 `localStorage` 中。静态版不会收集或保存 API key，也不会调用 DeepSeek 或 nano banana 后端接口。

## 本地增强版运行方式

如果你想继续使用 DeepSeek 答疑或 nano banana 图解生成，可以在本地运行 Python 版：

```powershell
python app.py
```

启动后访问：

```text
http://127.0.0.1:8765
```

## 已包含功能

- 30 关金融学学习内容，从入门到进阶
- 打怪通关模式：关卡、守关难题、经验值、勇者等级
- 小精灵伙伴：围绕当前关卡答疑、出题、给学习建议
- 4 档挑战难度：容易、普通、困难、极难，对应不同 XP
- 每关可选案例分析题，并可查看标准答案
- 首页主视觉、小精灵角色图、关卡地图和知识图解
- 前 10 关默认内置图解，已压缩并随软件打包，无需重复生成
- nano banana 图解生成：可按当前关卡生成补充插画并保存到本地
- 课程讲解结构：名词定义、概念关系、原理或模型、例子、反例或边界、挑战题
- 学习进度、笔记、术语卡片、时间价值计算器

## 配置 DeepSeek

打开软件后，可以在界面里保存 DeepSeek API key。配置会写入本地 `data/settings.json`。

也可以使用环境变量启动：

```powershell
$env:DEEPSEEK_API_KEY="你的 DeepSeek API key"
python app.py
```

## 配置 nano banana 图解生成

打开软件后，可以在界面里保存 nano banana API key。软件会优先调用 OpenAI 兼容接口 `https://sg2.dchai.cn/v1/chat/completions`，默认模型为 `Nano_Banana_Pro_2K_0`。生成的图片会下载到本地 `data/generated_images`。

也可以使用环境变量启动：

```powershell
$env:NANO_BANANA_API_KEY="你的 nano banana API key"
python app.py
```

## 内容说明

软件内的中文课程内容为原创教学化整理，不直接复制受版权保护教材正文。延伸资料入口包括 OpenStax、Khan Academy 和 MIT OpenCourseWare。
