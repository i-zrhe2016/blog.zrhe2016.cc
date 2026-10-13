---
title: "bark结合py脚本实现通知推送"
description: "Bark是一款运行在iOS上的推送工具，可以通过简单的 HTTP 请求把消息推送到手机 Bark 推送格式非常简单： https://api.day.app/<your_key>/<title>/<message> 写一个倒计时脚本 import time import datetime import requests"
pubDatetime: 2025-11-09T13:52:00Z
tags: []
draft: false
---

Bark是一款运行在iOS上的推送工具，可以通过简单的 HTTP 请求把消息推送到手机

Bark 推送格式非常简单：

```text
https://api.day.app/<your_key>/<title>/<message>

```

写一个倒计时脚本

```text
import time
import datetime
import requests

# === 配置部分 ===
BARK_KEY = "你的Bark推送Key"   # 替换为你自己的Bark Key
BARK_URL = f"https://api.day.app/{BARK_KEY}"

# 设置倒计时目标时间
#!/usr/bin/env python3
import time, urllib.parse, urllib.request

# 你的 Bark 推送地址（已固定）
BARK_BASE = "https://api.day.app//"

def bark_push(title: str, body: str):
    """发送 Bark 推送"""
    url = f"{BARK_BASE}{urllib.parse.quote(title)}/{urllib.parse.quote(body)}"
    try:
        with urllib.request.urlopen(url, timeout=10) as r:
            print(f"推送成功，响应码：{r.status}")
    except Exception as e:
        print(f"推送失败：{e}")

def countdown(seconds: int = 300, title: str = "提醒", body: str = "倒计时结束啦！"):
    """倒计时函数，默认 5 分钟"""
    print(f"开始倒计时 {seconds} 秒...")
    time.sleep(seconds)
    bark_push(title, body)

if __name__ == "__main__":
    # 默认倒计时 5 分钟（300 秒）
    countdown(300, "倒计时提醒", "时间到了！")

```

通过bark和python脚本的结合可以在任意想要执行的任务完成后发送通知到手机
