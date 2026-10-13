---
title: "使用ttyd将shell公开在web访问"
description: "安装 snap install ttyd --classic 启动 ttyd -W -p 8889 bash 在浏览器中访问： http://IP:8889 好处就是shell可以直接在浏览器中访问，国外节点无需配置代理即可加速"
pubDatetime: 2025-10-02T13:34:00Z
tags: []
draft: false
---

安装

```text
snap install ttyd --classic

```

启动

```text
ttyd -W -p 8889 bash

```

在浏览器中访问：

```text
http://IP:8889

```

好处就是shell可以直接在浏览器中访问，国外节点无需配置代理即可加速
