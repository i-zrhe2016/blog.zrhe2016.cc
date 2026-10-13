---
title: "Podman 安装部署与测试"
description: "Podman比 Docker 更轻量、安全，还能免守护进程运行，于是我就试着在测试环境里装了一下，Podman是一个开源的容器管理工具，功能类似 Docker，但不需要后台守护进程，也可以用普通用户运行，对于容器的编排方面类似k8s的pod，方便直接迁移到k8s集群 它的命令几乎和 Docker 一样，比如： podm"
pubDatetime: 2025-10-26T15:44:00Z
tags: []
draft: false
---

Podman比 Docker 更轻量、安全，还能免守护进程运行，于是我就试着在测试环境里装了一下，Podman是一个开源的容器管理工具，功能类似 Docker，但不需要后台守护进程，也可以用普通用户运行，对于容器的编排方面类似k8s的pod，方便直接迁移到k8s集群

---

它的命令几乎和 Docker 一样，比如：

```text
podman run nginx

```

跟 Docker 的用法一模一样，换个名字就行。

---

## 安装 Podman

我是在CentOS 8系统上安装的。其他系统命令略有不同。

### 更新系统

```text
dnf update -y

```

### 安装 Podman

```text
dnf install -y podman

```

安装完成后可以验证一下：

```text
podman --version

```

输出类似：

```text
podman version 4.6.2

```

说明安装成功

---

## 第一次运行容器

和Docker一样，Podman的容器镜像默认也是从 `docker.io` 拉取。

### 拉一个官方镜像

```text
podman pull nginx

```

如果下载速度慢，可以设置国内镜像源

### 启动一个容器

```text
podman run -d -p 8080:80 nginx

```

### 查看容器状态

```text
podman ps

```

输出类似：

```text
CONTAINER ID  IMAGE                           COMMAND               CREATED         STATUS             PORTS               NAMES
a8b1c3d5e6f7  docker.io/library/nginx:latest  nginx -g daemon off;  2 minutes ago   Up 2 minutes ago   0.0.0.0:8080->80/tcp  nginx_test

```

### 测试访问

浏览器打开：

```text
http://IP:8080

```

如果看到 **“Welcome to nginx!”** 就说明成功跑起来了。

---

Podman 还支持 rootless 模式，可以直接在普通用户下运行，不用 `sudo`，安全性更高。
