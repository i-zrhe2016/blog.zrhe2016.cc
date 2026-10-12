---
title: "auditd记录linux执行过的所有命令"
description: "1. 安装并启动 auditd yum install audit -y systemctl enable --now auditd systemctl status auditd 2. 永久生效：写入规则文件 只记录手动输入的命令 cat >/etc/audit/rules.d/execve-auid.rules <"
pubDatetime: 2025-12-31T03:16:00Z
tags: []
draft: false
---

<h3 id="1-auditd">1. 安装并启动 auditd</h3>

<pre><span></span>yum<span class="w"> </span>install<span class="w"> </span>audit<span class="w"> </span>-y
systemctl<span class="w"> </span><span class="nb">enable</span><span class="w"> </span>--now<span class="w"> </span>auditd
systemctl<span class="w"> </span>status<span class="w"> </span>auditd
</pre>



<h3 id="2">2. 永久生效：写入规则文件</h3><p>只记录手动输入的命令</p>

<pre><span></span>cat<span class="w"> </span>&gt;/etc/audit/rules.d/execve-auid.rules<span class="w"> </span><span class="s">&lt;&lt;'EOF'</span>
<span class="s">-a always,exit -F arch=b64 -S execve -S execveat -F auid&gt;=0 -F auid!=4294967295 -k cmdlog</span>
<span class="s">-a always,exit -F arch=b32 -S execve -S execveat -F auid&gt;=0 -F auid!=4294967295 -k cmdlog</span>
<span class="s">EOF</span>
augenrules<span class="w"> </span>--load
systemctl<span class="w"> </span>restart<span class="w"> </span>auditd
</pre>



<h3 id="3">3. 再次确认规则是否加载成功</h3>

<pre><span></span>auditctl<span class="w"> </span>-l
</pre>



<h3 id="4">4. 常用查询方式</h3><p>查看今天的 execve 记录</p>

<pre><span></span>ausearch<span class="w"> </span>-sc<span class="w"> </span>execve<span class="w"> </span>--start<span class="w"> </span>today<span class="w"> </span>-i
</pre>



<p>只看最近的几条</p>

<pre><span></span>ausearch<span class="w"> </span>-sc<span class="w"> </span>execve<span class="w"> </span>--start<span class="w"> </span>today<span class="w"> </span>-i<span class="w"> </span><span class="p">|</span><span class="w"> </span>tail<span class="w"> </span>-n<span class="w"> </span><span class="m">50</span>
</pre>



<p>一行命令显示</p>

<pre><span></span>ausearch<span class="w"> </span>-sc<span class="w"> </span>execve<span class="w"> </span>--start<span class="w"> </span>today<span class="w"> </span><span class="p">|</span><span class="w"> </span><span class="se">\</span>
awk<span class="w"> </span><span class="s1">'</span>
<span class="s1">/^time-&gt;/ {t=$0}</span>
<span class="s1">/type=EXECVE/{</span>
<span class="s1">  cmd=""</span>
<span class="s1">  for(i=1;i&lt;=NF;i++){</span>
<span class="s1">    if($i ~ /^a[0-9]+=/){</span>
<span class="s1">      gsub(/^a[0-9]+=/,"",$i)</span>
<span class="s1">      gsub(/"/,"",$i)</span>
<span class="s1">      cmd=cmd $i " "</span>
<span class="s1">    }</span>
<span class="s1">  }</span>
<span class="s1">  print t "\nCMD: " cmd "\n----"</span>
<span class="s1">}'</span>
</pre>



