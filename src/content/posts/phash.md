---
title: "pHash监控屏幕内容变化"
description: "启动时： 依次选择两个监控区域（box_watch_1、box_watch_2） 选择完会截图预览 监控时： 每隔 3s 截两块区域，计算 pHash： 每次都存图，保留最近 20 张。 第一次拿到图时会建立 base_sig1/2 作为“基准签名”。 后续每一帧与基准比对海明距离： 距离 > 6 就认为内容变化 任一"
pubDatetime: 2025-11-13T03:25:00Z
tags: []
draft: false
---

启动时：

依次选择两个监控区域（box_watch_1、box_watch_2）

选择完会截图预览

监控时：

每隔 3s 截两块区域，计算 pHash：

每次都存图，保留最近 20 张。

第一次拿到图时会建立 base_sig1/2 作为“基准签名”。

后续每一帧与基准比对海明距离：

距离 > 6 就认为内容变化

任一区域变化：

控制台打印“异常 + 详情”

开启一个线程等待按下回车

在你没按回车之前，每隔 5s 发送本地 Toast（或打印失败信息）

回车后：

重置基准 ，下一轮采样会用当前画面作为新的基准继续

```text
#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import time
import platform
import ctypes
import threading
import argparse
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple

import mss
from PIL import Image, ImageTk
import tkinter as tk
import requests  # ★ 新增依赖，用于请求 

# 可选依赖：pHash
try:
    import imagehash
except Exception:
    imagehash = None

IS_WINDOWS = platform.system() == "Windows"

try:
    from win10toast import ToastNotifier
    TOASTER = ToastNotifier() if IS_WINDOWS else None
except Exception:
    TOASTER = None

try:
    import pygetwindow as gw
except Exception:
    gw = None

# Windows DPI 感知
if IS_WINDOWS:
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(2)
    except Exception:
        try:
            ctypes.windll.user32.SetProcessDPIAware()
        except Exception:
            pass

# ---------------------------------------------------------
#  Startup Request Check  (程序启动前必须检查服务器)
# ---------------------------------------------------------

def pre_check_server():
    url = "http://"
    print(f"[信息] 正在访问启动检查：{url}")

    try:
        resp = requests.get(url, timeout=3)
    except Exception as e:
        print(f"[错误] 无法连接服务器：{e}")
        input("按 Enter 退出程序…")
        exit(1)

    if resp.status_code != 200:
        print(f"[错误] HTTP 状态码异常：{resp.status_code}")
        input("按 Enter 退出程序…")
        exit(1)

    print("[信息] 服务器返回内容：")
    print(resp.text)
    print("[信息] 启动检查通过。")

# ---------------------------------------------------------
#  每轮检测前都要访问服务器
# ---------------------------------------------------------

def check_server_each_cycle():
    url = "http://"
    try:
        resp = requests.get(url, timeout=2)
    except Exception as e:
        return False, f"{e.__class__.__name__}: {e}"

    if resp.status_code != 200:
        return False, f"HTTP {resp.status_code}"

    return True, resp.text

# ---------------------------------------------------------
#   Config
# ---------------------------------------------------------

@dataclass
class Config:
    interval_seconds: float = 3.0
    push_interval_seconds: float = 5.0
    max_files: int = 20
    cap_dir: Path = Path("captures")
    save_mode: str = "all"
    push_title: str = "区域监控异常"
    anchor_window_title: Optional[str] = None
    phash_max_distance: int = 6
    min_change_frames: int = 3

# ---------------------------------------------------------
#   工具函数
# ---------------------------------------------------------

def ensure_dir(p: Path):
    p.mkdir(parents=True, exist_ok=True)

def maintain_max_files(cap_dir: Path, max_files: int):
    files = sorted(cap_dir.glob("*.png"), key=lambda f: f.stat().st_mtime)
    while len(files) > max_files:
        try:
            files.pop(0).unlink(missing_ok=True)
        except:
            pass

def save_image(img: Image.Image, cap_dir: Path, name: str):
    ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    path = cap_dir / f"{ts}_{name}.png"
    img.save(path)
    return path

def grab_region(sct: mss.mss, bbox):
    left, top, w, h = bbox
    if w <= 0 or h <= 0:
        print(f"[警告] 非法 bbox：{bbox}")
        return None

    try:
        shot = sct.grab({"left": left, "top": top, "width": w, "height": h})
    except Exception as e:
        print(f"[错误] 截图失败：{e}")
        return None

    return Image.frombytes("RGB", (shot.width, shot.height), shot.rgb)

# ---------------------------------------------------------
#   pHash
# ---------------------------------------------------------

def compute_phash(img):
    if imagehash is None:
        return None
    try:
        return int(str(imagehash.phash(img)), 16)
    except:
        return None

def hamming_distance64(a, b):
    x = a ^ b
    cnt = 0
    while x:
        x &= x - 1
        cnt += 1
    return cnt

@dataclass
class ContentSignature:
    phash: Optional[int]

def make_signature(img):
    return ContentSignature(phash=compute_phash(img))

def content_changed(curr, base, cfg):
    if curr.phash is None or base.phash is None:
        return False, "pHash 不可用", None
    dist = hamming_distance64(curr.phash, base.phash)
    return (dist > cfg.phash_max_distance,
            f"海明距离 {dist}",
            dist)

# ---------------------------------------------------------
#   区域选择
# ---------------------------------------------------------

def get_pointer_xy():
    root = tk.Tk()
    root.withdraw()
    x, y = root.winfo_pointerx(), root.winfo_pointery()
    root.destroy()
    return x, y

def get_monitor_of_point(x, y):
    with mss.mss() as sct:
        for mon in sct.monitors[1:]:
            if mon["left"] <= x < mon["left"] + mon["width"] \
            and mon["top"] <= y < mon["top"] + mon["height"]:
                return mon
        return sct.monitors[0]

class BoxSelector:
    def __init__(self, monitor):
        self.mon = monitor
        self.root = tk.Tk()
        self.root.geometry(f"{monitor['width']}x{monitor['height']}+{monitor['left']}+{monitor['top']}")
        self.root.attributes("-alpha", 0.3)
        self.root.attributes("-topmost", True)
        self.root.overrideredirect(True)

        self.canvas = tk.Canvas(self.root, bg="black")
        self.canvas.pack(fill="both", expand=True)

        self.canvas.create_text(20, 20, anchor="nw",
                                text="按住左键拖拽矩形；松开结束；Esc取消",
                                fill="white", font=("Arial", 14))

        self.rect = None
        self.start_x = self.start_y = None

        self.canvas.bind("<Button-1>", self.on_press)
        self.canvas.bind("<B1-Motion>", self.on_drag)
        self.canvas.bind("<ButtonRelease-1>", self.on_release)
        self.root.bind("<Escape>", self.on_escape)

        self.result = None

    def on_escape(self, _):
        self.result = None
        self.root.destroy()

    def on_press(self, e):
        self.start_x, self.start_y = e.x_root, e.y_root
        if self.rect:
            self.canvas.delete(self.rect)
        self.rect = self.canvas.create_rectangle(
            self.start_x - self.mon["left"],
            self.start_y - self.mon["top"],
            self.start_x - self.mon["left"],
            self.start_y - self.mon["top"],
            outline="yellow", width=2
        )

    def on_drag(self, e):
        x1 = min(self.start_x, e.x_root) - self.mon["left"]
        y1 = min(self.start_y, e.y_root) - self.mon["top"]
        x2 = max(self.start_x, e.x_root) - self.mon["left"]
        y2 = max(self.start_y, e.y_root) - self.mon["top"]
        self.canvas.coords(self.rect, x1, y1, x2, y2)

    def on_release(self, e):
        left = min(self.start_x, e.x_root)
        top = min(self.start_y, e.y_root)
        w = abs(e.x_root - self.start_x)
        h = abs(e.y_root - self.start_y)
        if w > 0 and h > 0:
            self.result = (left, top, w, h)
        self.root.destroy()

    def get_box(self):
        self.root.mainloop()
        return self.result

def preview_confirm(bbox, title):
    with mss.mss() as sct:
        img = grab_region(sct, bbox)

    if img is None:
        print("[错误] 预览截图失败")
        return False

    w, h = img.size
    root = tk.Tk()
    root.title(f"{title} 预览确认")
    root.attributes("-topmost", True)

    sw, sh = root.winfo_screenwidth(), root.winfo_screenheight()
    margin = 140
    scale = min(1.0, (sw - margin) / w, (sh - margin) / h)
    disp = img if scale >= 1 else img.resize((int(w * scale), int(h * scale)))

    tk_img = ImageTk.PhotoImage(disp)
    tk.Label(root, image=tk_img).pack()
    tk.Label(root, text=f"实际: {w}×{h}  显示比例: {scale:.2f}x").pack()

    ok = {"v": False}
    f = tk.Frame(root)
    f.pack()

    tk.Button(f, text="确认", command=lambda: (ok.update(v=True), root.destroy())).pack(side="left", padx=10)
    tk.Button(f, text="重选", command=root.destroy).pack(side="left", padx=10)

    root.mainloop()
    return ok["v"]

def select_region_with_preview(name):
    x, y = get_pointer_xy()
    mon = get_monitor_of_point(x, y)
    while True:
        box = BoxSelector(mon).get_box()
        if not box:
            raise KeyboardInterrupt("用户取消")
        if preview_confirm(box, name):
            return box

# ---------------------------------------------------------
#   窗口锚定
# ---------------------------------------------------------

def bind_to_window_if_needed(bbox, anchor_title):
    if not anchor_title or not gw:
        return {"mode": "absolute", "bbox": bbox, "anchor": None}

    wins = [w for w in gw.getAllTitles() if anchor_title.lower() in w.lower()]
    if not wins:
        print(f"[提示] 锚定窗口未找到：{anchor_title}")
        return {"mode": "absolute", "bbox": bbox, "anchor": None}

    win = gw.getWindowsWithTitle(wins[0])[0]
    wx, wy = win.left, win.top
    bx, by, bw, bh = bbox
    rel = (bx - wx, by - wy, bw, bh)

    print(f"[信息] 已绑定窗口：{wins[0]} 相对区域 {rel}")
    return {"mode": "relative_to_window", "anchor": wins[0], "bbox": rel}


def resolve_bbox(binding):
    if binding["mode"] == "absolute":
        return binding["bbox"]

    if not gw:
        return binding["bbox"]

    cand = gw.getWindowsWithTitle(binding["anchor"])
    if not cand:
        rx, ry, rw, rh = binding["bbox"]
        return (rx, ry, rw, rh)

    win = cand[0]
    wx, wy = win.left, win.top
    rx, ry, rw, rh = binding["bbox"]
    return (wx + rx, wy + ry, rw, rh)


# ---------------------------------------------------------
#   通知
# ---------------------------------------------------------

def local_notify(title, body):
    if not IS_WINDOWS or TOASTER is None:
        return False, "非 Windows 或通知库不可用"

    try:
        TOASTER.show_toast(title, body, duration=5, threaded=True)
        return True, None
    except Exception as e:
        return False, str(e)


# ---------------------------------------------------------
#   主流程 run(cfg)
# ---------------------------------------------------------

def run(cfg: Config):

    # ★ 启动前必须能访问服务器，否则退出
    pre_check_server()

    ensure_dir(cfg.cap_dir)

    print("[信息] 选择监控区域 1...")
    box1 = select_region_with_preview("box_watch_1")
    print("[信息] 选择监控区域 2...")
    box2 = select_region_with_preview("box_watch_2")

    binding1 = bind_to_window_if_needed(box1, cfg.anchor_window_title)
    binding2 = bind_to_window_if_needed(box2, cfg.anchor_window_title)

    base_sig1 = None
    base_sig2 = None
    change_streak = 0

    try:
        with mss.mss() as sct:
            while True:
                now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

                # ------------------------------------------------------
                # ★ 每轮检测前都必须访问服务器
                # ------------------------------------------------------
                ok, msg = check_server_each_cycle()
                if not ok:
                    print(f"[错误] {now} 服务器访问失败：{msg}")

                    body = f"{now}\n服务器连接失败：{msg}"
                    notify_ok, err = local_notify("服务器异常", body)
                    if not notify_ok:
                        print(f"[警告] 通知失败：{err}")

                    time.sleep(cfg.interval_seconds)
                    continue
                else:
                    print(f"[信息] {now} 服务器正常：{msg}")

                # ------------------------------------------------------
                # 请求成功后：继续截图 + pHash
                # ------------------------------------------------------

                bbox1 = resolve_bbox(binding1)
                bbox2 = resolve_bbox(binding2)

                img1 = grab_region(sct, bbox1)
                img2 = grab_region(sct, bbox2)
                if img1 is None or img2 is None:
                    print(f"[警告] {now} 截图失败")
                    time.sleep(cfg.interval_seconds)
                    continue

                img1 = img1.convert("RGB")
                img2 = img2.convert("RGB")

                if cfg.save_mode == "all":
                    save_image(img1, cfg.cap_dir, "box_watch_1")
                    save_image(img2, cfg.cap_dir, "box_watch_2")
                    maintain_max_files(cfg.cap_dir, cfg.max_files)

                if base_sig1 is None:
                    base_sig1 = make_signature(img1)
                    print("[信息] 已记录 box1 基准")
                if base_sig2 is None:
                    base_sig2 = make_signature(img2)
                    print("[信息] 已记录 box2 基准")

                sig1 = make_signature(img1)
                sig2 = make_signature(img2)

                ch1, why1, dist1 = content_changed(sig1, base_sig1, cfg)
                ch2, why2, dist2 = content_changed(sig2, base_sig2, cfg)

                triggered = ch1 or ch2

                if not triggered:
                    change_streak = 0
                    print(f"[信息] {now} 正常：{why1} | {why2}")
                    time.sleep(cfg.interval_seconds)
                    continue

                change_streak += 1
                if change_streak < cfg.min_change_frames:
                    print(f"[信息] {now} 检测到短暂变化（{change_streak}/{cfg.min_change_frames}）")
                    time.sleep(cfg.interval_seconds)
                    continue

                change_streak = 0
                info_str = "; ".join([
                    f"box1: {why1}" if ch1 else "",
                    f"box2: {why2}" if ch2 else ""
                ])

                print(f"[警告] {now} 内容异常：{info_str}")

                stop_event = threading.Event()

                def wait_key(ev):
                    try:
                        input()
                    except:
                        pass
                    ev.set()

                threading.Thread(target=wait_key, args=(stop_event,), daemon=True).start()

                if cfg.save_mode == "change":
                    save_image(img1, cfg.cap_dir, "trigger_box1")
                    save_image(img2, cfg.cap_dir, "trigger_box2")
                    maintain_max_files(cfg.cap_dir, cfg.max_files)

                while not stop_event.is_set():
                    push_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    body = f"{push_time} 内容变化\n{info_str}"

                    ok, err = local_notify(cfg.push_title, body)
                    if ok:
                        print(f"[信息] {push_time} 已推送通知")
                    else:
                        print(f"[警告] 通知失败：{err}")

                    for _ in range(int(cfg.push_interval_seconds * 10)):
                        if stop_event.is_set():
                            break
                        time.sleep(0.1)

                print("[信息] 用户确认异常，重置基准")
                base_sig1 = None
                base_sig2 = None

    except KeyboardInterrupt:
        print("\n[信息] 用户退出程序。")


# ---------------------------------------------------------
#   CLI
# ---------------------------------------------------------

def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--interval", type=float, default=10)
    p.add_argument("--push-interval", type=float, default=5)
    p.add_argument("--cap-dir", default="captures")
    p.add_argument("--max-files", type=int, default=20)
    p.add_argument("--save", choices=["all", "change", "none"], default="all")
    p.add_argument("--anchor", default=None)
    p.add_argument("--phash-th", type=int, default=6)
    p.add_argument("--min-change-frames", type=int, default=3)

    a = p.parse_args()

    return Config(
        interval_seconds=a.interval,
        push_interval_seconds=a.push_interval,
        max_files=a.max_files,
        cap_dir=Path(a.cap_dir),
        save_mode=a.save,
        anchor_window_title=a.anchor,
        phash_max_distance=a.phash_th,
        min_change_frames=a.min_change_frames,
    )


if __name__ == "__main__":
    cfg = parse_args()
    run(cfg)

```

通过这个脚本可以实现当截图屏幕内容出现变化时会调用win10toast发送通知，间隔5s一直发送直到按下enter键，海明距离设为6保证微小的变化比如鼠标指针出现不会触发警告，整个过程在离线环境下进行，本地截图方式避免了内外网络请求，确保数据的安全性

1115 更新检测网络是否连通和确认机制，连续三次检测到pHash变化再告警
