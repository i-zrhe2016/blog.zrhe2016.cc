---
title: "离线迁移测试域 Nacos 数据至 MySQL 8.0.44"
description: "1. 备份原数据库 mysqldump -uroot -p \\ --all-databases \\ --single-transaction \\ --routines --triggers --events \\ > all_databases.sql 2. 联网机器下载依赖并拷贝到离线机器 dnf download n"
pubDatetime: 2025-12-19T07:31:00Z
tags: []
draft: false
---

<h3 id="1">1. 备份原数据库</h3>

<pre><span></span>mysqldump<span class="w"> </span>-uroot<span class="w"> </span>-p<span class="w"> </span><span class="se">\</span>
<span class="w">  </span>--all-databases<span class="w"> </span><span class="se">\</span>
<span class="w">  </span>--single-transaction<span class="w"> </span><span class="se">\</span>
<span class="w">  </span>--routines<span class="w"> </span>--triggers<span class="w"> </span>--events<span class="w"> </span><span class="se">\</span>
<span class="w">  </span>&gt;<span class="w"> </span>all_databases.sql
</pre>



<h3 id="2">2. 联网机器下载依赖并拷贝到离线机器</h3>

<pre><span></span>dnf<span class="w"> </span>download<span class="w"> </span>ncurses<span class="w"> </span>ncurses-base<span class="w"> </span>--resolve<span class="w"> </span>--destdir<span class="w"> </span>./ncurses_offline
</pre>



<h3 id="3">3. 离线机器安装依赖</h3>

<pre><span></span>dnf<span class="w"> </span>install<span class="w"> </span>*.rpm
</pre>



<h3 id="4-mysql">4. 下载并解压 MySQL 二进制包</h3>

<pre><span></span>mysql-8.0.44-linux-glibc2.28-x86_64.tar.xz
</pre>



<p>解压到指定目录：</p>

<pre><span></span>tar<span class="w"> </span>-xJf<span class="w"> </span>mysql-8.0.44-linux-glibc2.28-x86_64.tar.xz<span class="w"> </span>-C<span class="w"> </span>/home/nacos/
</pre>



<h3 id="5-mysql">5. 停止旧 MySQL 实例</h3>

<pre><span></span>ps<span class="w"> </span>auxf<span class="w"> </span><span class="p">|</span><span class="w"> </span>grep<span class="w"> </span>mysql
<span class="nb">kill</span><span class="w"> </span>-9<span class="w"> </span>&lt;pid&gt;
</pre>



<h3 id="6-root">6. 无密码方式启动并重置 root 密码</h3><p>1）跳过权限启动 MySQL：</p>

<pre><span></span>sudo<span class="w"> </span>mysqld_safe<span class="w"> </span>--skip-grant-tables<span class="w"> </span>--skip-networking<span class="w"> </span><span class="p">&amp;</span>
</pre>



<p>2）登录并修改密码：</p>

<pre><span></span>mysql<span class="w"> </span>-uroot
ALTER<span class="w"> </span>USER<span class="w"> </span><span class="s1">'root'</span>@<span class="s1">'localhost'</span>
IDENTIFIED<span class="w"> </span>BY<span class="w"> </span><span class="s1">'Y8dkYnGJdDbX738t2yCmp7DgMAsfzNUhmu8X3Wf4CJkNVArxpW'</span><span class="p">;</span>
FLUSH<span class="w"> </span>PRIVILEGES<span class="p">;</span>
</pre>



<p>3）重启 MySQL</p>
<h3 id="7-mysql">7. 启动新 MySQL</h3>

<pre><span></span>/home/nacos/mysql-8.0.44-linux-glibc2.17-x86_64/bin/mysqld<span class="w"> </span><span class="se">\</span>
<span class="w">  </span>--defaults-file<span class="o">=</span>/home/nacos/mysql/my.cnf<span class="w"> </span><span class="se">\</span>
<span class="w">  </span>--basedir<span class="o">=</span>/home/nacos/mysql-8.0.44-linux-glibc2.17-x86_64<span class="w"> </span><span class="se">\</span>
<span class="w">  </span>--datadir<span class="o">=</span>/home/nacos/mysql/data<span class="w"> </span><span class="se">\</span>
<span class="w">  </span>--plugin-dir<span class="o">=</span>/home/nacos/mysql-8.0.44-linux-glibc2.17-x86_64/lib/plugin<span class="w"> </span><span class="se">\</span>
<span class="w">  </span>--lc-messages-dir<span class="o">=</span>/home/nacos/mysql-8.0.44-linux-glibc2.17-x86_64/share<span class="w"> </span><span class="se">\</span>
<span class="w">  </span>--log-error<span class="o">=</span>/home/nacos/mysql/logs/mysql.err<span class="w"> </span><span class="se">\</span>
<span class="w">  </span>--pid-file<span class="o">=</span>/home/nacos/mysql/logs/mysql.pid<span class="w"> </span><span class="se">\</span>
<span class="w">  </span>--socket<span class="o">=</span>/home/nacos/mysql/logs/mysql.sock<span class="w"> </span><span class="se">\</span>
<span class="w">  </span>--port<span class="o">=</span><span class="m">3306</span>
</pre>



<h3 id="8">8. 导入原数据库数据</h3>

<pre><span></span>mysql<span class="w"> </span>-uroot<span class="w"> </span>-p<span class="w"> </span>--socket<span class="o">=</span>/home/nacos/mysql/logs/mysql.sock<span class="w"> </span>&lt;<span class="w"> </span>all_databases.sql
</pre>



<h3 id="9-nacos">9. 验证 Nacos 数据与功能</h3><ul>
<li>Nacos 服务启动正常</li>
<li>配置、命名空间、历史配置完整</li>
<li>客户端能够正常拉取配置</li>
</ul>
