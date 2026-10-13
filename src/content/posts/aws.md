---
title: "aws"
description: "AWS 核心产品介绍 AWS 产品很多，但如果目标是： DevOps 云计算 运维开发 Platform Engineer AI Infra 前期只需要掌握一批核心服务。 1. AWS 核心产品总览 AWS | +-- Compute | +-- EC2 | +-- Lambda | +-- Network | +--"
pubDatetime: 2026-09-05T04:26:00Z
tags: []
draft: false
---

# AWS 核心产品介绍

AWS 产品很多，但如果目标是：

- DevOps

- 云计算

- 运维开发

- Platform Engineer

- AI Infra

前期只需要掌握一批核心服务。

---

## 1. AWS 核心产品总览

```text
AWS
|
+-- Compute
|   +-- EC2
|   +-- Lambda
|
+-- Network
|   +-- VPC
|   +-- ALB / NLB
|   +-- Route 53
|
+-- Storage
|   +-- S3
|   +-- EBS
|   +-- EFS
|
+-- Database
|   +-- RDS
|   +-- Aurora
|   +-- ElastiCache
|
+-- Container
|   +-- ECR
|   +-- ECS
|   +-- EKS
|
+-- Security
|   +-- IAM
|
+-- Observability
    +-- CloudWatch
    +-- CloudTrail

```

可以把 AWS 简化理解成：

```text
Compute
   +
Network
   +
Storage
   +
Database
   +
Security
   +
Monitoring

```

---

# 2. EC2

EC2 是 AWS 最核心的计算服务。

简单理解：

```text
EC2 = Cloud Server = VPS

```

例如：

```text
Internet
   |
   v
+-------------------+
| EC2 Instance      |
|                   |
| Ubuntu Linux      |
| 4 vCPU            |
| 16 GB RAM         |
|                   |
+---------+---------+
          |
          v
     +---------+
     | EBS     |
     | 100 GB  |
     +---------+

```

EC2 可以选择：

- CPU

- 内存

- 操作系统

- GPU

- 磁盘

- 网络

- 实例规格

常见实例类型：

| 系列 | 用途 |
| --- | --- |
| T | 低成本、突发型 |
| M | 通用型 |
| C | CPU 计算型 |
| R | 内存型 |
| I | 存储型 |
| G | GPU |
| P | AI / HPC GPU |

---

# 3. VPC

VPC 是 AWS 网络的核心。

可以理解为：

```text
VPC = Your private data center network in AWS

```

典型结构：

```text
                Internet
                    |
                    v
          +-------------------+
          | Internet Gateway  |
          +---------+---------+
                    |
                    v

+---------------------------------------+
| VPC 10.0.0.0/16                      |
|                                       |
|  Public Subnet                        |
|  +-------------+    +--------------+  |
|  | ALB         |    | NAT Gateway  |  |
|  +------+------+    +------+-------+  |
|         |                  |           |
|         |                  |           |
|  -------+------------------+--------   |
|                                       |
|  Private Subnet                       |
|  +---------+ +---------+ +---------+  |
|  | EC2     | | EKS     | | RDS     |  |
|  +---------+ +---------+ +---------+  |
|                                       |
+---------------------------------------+

```

学习 VPC 时重点理解：

```text
CIDR
Subnet
Route Table
Internet Gateway
NAT Gateway
Security Group
Network ACL
Elastic IP

```

---

# 4. S3

S3 是对象存储。

典型用途：

```text
S3
|
+-- images
+-- videos
+-- backups
+-- logs
+-- datasets
+-- AI models
+-- static files

```

可以理解成：

```text
S3 = Object Storage

```

它不是传统 Linux 文件系统。

常见访问方式：

```text
Application
    |
    +-- AWS SDK
    +-- AWS CLI
    +-- HTTP API
    |
    v
   S3

```

---

# 5. EBS

EBS 是 EC2 使用的块存储。

最简单的理解：

```text
EC2 = Computer

EBS = SSD

```

例如：

```text
+-------------+
| EC2         |
+------+------+
       |
       +----------+
       |          |
       v          v
  +---------+ +---------+
  | EBS     | | EBS     |
  | 100 GB  | | 500 GB  |
  +---------+ +---------+

```

EBS 和 S3 的区别：

|  | EBS | S3 |
| --- | --- | --- |
| 类型 | Block Storage | Object Storage |
| 类似 | SSD | 对象存储 |
| 主要用途 | 系统盘/数据盘 | 文件/备份/对象 |
| 文件系统 | 支持 | 非传统文件系统 |

---

# 6. ELB

ELB 是负载均衡服务。

基本结构：

```text
             Users
               |
               v
        +-------------+
        | ALB / NLB   |
        +------+------+ 
               |
       +-------+-------+
       |       |       |
       v       v       v
    +-----+ +-----+ +-----+
    | EC2 | | EC2 | | EC2 |
    +-----+ +-----+ +-----+

```

主要类型：

| 服务 | 网络层 | 用途 |
| --- | --- | --- |
| ALB | L7 | HTTP / HTTPS |
| NLB | L4 | TCP / UDP |
| GWLB | 网络层 | 安全设备 |

最常见的是：

```text
ALB
NLB

```

---

# 7. Route 53

Route 53 是 AWS 的 DNS 服务。

例如：

```text
User
 |
 v
api.example.com
 |
 v
Route 53
 |
 v
ALB
 |
 v
EC2 / ECS / EKS

```

主要功能：

- DNS

- 域名解析

- 流量路由

- 健康检查

- 域名注册

---

# 8. IAM

IAM 是 AWS 权限系统。

核心问题是：

```text
Who
can do
What
on
Which Resource

```

例如：

```text
EC2
 |
 v
IAM Role
 |
 v
IAM Policy
 |
 v
S3

```

意思是：

```text
EC2
  |
  +-- Assume IAM Role
          |
          +-- Allow s3:GetObject
                     |
                     v
                    S3

```

IAM 核心概念：

```text
User
Group
Role
Policy
Permission
STS
AssumeRole
Least Privilege

```

IAM 是 AWS 最重要的知识之一。

---

# 9. RDS

RDS 是托管关系型数据库。

支持：

```text
MySQL
PostgreSQL
MariaDB
Oracle
SQL Server

```

典型结构：

```text
Application
    |
    v
+-------------+
| RDS         |
|             |
| PostgreSQL  |
| MySQL       |
+-------------+

```

AWS 可以帮助处理：

- 备份

- 数据库服务器

- 高可用

- 故障切换

- 版本维护

---

# 10. Aurora

Aurora 是 AWS 自己设计的云原生关系型数据库。

兼容：

```text
MySQL
PostgreSQL

```

可以简单理解成：

```text
Aurora
  =
AWS optimized
MySQL / PostgreSQL

```

---

# 11. ElastiCache

ElastiCache 是托管缓存服务。

主要用于：

```text
Redis
Valkey

```

典型架构：

```text
             +----------------+
             | Application    |
             +-------+--------+
                     |
          +----------+----------+
          |                     |
          v                     v
   +-------------+       +-------------+
   | ElastiCache |       | RDS         |
   | Redis       |       | PostgreSQL  |
   +-------------+       +-------------+

```

常见用途：

- Cache

- Session

- Token

- Rate Limit

- 排行榜

- 热点数据

---

# 12. ECR

ECR 是 AWS 的容器镜像仓库。

类似：

```text
Docker Hub
Harbor
GitHub Container Registry

```

CI/CD 常见流程：

```text
Source Code
    |
    v
docker build
    |
    v
Amazon ECR
    |
    v
ECS / EKS

```

---

# 13. ECS

ECS 是 AWS 自己的容器编排平台。

简单理解：

```text
ECS = AWS Container Platform

```

基本结构：

```text
Docker Image
     |
     v
    ECR
     |
     v
    ECS
   /   \
  /     \
 v       v
EC2   Fargate

```

两种典型方式：

```text
ECS + EC2

```

你管理服务器。

```text
ECS + Fargate

```

AWS 管理底层服务器。

如果不需要 Kubernetes：

```text
ECS is usually simpler than EKS

```

---

# 14. EKS

EKS 是 AWS 的托管 Kubernetes。

简单理解：

```text
EKS = Kubernetes on AWS

```

结构：

```text
          +----------------------+
          | EKS Control Plane    |
          +----------+-----------+
                     |
          +----------+----------+
          |                     |
          v                     v
   +-------------+       +-------------+
   | Node Group  |       | Node Group  |
   +------+------+       +------+------+
          |                     |
       +--+--+               +--+--+
       |     |               |     |
       v     v               v     v
      EC2   EC2             EC2   EC2
       |     |               |     |
      Pods  Pods            Pods  Pods

```

学习 EKS 的核心不是重新学习 Kubernetes。

而是理解：

```text
Kubernetes
    +
AWS Services

```

具体是：

```text
EKS
 |
 +-- VPC
 +-- IAM
 +-- EC2
 +-- EBS
 +-- EFS
 +-- ECR
 +-- ALB
 +-- NLB
 +-- CloudWatch

```

---

# 15. CloudWatch

CloudWatch 是 AWS 的监控系统。

它主要负责：

```text
Metrics
Logs
Alarms
Dashboards
Events

```

结构：

```text
EC2 ----+
EKS ----+
RDS ----+----> CloudWatch
ALB ----+          |
                   +-- Metrics
                   +-- Logs
                   +-- Alarm
                   +-- Dashboard

```

如果熟悉：

```text
Prometheus
Grafana
Loki

```

理解 CloudWatch 会比较容易。

---

# 16. CloudTrail

CloudTrail 用于记录 AWS API 操作。

例如：

```text
User
 |
 v
Delete EC2
 |
 v
CloudTrail
 |
 +-- Who
 +-- When
 +-- Source IP
 +-- API
 +-- Resource

```

CloudWatch 和 CloudTrail 可以这样区分：

| 服务 | 关注点 |
| --- | --- |
| CloudWatch | 系统运行得怎么样 |
| CloudTrail | 谁对 AWS 做了什么 |

---

# 17. Lambda

Lambda 是 Serverless 服务。

核心思想：

```text
Run code
without managing servers

```

例如：

```text
Upload Image
     |
     v
    S3
     |
     v
  Lambda
     |
     v
Process Image
     |
     v
    S3

```

常见用途：

- 自动化

- API

- 文件处理

- 定时任务

- Event Handler

- Serverless Backend

---

# 18. SQS

SQS 是消息队列。

典型结构：

```text
Web API
   |
   v
+---------+
| SQS     |
| Queue   |
+----+----+
     |
 +---+---+
 |   |   |
 v   v   v
W1  W2  W3

```

作用：

```text
Async Processing
      +
Service Decoupling

```

---

# 19. SNS

SNS 是发布订阅服务。

可以理解为：

```text
SNS = Pub/Sub

```

例如：

```text
Application
     |
     v
    SNS
  /  |  \
 /   |   \
v    v    v
Email SQS Lambda

```

可以简单记：

```text
SQS = Queue

SNS = Pub/Sub

```

---

# 20. AWS 生产环境完整架构

一个比较典型的 AWS Web / API 架构：

```text
                       Internet
                          |
                          v
                     Route 53
                          |
                          v
                         ALB
                          |
        +-----------------+-----------------+
        |                                   |
        |            Amazon VPC             |
        |                                   |
        |   Public Subnet                   |
        |   +---------------------------+   |
        |   | ALB                       |   |
        |   | NAT Gateway               |   |
        |   +-------------+-------------+   |
        |                 |                 |
        |-----------------------------------|
        |                 |                 |
        |   Private Subnet                  |
        |                                   |
        |       +-------------------+       |
        |       | Amazon EKS        |       |
        |       |                   |       |
        |       | Pod Pod Pod       |       |
        |       +---------+---------+       |
        |                 |                 |
        |          +------+-------+         |
        |          |              |         |
        |          v              v         |
        |      +------+      +---------+    |
        |      | RDS  |      | Redis   |    |
        |      +------+      +---------+    |
        |                                   |
        +-----------------------------------+
                          |
                 +--------+--------+
                 |                 |
                 v                 v
                S3            CloudWatch

```

CI/CD：

```text
GitHub
  |
  v
Build
  |
  v
ECR
  |
  v
EKS

```

权限：

```text
IAM
 |
 +-- EC2
 +-- EKS
 +-- S3
 +-- RDS
 +-- Lambda

```

---

# 21. 从传统运维角度理解 AWS

| 传统技术 | AWS |
| --- | --- |
| VMware / VPS | EC2 |
| VLAN / 私有网络 | VPC |
| Firewall | Security Group |
| Nginx / LVS | ALB / NLB |
| Ceph Object | S3 |
| 云硬盘 / SAN | EBS |
| NFS | EFS |
| MySQL | RDS |
| Redis | ElastiCache |
| Harbor | ECR |
| Docker 平台 | ECS |
| Kubernetes | EKS |
| Prometheus / Grafana | CloudWatch |
| Audit Log | CloudTrail |
| DNS | Route 53 |
| RBAC / 权限 | IAM |

---

# 22. 推荐学习顺序

不要一上来学 AWS 几百个产品。

推荐：

```text
IAM
 |
 v
EC2
 |
 v
EBS / S3
 |
 v
VPC
 |
 v
Security Group
 |
 v
ALB / NLB
 |
 v
Route 53
 |
 v
RDS
 |
 v
CloudWatch
 |
 v
ECR
 |
 v
ECS
 |
 v
EKS
 |
 v
Terraform

```

可以分成三阶段。

## 第一阶段：AWS 基础

```text
IAM
EC2
EBS
S3
VPC
Security Group
ALB
Route 53

```

## 第二阶段：生产环境

```text
RDS
Aurora
ElastiCache
CloudWatch
CloudTrail
Auto Scaling

```

## 第三阶段：Cloud Native

```text
ECR
ECS
EKS
Terraform
CI/CD

```

---

# 23. 最终需要掌握的架构

对于 DevOps / Platform Engineer / AI Infra，最终至少要能独立理解和搭建：

```text
Route 53
    |
    v
   ALB
    |
    v
   EKS
    |
    v
Application
    |
 +--+------+------+
 |         |      |
 v         v      v
RDS      Redis    S3
 |
 v
CloudWatch

```

同时掌握：

```text
IAM
VPC
ECR
Terraform

```

掌握这一套之后，再继续学习：

```text
Lambda
SQS
SNS
Bedrock
SageMaker
GPU EC2

```

会容易很多。

简单总结：

| 类别 | 试用金可用 | 典型服务 |
| --- | --- | --- |
| 计算 | ✅ | EC2、Lambda |
| 存储 | ✅ | EBS、S3 |
| 网络 | ✅ | VPC、ALB、NLB、NAT Gateway、Route 53 |
| 数据库 | ✅ | RDS、Aurora |
| 容器 | ✅ | ECR、ECS；EKS需特别注意费用 |
| 监控 | ✅ | CloudWatch、CloudTrail |
| AI/ML | 部分可用 | Bedrock、SageMaker |

核心结论：

```text
$200 Credits
    |
    +-- EC2
    +-- EBS
    +-- S3
    +-- VPC
    +-- ALB/NLB
    +-- RDS
    +-- ECR/ECS
    +-- CloudWatch
    +-- 部分 AI 服务

```

最适合你用来学习：

```text
VPC
 |
EC2
 |
ALB
 |
RDS
 |
S3
 |
CloudWatch

```

然后再学：

```text
ECR -> ECS -> EKS

```

最容易烧掉试用金的通常是：

```text
GPU EC2
EKS
NAT Gateway
大型 EC2
大容量 EBS
RDS

```

所以如果目标是学 AWS，建议先用普通 EC2 + VPC + S3 + RDS，把基础架构跑通，再碰 EKS 和 GPU。
