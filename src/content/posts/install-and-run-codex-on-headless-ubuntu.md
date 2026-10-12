---
title: "install and run codex on headless ubuntu"
description: "install node.js curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash source ~/.bashrc nvm install --lts node -v npm -v install codex "
pubDatetime: 2026-01-10T18:33:00Z
tags: []
draft: false
---

<p>install node.js</p>

<pre><span></span>curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install --lts
node -v
npm -v
</pre>



<h3 id="install-codex">install codex</h3>

<pre><span></span>npm i -g @openai/codex
</pre>



<h3 id="login-codex">login codex</h3><p>enable device code login on chatgpt account<br/>
open link and use code to login</p>

<pre><span></span>codex login --device-auth
</pre>



<h3 id="2">方式2 配置端口转发</h3><p>本地请求将回调地址转发到虚拟机或者vps</p>

<pre><span></span>ssh -i "/path/to/private_key" -L 1455:127.0.0.1:1455 root@192.168.147.130
</pre>



