---
title: "使用ttyd将shell公开在web访问"
description: "安装 snap install ttyd --classic 启动 ttyd -W -p 8889 bash 在浏览器中访问： http://IP:8889 好处就是shell可以直接在浏览器中访问，国外节点无需配置代理即可加速"
pubDatetime: 2025-10-02T13:34:00Z
tags: []
draft: false
---

<p>安装</p>

<pre><span></span>snap<span class="w"> </span>install<span class="w"> </span>ttyd<span class="w"> </span>--classic
</pre>



<p>启动</p>

<pre><span></span>ttyd<span class="w"> </span>-W<span class="w"> </span>-p<span class="w"> </span><span class="m">8889</span><span class="w"> </span>bash
</pre>



<p>在浏览器中访问：</p>

<pre><span></span>http://IP:8889
</pre>



<p>好处就是shell可以直接在浏览器中访问，国外节点无需配置代理即可加速</p>
