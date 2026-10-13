---
title: "MyDumper 备份与恢复数据的流程"
description: "MyDumper 是 MySQL 的高性能备份工具，支持多线程导出、压缩和快速恢复。相比 mysqldump，它导出速度更快、对大数据集支持更好，且能并发处理多个表，减少锁表时间。适合生产环境中大规模数据的备份与迁移。 1. 安装 MySQL # 更新软件包索引 sudo apt update # 安装 MySQL S"
pubDatetime: 2025-08-07T14:02:00Z
tags: []
draft: false
---

MyDumper 是 MySQL 的高性能备份工具，支持多线程导出、压缩和快速恢复。相比 mysqldump，它导出速度更快、对大数据集支持更好，且能并发处理多个表，减少锁表时间。适合生产环境中大规模数据的备份与迁移。

---

## 1. 安装 MySQL

```text
# 更新软件包索引
sudo apt update

# 安装 MySQL Server
sudo apt install -y mysql-server

# 修改 root 用户密码为 666，并指定使用 mysql_native_password 插件
sudo mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '666';"

```

**验证 MySQL 是否安装成功**

```text
# 连接 MySQL 并查看版本号，验证服务正常
mysql -uroot -p666 -e "SELECT VERSION();"

```

---

## 2. 安装 MyDumper

```text
# 安装 MyDumper 编译依赖
sudo apt install -y cmake gcc g++ libglib2.0-dev libmysqlclient-dev libpcre3-dev zlib1g-dev

# 克隆 MyDumper 官方源码仓库
git clone https://github.com/mydumper/mydumper.git
cd mydumper

# 编译源码
cmake .
make -j$(nproc)

# 安装二进制到系统目录
sudo make install

```

**验证 MyDumper 是否安装成功**

```text
# 查看 MyDumper 版本号，验证安装
mydumper --version

```

---

## 3. 生成测试数据

```text
# 安装 Sysbench 测试工具
sudo apt install -y sysbench

# 创建 sbtest 测试数据库
mysql -uroot -p666 -e "CREATE DATABASE IF NOT EXISTS sbtest;"

# 用 sysbench 生成 8 张表，每张 50 万行（约 1GB 数据）
sysbench \
  --db-driver=mysql \
  --mysql-user=root --mysql-password='666' \
  --mysql-db=sbtest \
  --tables=8 --table-size=500000 \
  --threads=8 \
  oltp_insert prepare

```

**验证数据生成成功**

```text
# 查看 sbtest 数据库下所有表
mysql -uroot -p666 -e "USE sbtest; SHOW TABLES;"

# 查看 sbtest1 表的数据量
mysql -uroot -p666 -e "USE sbtest; SELECT COUNT(*) FROM sbtest1;"

```

---

## 4. 备份数据库

```text
# 使用 mydumper 备份 sbtest 数据库到 /tmp/mydump 目录，4 线程，开启压缩
mydumper -u root -p 666 -B sbtest --outputdir /tmp/mydump --threads 4 --compress

```

**验证备份结果**

```text
# 列出备份目录下文件，确认文件已生成
ls -lh /tmp/mydump/

# 查看备份元数据
cat /tmp/mydump/metadata

```

---

## 5. 删除并恢复数据库

```text
# 删除 sbtest 数据库，模拟误删或灾难恢复场景
mysql -uroot -p666 -e "DROP DATABASE IF EXISTS sbtest;"

# 验证 sbtest 数据库确实被删除（返回为空即表示已删除）
mysql -uroot -p666 -e "SHOW DATABASES LIKE 'sbtest';"

# 用 myloader 从备份目录 /tmp/mydump 恢复 sbtest 数据库，4 线程
myloader -u root -p 666 -d /tmp/mydump --threads 4

```

**验证恢复结果**

```text
# 查看 sbtest 数据库是否已恢复
mysql -uroot -p666 -e "SHOW DATABASES LIKE 'sbtest';"

# 查看 sbtest 下表结构是否恢复
mysql -uroot -p666 -e "USE sbtest; SHOW TABLES;"

```

---

## 6. 验证数据一致性

```text
# 再次检查 sbtest1 表的数据量，确保数据一致
mysql -uroot -p666 -e "USE sbtest; SELECT COUNT(*) FROM sbtest1;"

```
