---
title: "Podman 安装部署与测试"
description: "Podman比 Docker 更轻量、安全，还能免守护进程运行，于是我就试着在测试环境里装了一下，Podman是一个开源的容器管理工具，功能类似 Docker，但不需要后台守护进程，也可以用普通用户运行，对于容器的编排方面类似k8s的pod，方便直接迁移到k8s集群 它的命令几乎和 Docker 一样，比如： podm"
pubDatetime: 2025-10-26T15:44:00Z
tags: []
draft: false
---

<p>Podman比 Docker 更轻量、安全，还能免守护进程运行，于是我就试着在测试环境里装了一下，Podman是一个开源的容器管理工具，功能类似 Docker，但不需要后台守护进程，也可以用普通用户运行，对于容器的编排方面类似k8s的pod，方便直接迁移到k8s集群</p>
<hr/>
<p>它的命令几乎和 Docker 一样，比如：</p>

<pre><span></span>podman<span class="w"> </span>run<span class="w"> </span>nginx
</pre>



<p>跟 Docker 的用法一模一样，换个名字就行。</p>
<hr/>
<h2 id="podman">安装 Podman</h2><p>我是在CentOS 8系统上安装的。其他系统命令略有不同。</p>
<h3 id="">更新系统</h3>

<pre><span></span>dnf<span class="w"> </span>update<span class="w"> </span>-y
</pre>



<h3 id="podman-1">安装 Podman</h3>

<pre><span></span>dnf<span class="w"> </span>install<span class="w"> </span>-y<span class="w"> </span>podman
</pre>



<p>安装完成后可以验证一下：</p>

<pre><span></span>podman<span class="w"> </span>--version
</pre>



<p>输出类似：</p>

<pre><span></span>podman version 4.6.2
</pre>



<p>说明安装成功</p>
<hr/>
<h2 id="-1">第一次运行容器</h2><p>和Docker一样，Podman的容器镜像默认也是从 <code>docker.io</code> 拉取。</p>
<h3 id="-2">拉一个官方镜像</h3>

<pre><span></span>podman<span class="w"> </span>pull<span class="w"> </span>nginx
</pre>



<p>如果下载速度慢，可以设置国内镜像源</p>
<h3 id="-3">启动一个容器</h3>

<pre><span></span>podman<span class="w"> </span>run<span class="w"> </span>-d<span class="w"> </span>-p<span class="w"> </span><span class="m">8080</span>:80<span class="w"> </span>nginx
</pre>



<h3 id="-4">查看容器状态</h3>

<pre><span></span>podman<span class="w"> </span>ps
</pre>



<p>输出类似：</p>

<pre><span></span>CONTAINER ID  IMAGE                           COMMAND               CREATED         STATUS             PORTS               NAMES
a8b1c3d5e6f7  docker.io/library/nginx:latest  nginx -g daemon off;  2 minutes ago   Up 2 minutes ago   0.0.0.0:8080-&gt;80/tcp  nginx_test
</pre>



<h3 id="-5">测试访问</h3><p>浏览器打开：</p>

<pre><span></span>http://IP:8080
</pre>



<p>如果看到 <strong>“Welcome to nginx!”</strong> 就说明成功跑起来了。</p>
<hr/>
<p>Podman 还支持 rootless 模式，可以直接在普通用户下运行，不用 <code>sudo</code>，安全性更高。</p>
