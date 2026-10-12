---
title: "MyDumper 备份与恢复数据的流程"
description: "MyDumper 是 MySQL 的高性能备份工具，支持多线程导出、压缩和快速恢复。相比 mysqldump，它导出速度更快、对大数据集支持更好，且能并发处理多个表，减少锁表时间。适合生产环境中大规模数据的备份与迁移。 1. 安装 MySQL # 更新软件包索引 sudo apt update # 安装 MySQL S"
pubDatetime: 2025-08-07T14:02:00Z
tags: []
draft: false
---

<p>MyDumper 是 MySQL 的高性能备份工具，支持多线程导出、压缩和快速恢复。相比 mysqldump，它导出速度更快、对大数据集支持更好，且能并发处理多个表，减少锁表时间。适合生产环境中大规模数据的备份与迁移。</p>
<hr/>
<h2 id="1-mysql">1. 安装 MySQL</h2>

<pre><span></span><span class="c1"># 更新软件包索引</span>
sudo<span class="w"> </span>apt<span class="w"> </span>update

<span class="c1"># 安装 MySQL Server</span>
sudo<span class="w"> </span>apt<span class="w"> </span>install<span class="w"> </span>-y<span class="w"> </span>mysql-server

<span class="c1"># 修改 root 用户密码为 666，并指定使用 mysql_native_password 插件</span>
sudo<span class="w"> </span>mysql<span class="w"> </span>-e<span class="w"> </span><span class="s2">"ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '666';"</span>
</pre>



<p><strong>验证 MySQL 是否安装成功</strong></p>

<pre><span></span><span class="c1"># 连接 MySQL 并查看版本号，验证服务正常</span>
mysql<span class="w"> </span>-uroot<span class="w"> </span>-p666<span class="w"> </span>-e<span class="w"> </span><span class="s2">"SELECT VERSION();"</span>
</pre>



<hr/>
<h2 id="2-mydumper">2. 安装 MyDumper</h2>

<pre><span></span><span class="c1"># 安装 MyDumper 编译依赖</span>
sudo<span class="w"> </span>apt<span class="w"> </span>install<span class="w"> </span>-y<span class="w"> </span>cmake<span class="w"> </span>gcc<span class="w"> </span>g++<span class="w"> </span>libglib2.0-dev<span class="w"> </span>libmysqlclient-dev<span class="w"> </span>libpcre3-dev<span class="w"> </span>zlib1g-dev

<span class="c1"># 克隆 MyDumper 官方源码仓库</span>
git<span class="w"> </span>clone<span class="w"> </span>https://github.com/mydumper/mydumper.git
<span class="nb">cd</span><span class="w"> </span>mydumper

<span class="c1"># 编译源码</span>
cmake<span class="w"> </span>.
make<span class="w"> </span>-j<span class="k">$(</span>nproc<span class="k">)</span>

<span class="c1"># 安装二进制到系统目录</span>
sudo<span class="w"> </span>make<span class="w"> </span>install
</pre>



<p><strong>验证 MyDumper 是否安装成功</strong></p>

<pre><span></span><span class="c1"># 查看 MyDumper 版本号，验证安装</span>
mydumper<span class="w"> </span>--version
</pre>



<hr/>
<h2 id="3">3. 生成测试数据</h2>

<pre><span></span><span class="c1"># 安装 Sysbench 测试工具</span>
sudo<span class="w"> </span>apt<span class="w"> </span>install<span class="w"> </span>-y<span class="w"> </span>sysbench

<span class="c1"># 创建 sbtest 测试数据库</span>
mysql<span class="w"> </span>-uroot<span class="w"> </span>-p666<span class="w"> </span>-e<span class="w"> </span><span class="s2">"CREATE DATABASE IF NOT EXISTS sbtest;"</span>

<span class="c1"># 用 sysbench 生成 8 张表，每张 50 万行（约 1GB 数据）</span>
sysbench<span class="w"> </span><span class="se">\</span>
<span class="w">  </span>--db-driver<span class="o">=</span>mysql<span class="w"> </span><span class="se">\</span>
<span class="w">  </span>--mysql-user<span class="o">=</span>root<span class="w"> </span>--mysql-password<span class="o">=</span><span class="s1">'666'</span><span class="w"> </span><span class="se">\</span>
<span class="w">  </span>--mysql-db<span class="o">=</span>sbtest<span class="w"> </span><span class="se">\</span>
<span class="w">  </span>--tables<span class="o">=</span><span class="m">8</span><span class="w"> </span>--table-size<span class="o">=</span><span class="m">500000</span><span class="w"> </span><span class="se">\</span>
<span class="w">  </span>--threads<span class="o">=</span><span class="m">8</span><span class="w"> </span><span class="se">\</span>
<span class="w">  </span>oltp_insert<span class="w"> </span>prepare
</pre>



<p><strong>验证数据生成成功</strong></p>

<pre><span></span><span class="c1"># 查看 sbtest 数据库下所有表</span>
mysql<span class="w"> </span>-uroot<span class="w"> </span>-p666<span class="w"> </span>-e<span class="w"> </span><span class="s2">"USE sbtest; SHOW TABLES;"</span>

<span class="c1"># 查看 sbtest1 表的数据量</span>
mysql<span class="w"> </span>-uroot<span class="w"> </span>-p666<span class="w"> </span>-e<span class="w"> </span><span class="s2">"USE sbtest; SELECT COUNT(*) FROM sbtest1;"</span>
</pre>



<hr/>
<h2 id="4">4. 备份数据库</h2>

<pre><span></span><span class="c1"># 使用 mydumper 备份 sbtest 数据库到 /tmp/mydump 目录，4 线程，开启压缩</span>
mydumper<span class="w"> </span>-u<span class="w"> </span>root<span class="w"> </span>-p<span class="w"> </span><span class="m">666</span><span class="w"> </span>-B<span class="w"> </span>sbtest<span class="w"> </span>--outputdir<span class="w"> </span>/tmp/mydump<span class="w"> </span>--threads<span class="w"> </span><span class="m">4</span><span class="w"> </span>--compress
</pre>



<p><strong>验证备份结果</strong></p>

<pre><span></span><span class="c1"># 列出备份目录下文件，确认文件已生成</span>
ls<span class="w"> </span>-lh<span class="w"> </span>/tmp/mydump/

<span class="c1"># 查看备份元数据</span>
cat<span class="w"> </span>/tmp/mydump/metadata
</pre>



<hr/>
<h2 id="5">5. 删除并恢复数据库</h2>

<pre><span></span><span class="c1"># 删除 sbtest 数据库，模拟误删或灾难恢复场景</span>
mysql<span class="w"> </span>-uroot<span class="w"> </span>-p666<span class="w"> </span>-e<span class="w"> </span><span class="s2">"DROP DATABASE IF EXISTS sbtest;"</span>

<span class="c1"># 验证 sbtest 数据库确实被删除（返回为空即表示已删除）</span>
mysql<span class="w"> </span>-uroot<span class="w"> </span>-p666<span class="w"> </span>-e<span class="w"> </span><span class="s2">"SHOW DATABASES LIKE 'sbtest';"</span>

<span class="c1"># 用 myloader 从备份目录 /tmp/mydump 恢复 sbtest 数据库，4 线程</span>
myloader<span class="w"> </span>-u<span class="w"> </span>root<span class="w"> </span>-p<span class="w"> </span><span class="m">666</span><span class="w"> </span>-d<span class="w"> </span>/tmp/mydump<span class="w"> </span>--threads<span class="w"> </span><span class="m">4</span>
</pre>



<p><strong>验证恢复结果</strong></p>

<pre><span></span><span class="c1"># 查看 sbtest 数据库是否已恢复</span>
mysql<span class="w"> </span>-uroot<span class="w"> </span>-p666<span class="w"> </span>-e<span class="w"> </span><span class="s2">"SHOW DATABASES LIKE 'sbtest';"</span>

<span class="c1"># 查看 sbtest 下表结构是否恢复</span>
mysql<span class="w"> </span>-uroot<span class="w"> </span>-p666<span class="w"> </span>-e<span class="w"> </span><span class="s2">"USE sbtest; SHOW TABLES;"</span>
</pre>



<hr/>
<h2 id="6">6. 验证数据一致性</h2>

<pre><span></span><span class="c1"># 再次检查 sbtest1 表的数据量，确保数据一致</span>
mysql<span class="w"> </span>-uroot<span class="w"> </span>-p666<span class="w"> </span>-e<span class="w"> </span><span class="s2">"USE sbtest; SELECT COUNT(*) FROM sbtest1;"</span>
</pre>



