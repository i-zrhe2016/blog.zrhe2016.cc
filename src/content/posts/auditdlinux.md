---
title: "auditd记录linux执行过的所有命令"
description: "1. 安装并启动 auditd yum install audit -y systemctl enable --now auditd systemctl status auditd 2. 永久生效：写入规则文件 只记录手动输入的命令 cat >/etc/audit/rules.d/execve-auid.rules <"
pubDatetime: 2025-12-31T03:16:00Z
tags: []
draft: false
---

### 1. 安装并启动 auditd

```text
yum install audit -y
systemctl enable --now auditd
systemctl status auditd

```

### 2. 永久生效：写入规则文件

只记录手动输入的命令

```text
cat >/etc/audit/rules.d/execve-auid.rules <<'EOF'
-a always,exit -F arch=b64 -S execve -S execveat -F auid>=0 -F auid!=4294967295 -k cmdlog
-a always,exit -F arch=b32 -S execve -S execveat -F auid>=0 -F auid!=4294967295 -k cmdlog
EOF
augenrules --load
systemctl restart auditd

```

### 3. 再次确认规则是否加载成功

```text
auditctl -l

```

### 4. 常用查询方式

查看今天的 execve 记录

```text
ausearch -sc execve --start today -i

```

只看最近的几条

```text
ausearch -sc execve --start today -i | tail -n 50

```

一行命令显示

```text
ausearch -sc execve --start today | \
awk '
/^time->/ {t=$0}
/type=EXECVE/{
  cmd=""
  for(i=1;i<=NF;i++){
    if($i ~ /^a[0-9]+=/){
      gsub(/^a[0-9]+=/,"",$i)
      gsub(/"/,"",$i)
      cmd=cmd $i " "
    }
  }
  print t "\nCMD: " cmd "\n----"
}'

```
