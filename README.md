# 金融勇者学院

这是一个用 Python 标准库实现的本地学习软件，面向完全没有金融学基础的学习者。软件采用打怪通关模式：每一课是一关，每个概念都是一个可以击破的守关难题。

## 运行方式

```powershell
python app.py
```

启动后访问：

```text
http://127.0.0.1:8765
```

## 已包含功能

- 10 节金融学入门课程
- 打怪通关模式：关卡、守关难题、经验值、勇者等级
- 明亮冒险风界面：专属主视觉、小精灵角色图、关卡地图、英雄区、等级面板、概念图解和更统一的游戏化文案
- 小精灵伙伴：回答当前关卡问题、实时生成挑战题、根据通关进度给学习建议
- nano banana 图解生成：按当前关卡生成解释插画，并保存到本地
- 陪伴型通关提示：在学习定义、关系、模型、例子、边界和挑战题时自动提醒更合适的学习方法
- 课程讲解结构：名词定义、概念关系、原理/模型、例子、反例/边界、挑战题
- 学习进度保存
- 每课笔记保存
- 术语卡片复习
- 时间价值计算器
- 开放教材和公开课资源入口

## 配置 DeepSeek

打开软件后，可以在右侧“实时老师”区域粘贴 DeepSeek API key 并点击“保存配置”。配置会写入本地 `data/settings.json`。

也可以使用环境变量启动，不把 key 写进配置文件：

```powershell
$env:DEEPSEEK_API_KEY="你的 DeepSeek API key"
python app.py
```

也可以复制 `data/settings.example.json` 为 `data/settings.json`，把 key 填入 `deepseek_api_key`。`data/settings.json` 已加入 `.gitignore`，不会被提交到仓库。

## 配置 nano banana 图解生成

打开软件后，可以在右侧“图解生成”区域粘贴 nano banana API key 并保存。软件会优先调用 OpenAI 兼容接口 `https://sg2.dchai.cn/v1/chat/completions`，默认模型为 `Nano_Banana_Pro_2K_0`。生成的图片会下载到本地 `data/generated_images`，避免远程图片链接失效后看不到图。

也可以使用环境变量启动：

```powershell
$env:NANO_BANANA_API_KEY="你的 nano banana API key"
python app.py
```

## 内容来源说明

软件内的中文课程内容为原创教学化整理，不直接复制受版权保护教材正文。延伸资料入口包括 OpenStax、Khan Academy 和 MIT OpenCourseWare，适合继续深入学习。
