---
title: "离线迁移测试域 Nacos 数据至 MySQL 8.0.44"
description: "1. 备份原数据库 mysqldump -uroot -p \\ --all-databases \\ --single-transaction \\ --routines --triggers --events \\ > all_databases.sql 2. 联网机器下载依赖并拷贝到离线机器 dnf download n"
pubDatetime: 2025-12-19T07:31:00Z
tags: []
draft: false
---

### 1. 备份原数据库

```text
mysqldump -uroot -p \
  --all-databases \
  --single-transaction \
  --routines --triggers --events \
  > all_databases.sql

```

### 2. 联网机器下载依赖并拷贝到离线机器

```text
dnf download ncurses ncurses-base --resolve --destdir ./ncurses_offline

```

### 3. 离线机器安装依赖

```text
dnf install *.rpm

```

### 4. 下载并解压 MySQL 二进制包

```text
mysql-8.0.44-linux-glibc2.28-x86_64.tar.xz

```

解压到指定目录：

```text
tar -xJf mysql-8.0.44-linux-glibc2.28-x86_64.tar.xz -C /home/nacos/

```

### 5. 停止旧 MySQL 实例

```text
ps auxf | grep mysql
kill -9 <pid>

```

### 6. 无密码方式启动并重置 root 密码

1）跳过权限启动 MySQL：

```text
sudo mysqld_safe --skip-grant-tables --skip-networking &

```

2）登录并修改密码：

```text
mysql -uroot
ALTER USER 'root'@'localhost'
IDENTIFIED BY 'Y8dkYnGJdDbX738t2yCmp7DgMAsfzNUhmu8X3Wf4CJkNVArxpW';
FLUSH PRIVILEGES;

```

3）重启 MySQL

### 7. 启动新 MySQL

```text
/home/nacos/mysql-8.0.44-linux-glibc2.17-x86_64/bin/mysqld \
  --defaults-file=/home/nacos/mysql/my.cnf \
  --basedir=/home/nacos/mysql-8.0.44-linux-glibc2.17-x86_64 \
  --datadir=/home/nacos/mysql/data \
  --plugin-dir=/home/nacos/mysql-8.0.44-linux-glibc2.17-x86_64/lib/plugin \
  --lc-messages-dir=/home/nacos/mysql-8.0.44-linux-glibc2.17-x86_64/share \
  --log-error=/home/nacos/mysql/logs/mysql.err \
  --pid-file=/home/nacos/mysql/logs/mysql.pid \
  --socket=/home/nacos/mysql/logs/mysql.sock \
  --port=3306

```

### 8. 导入原数据库数据

```text
mysql -uroot -p --socket=/home/nacos/mysql/logs/mysql.sock < all_databases.sql

```

### 9. 验证 Nacos 数据与功能

- Nacos 服务启动正常

- 配置、命名空间、历史配置完整

- 客户端能够正常拉取配置
