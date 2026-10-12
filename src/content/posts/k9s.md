---
title: "k9s介绍"
description: "k9s是kubectl的可视化工具，能够更轻松地浏览、观察和管理已部署的应用程序，可以代替一部分需要kubectl手动输入的命令，简化操作。 快速安装 curl -sS [https://webi.sh/k9s](https://webi.sh/k9s) | sh; source ~/.config/envman/PA"
pubDatetime: 2025-11-29T13:36:00Z
tags: []
draft: false
---

<p>k9s是kubectl的可视化工具，能够更轻松地浏览、观察和管理已部署的应用程序，可以代替一部分需要kubectl手动输入的命令，简化操作。</p>
<h3 id="">快速安装</h3>

<pre><span></span>curl -sS [https://webi.sh/k9s](https://webi.sh/k9s) | sh; 
source ~/.config/envman/PATH.env
</pre>



<h3 id="-1">使用命令</h3><p>:pod<br/>
查看部署的pods</p>
<p><img alt="Snipaste_2025-11-30_17-24-49" src="/images/bearblog/5f0e62842ff8b24749e5.png"/></p>
<p>l 查看pod的log日志
<img alt="2" src="/images/bearblog/1e42ffce6f847f9980ea.png"/></p>
<p>/ 搜索显示的内容<br/>
: 切换资源</p>
<p>:alias 查看所有资源<br/>
<img alt="3" src="/images/bearblog/1afc695e883be85cdd3c.png"/></p>
<p>? 查看所有命令
<img alt="4" src="/images/bearblog/847f2bd6e104d8bd62bb.png"/></p>
