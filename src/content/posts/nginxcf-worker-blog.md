---
title: "nginx反代cf worker blog"
description: "配置文件 resolver 8.8.8.8 ipv6=off; server { listen 80; server_name blog.zrhe2016.cc; location / { proxy_pass https://blog.zrhe2016.workers.dev; proxy_ssl_name blog"
pubDatetime: 2025-09-25T16:21:00Z
tags: []
draft: false
---

配置文件

```text
resolver 8.8.8.8 ipv6=off;

server {
    listen 80;
    server_name blog.zrhe2016.cc;

    location / {
        proxy_pass https://blog.zrhe2016.workers.dev;
        proxy_ssl_name blog.zrhe2016.workers.dev;
        proxy_ssl_server_name on;
        proxy_set_header Host blog.zrhe2016.workers.dev;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}

```

proxy_ssl_server_name 需要开启，否则https握手时sni只会携带被代理域名的ip地址，与证书域名不匹配
