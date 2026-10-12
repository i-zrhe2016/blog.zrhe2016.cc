---
title: "aws"
description: "AWS 核心产品介绍 AWS 产品很多，但如果目标是： DevOps 云计算 运维开发 Platform Engineer AI Infra 前期只需要掌握一批核心服务。 1. AWS 核心产品总览 AWS | +-- Compute | +-- EC2 | +-- Lambda | +-- Network | +--"
pubDatetime: 2026-09-05T04:26:00Z
tags: []
draft: false
---

<h1 id="aws">AWS 核心产品介绍</h1><p>AWS 产品很多，但如果目标是：</p>
<ul>
<li>DevOps</li>
<li>云计算</li>
<li>运维开发</li>
<li>Platform Engineer</li>
<li>AI Infra</li>
</ul>
<p>前期只需要掌握一批核心服务。</p>
<hr/>
<h2 id="1-aws">1. AWS 核心产品总览</h2>

<pre><span></span>AWS
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
</pre>



<p>可以把 AWS 简化理解成：</p>

<pre><span></span>Compute
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
</pre>



<hr/>
<h1 id="2-ec2">2. EC2</h1><p>EC2 是 AWS 最核心的计算服务。</p>
<p>简单理解：</p>

<pre><span></span>EC2 = Cloud Server = VPS
</pre>



<p>例如：</p>

<pre><span></span>Internet
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
</pre>



<p>EC2 可以选择：</p>
<ul>
<li>CPU</li>
<li>内存</li>
<li>操作系统</li>
<li>GPU</li>
<li>磁盘</li>
<li>网络</li>
<li>实例规格</li>
</ul>
<p>常见实例类型：</p>
<table>
<thead>
<tr>
<th>系列</th>
<th>用途</th>
</tr>
</thead>
<tbody>
<tr>
<td>T</td>
<td>低成本、突发型</td>
</tr>
<tr>
<td>M</td>
<td>通用型</td>
</tr>
<tr>
<td>C</td>
<td>CPU 计算型</td>
</tr>
<tr>
<td>R</td>
<td>内存型</td>
</tr>
<tr>
<td>I</td>
<td>存储型</td>
</tr>
<tr>
<td>G</td>
<td>GPU</td>
</tr>
<tr>
<td>P</td>
<td>AI / HPC GPU</td>
</tr>
</tbody>
</table>
<hr/>
<h1 id="3-vpc">3. VPC</h1><p>VPC 是 AWS 网络的核心。</p>
<p>可以理解为：</p>

<pre><span></span>VPC = Your private data center network in AWS
</pre>



<p>典型结构：</p>

<pre><span></span>                Internet
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
</pre>



<p>学习 VPC 时重点理解：</p>

<pre><span></span>CIDR
Subnet
Route Table
Internet Gateway
NAT Gateway
Security Group
Network ACL
Elastic IP
</pre>



<hr/>
<h1 id="4-s3">4. S3</h1><p>S3 是对象存储。</p>
<p>典型用途：</p>

<pre><span></span>S3
|
+-- images
+-- videos
+-- backups
+-- logs
+-- datasets
+-- AI models
+-- static files
</pre>



<p>可以理解成：</p>

<pre><span></span>S3 = Object Storage
</pre>



<p>它不是传统 Linux 文件系统。</p>
<p>常见访问方式：</p>

<pre><span></span>Application
    |
    +-- AWS SDK
    +-- AWS CLI
    +-- HTTP API
    |
    v
   S3
</pre>



<hr/>
<h1 id="5-ebs">5. EBS</h1><p>EBS 是 EC2 使用的块存储。</p>
<p>最简单的理解：</p>

<pre><span></span>EC2 = Computer

EBS = SSD
</pre>



<p>例如：</p>

<pre><span></span>+-------------+
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
</pre>



<p>EBS 和 S3 的区别：</p>
<table>
<thead>
<tr>
<th></th>
<th>EBS</th>
<th>S3</th>
</tr>
</thead>
<tbody>
<tr>
<td>类型</td>
<td>Block Storage</td>
<td>Object Storage</td>
</tr>
<tr>
<td>类似</td>
<td>SSD</td>
<td>对象存储</td>
</tr>
<tr>
<td>主要用途</td>
<td>系统盘/数据盘</td>
<td>文件/备份/对象</td>
</tr>
<tr>
<td>文件系统</td>
<td>支持</td>
<td>非传统文件系统</td>
</tr>
</tbody>
</table>
<hr/>
<h1 id="6-elb">6. ELB</h1><p>ELB 是负载均衡服务。</p>
<p>基本结构：</p>

<pre><span></span>             Users
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
</pre>



<p>主要类型：</p>
<table>
<thead>
<tr>
<th>服务</th>
<th>网络层</th>
<th>用途</th>
</tr>
</thead>
<tbody>
<tr>
<td>ALB</td>
<td>L7</td>
<td>HTTP / HTTPS</td>
</tr>
<tr>
<td>NLB</td>
<td>L4</td>
<td>TCP / UDP</td>
</tr>
<tr>
<td>GWLB</td>
<td>网络层</td>
<td>安全设备</td>
</tr>
</tbody>
</table>
<p>最常见的是：</p>

<pre><span></span>ALB
NLB
</pre>



<hr/>
<h1 id="7-route-53">7. Route 53</h1><p>Route 53 是 AWS 的 DNS 服务。</p>
<p>例如：</p>

<pre><span></span>User
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
</pre>



<p>主要功能：</p>
<ul>
<li>DNS</li>
<li>域名解析</li>
<li>流量路由</li>
<li>健康检查</li>
<li>域名注册</li>
</ul>
<hr/>
<h1 id="8-iam">8. IAM</h1><p>IAM 是 AWS 权限系统。</p>
<p>核心问题是：</p>

<pre><span></span>Who
can do
What
on
Which Resource
</pre>



<p>例如：</p>

<pre><span></span>EC2
 |
 v
IAM Role
 |
 v
IAM Policy
 |
 v
S3
</pre>



<p>意思是：</p>

<pre><span></span>EC2
  |
  +-- Assume IAM Role
          |
          +-- Allow s3:GetObject
                     |
                     v
                    S3
</pre>



<p>IAM 核心概念：</p>

<pre><span></span>User
Group
Role
Policy
Permission
STS
AssumeRole
Least Privilege
</pre>



<p>IAM 是 AWS 最重要的知识之一。</p>
<hr/>
<h1 id="9-rds">9. RDS</h1><p>RDS 是托管关系型数据库。</p>
<p>支持：</p>

<pre><span></span>MySQL
PostgreSQL
MariaDB
Oracle
SQL Server
</pre>



<p>典型结构：</p>

<pre><span></span>Application
    |
    v
+-------------+
| RDS         |
|             |
| PostgreSQL  |
| MySQL       |
+-------------+
</pre>



<p>AWS 可以帮助处理：</p>
<ul>
<li>备份</li>
<li>数据库服务器</li>
<li>高可用</li>
<li>故障切换</li>
<li>版本维护</li>
</ul>
<hr/>
<h1 id="10-aurora">10. Aurora</h1><p>Aurora 是 AWS 自己设计的云原生关系型数据库。</p>
<p>兼容：</p>

<pre><span></span>MySQL
PostgreSQL
</pre>



<p>可以简单理解成：</p>

<pre><span></span>Aurora
  =
AWS optimized
MySQL / PostgreSQL
</pre>



<hr/>
<h1 id="11-elasticache">11. ElastiCache</h1><p>ElastiCache 是托管缓存服务。</p>
<p>主要用于：</p>

<pre><span></span>Redis
Valkey
</pre>



<p>典型架构：</p>

<pre><span></span>             +----------------+
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
</pre>



<p>常见用途：</p>
<ul>
<li>Cache</li>
<li>Session</li>
<li>Token</li>
<li>Rate Limit</li>
<li>排行榜</li>
<li>热点数据</li>
</ul>
<hr/>
<h1 id="12-ecr">12. ECR</h1><p>ECR 是 AWS 的容器镜像仓库。</p>
<p>类似：</p>

<pre><span></span>Docker Hub
Harbor
GitHub Container Registry
</pre>



<p>CI/CD 常见流程：</p>

<pre><span></span>Source Code
    |
    v
docker build
    |
    v
Amazon ECR
    |
    v
ECS / EKS
</pre>



<hr/>
<h1 id="13-ecs">13. ECS</h1><p>ECS 是 AWS 自己的容器编排平台。</p>
<p>简单理解：</p>

<pre><span></span>ECS = AWS Container Platform
</pre>



<p>基本结构：</p>

<pre><span></span>Docker Image
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
</pre>



<p>两种典型方式：</p>

<pre><span></span>ECS + EC2
</pre>



<p>你管理服务器。</p>

<pre><span></span>ECS + Fargate
</pre>



<p>AWS 管理底层服务器。</p>
<p>如果不需要 Kubernetes：</p>

<pre><span></span>ECS is usually simpler than EKS
</pre>



<hr/>
<h1 id="14-eks">14. EKS</h1><p>EKS 是 AWS 的托管 Kubernetes。</p>
<p>简单理解：</p>

<pre><span></span>EKS = Kubernetes on AWS
</pre>



<p>结构：</p>

<pre><span></span>          +----------------------+
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
</pre>



<p>学习 EKS 的核心不是重新学习 Kubernetes。</p>
<p>而是理解：</p>

<pre><span></span>Kubernetes
    +
AWS Services
</pre>



<p>具体是：</p>

<pre><span></span>EKS
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
</pre>



<hr/>
<h1 id="15-cloudwatch">15. CloudWatch</h1><p>CloudWatch 是 AWS 的监控系统。</p>
<p>它主要负责：</p>

<pre><span></span>Metrics
Logs
Alarms
Dashboards
Events
</pre>



<p>结构：</p>

<pre><span></span>EC2 ----+
EKS ----+
RDS ----+----&gt; CloudWatch
ALB ----+          |
                   +-- Metrics
                   +-- Logs
                   +-- Alarm
                   +-- Dashboard
</pre>



<p>如果熟悉：</p>

<pre><span></span>Prometheus
Grafana
Loki
</pre>



<p>理解 CloudWatch 会比较容易。</p>
<hr/>
<h1 id="16-cloudtrail">16. CloudTrail</h1><p>CloudTrail 用于记录 AWS API 操作。</p>
<p>例如：</p>

<pre><span></span>User
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
</pre>



<p>CloudWatch 和 CloudTrail 可以这样区分：</p>
<table>
<thead>
<tr>
<th>服务</th>
<th>关注点</th>
</tr>
</thead>
<tbody>
<tr>
<td>CloudWatch</td>
<td>系统运行得怎么样</td>
</tr>
<tr>
<td>CloudTrail</td>
<td>谁对 AWS 做了什么</td>
</tr>
</tbody>
</table>
<hr/>
<h1 id="17-lambda">17. Lambda</h1><p>Lambda 是 Serverless 服务。</p>
<p>核心思想：</p>

<pre><span></span>Run code
without managing servers
</pre>



<p>例如：</p>

<pre><span></span>Upload Image
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
</pre>



<p>常见用途：</p>
<ul>
<li>自动化</li>
<li>API</li>
<li>文件处理</li>
<li>定时任务</li>
<li>Event Handler</li>
<li>Serverless Backend</li>
</ul>
<hr/>
<h1 id="18-sqs">18. SQS</h1><p>SQS 是消息队列。</p>
<p>典型结构：</p>

<pre><span></span>Web API
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
</pre>



<p>作用：</p>

<pre><span></span>Async Processing
      +
Service Decoupling
</pre>



<hr/>
<h1 id="19-sns">19. SNS</h1><p>SNS 是发布订阅服务。</p>
<p>可以理解为：</p>

<pre><span></span>SNS = Pub/Sub
</pre>



<p>例如：</p>

<pre><span></span>Application
     |
     v
    SNS
  /  |  \
 /   |   \
v    v    v
Email SQS Lambda
</pre>



<p>可以简单记：</p>

<pre><span></span>SQS = Queue

SNS = Pub/Sub
</pre>



<hr/>
<h1 id="20-aws">20. AWS 生产环境完整架构</h1><p>一个比较典型的 AWS Web / API 架构：</p>

<pre><span></span>                       Internet
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
</pre>



<p>CI/CD：</p>

<pre><span></span>GitHub
  |
  v
Build
  |
  v
ECR
  |
  v
EKS
</pre>



<p>权限：</p>

<pre><span></span>IAM
 |
 +-- EC2
 +-- EKS
 +-- S3
 +-- RDS
 +-- Lambda
</pre>



<hr/>
<h1 id="21-aws">21. 从传统运维角度理解 AWS</h1><table>
<thead>
<tr>
<th>传统技术</th>
<th>AWS</th>
</tr>
</thead>
<tbody>
<tr>
<td>VMware / VPS</td>
<td>EC2</td>
</tr>
<tr>
<td>VLAN / 私有网络</td>
<td>VPC</td>
</tr>
<tr>
<td>Firewall</td>
<td>Security Group</td>
</tr>
<tr>
<td>Nginx / LVS</td>
<td>ALB / NLB</td>
</tr>
<tr>
<td>Ceph Object</td>
<td>S3</td>
</tr>
<tr>
<td>云硬盘 / SAN</td>
<td>EBS</td>
</tr>
<tr>
<td>NFS</td>
<td>EFS</td>
</tr>
<tr>
<td>MySQL</td>
<td>RDS</td>
</tr>
<tr>
<td>Redis</td>
<td>ElastiCache</td>
</tr>
<tr>
<td>Harbor</td>
<td>ECR</td>
</tr>
<tr>
<td>Docker 平台</td>
<td>ECS</td>
</tr>
<tr>
<td>Kubernetes</td>
<td>EKS</td>
</tr>
<tr>
<td>Prometheus / Grafana</td>
<td>CloudWatch</td>
</tr>
<tr>
<td>Audit Log</td>
<td>CloudTrail</td>
</tr>
<tr>
<td>DNS</td>
<td>Route 53</td>
</tr>
<tr>
<td>RBAC / 权限</td>
<td>IAM</td>
</tr>
</tbody>
</table>
<hr/>
<h1 id="22">22. 推荐学习顺序</h1><p>不要一上来学 AWS 几百个产品。</p>
<p>推荐：</p>

<pre><span></span>IAM
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
</pre>



<p>可以分成三阶段。</p>
<h2 id="aws-1">第一阶段：AWS 基础</h2>

<pre><span></span>IAM
EC2
EBS
S3
VPC
Security Group
ALB
Route 53
</pre>



<h2 id="">第二阶段：生产环境</h2>

<pre><span></span>RDS
Aurora
ElastiCache
CloudWatch
CloudTrail
Auto Scaling
</pre>



<h2 id="cloud-native">第三阶段：Cloud Native</h2>

<pre><span></span>ECR
ECS
EKS
Terraform
CI/CD
</pre>



<hr/>
<h1 id="23">23. 最终需要掌握的架构</h1><p>对于 DevOps / Platform Engineer / AI Infra，最终至少要能独立理解和搭建：</p>

<pre><span></span>Route 53
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
</pre>



<p>同时掌握：</p>

<pre><span></span>IAM
VPC
ECR
Terraform
</pre>



<p>掌握这一套之后，再继续学习：</p>

<pre><span></span>Lambda
SQS
SNS
Bedrock
SageMaker
GPU EC2
</pre>



<p>会容易很多。</p>
<p>简单总结：</p>
<table>
<thead>
<tr>
<th>类别</th>
<th>试用金可用</th>
<th>典型服务</th>
</tr>
</thead>
<tbody>
<tr>
<td>计算</td>
<td>✅</td>
<td>EC2、Lambda</td>
</tr>
<tr>
<td>存储</td>
<td>✅</td>
<td>EBS、S3</td>
</tr>
<tr>
<td>网络</td>
<td>✅</td>
<td>VPC、ALB、NLB、NAT Gateway、Route 53</td>
</tr>
<tr>
<td>数据库</td>
<td>✅</td>
<td>RDS、Aurora</td>
</tr>
<tr>
<td>容器</td>
<td>✅</td>
<td>ECR、ECS；EKS需特别注意费用</td>
</tr>
<tr>
<td>监控</td>
<td>✅</td>
<td>CloudWatch、CloudTrail</td>
</tr>
<tr>
<td>AI/ML</td>
<td>部分可用</td>
<td>Bedrock、SageMaker</td>
</tr>
</tbody>
</table>
<p>核心结论：</p>

<pre><span></span>$200 Credits
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
</pre>



<p>最适合你用来学习：</p>

<pre><span></span>VPC
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
</pre>



<p>然后再学：</p>

<pre><span></span>ECR -&gt; ECS -&gt; EKS
</pre>



<p>最容易烧掉试用金的通常是：</p>

<pre><span></span>GPU EC2
EKS
NAT Gateway
大型 EC2
大容量 EBS
RDS
</pre>



<p>所以如果目标是学 AWS，建议先用普通 EC2 + VPC + S3 + RDS，把基础架构跑通，再碰 EKS 和 GPU。</p>
