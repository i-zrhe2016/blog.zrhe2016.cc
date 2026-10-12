---
title: "配置apt绕过代理"
description: "vim ~/.bashrc export http_proxy=\"socks5://192.168.5.34:10808\" export https_proxy=\"socks5://192.168.5.34:10808\" export all_proxy=\"socks5://192.168.5.34:10808\" so"
pubDatetime: 2026-01-10T17:26:00Z
tags: []
draft: false
---

<pre><span></span>vim ~/.bashrc
export http_proxy="socks5://192.168.5.34:10808"
export https_proxy="socks5://192.168.5.34:10808"
export all_proxy="socks5://192.168.5.34:10808"
source ~/.bashrc
curl -I https://www.google.com
</pre>



<p>全局配置sock5代理但是apt不支持sock5，这里直接修改apt配置直接禁止使用代理</p>

<pre><span></span>cat &gt;/etc/apt/apt.conf.d/99no-proxy &lt;&lt;'EOF'
Acquire::http::Proxy "false";
Acquire::https::Proxy "false";
EOF
</pre>



