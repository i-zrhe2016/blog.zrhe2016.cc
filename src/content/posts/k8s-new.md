---
title: "快速创建k8s单节点集群"
description: "一键安装 git clone https://github.com/ccollicutt/install-kubernetes && cd install-kubernetes && ./install-kubernetes.sh -s 输出 root@k1129:/home/zrh/install-kubernete"
pubDatetime: 2025-11-29T12:16:00Z
tags: []
draft: false
---

<h3 id="">一键安装</h3>

<pre><span></span>git clone https://github.com/ccollicutt/install-kubernetes &amp;&amp; cd install-kubernetes &amp;&amp; ./install-kubernetes.sh -s
</pre>



<h3 id="-1">输出</h3>

<pre><span></span>root@k1129:/home/zrh/install-kubernetes/install-kubernetes# git clone https://github.com/ccollicutt/install-kubernetes &amp;&amp; cd install-kubernetes &amp;&amp; ./install-kubernetes.sh -s
Cloning into 'install-kubernetes'...
remote: Enumerating objects: 115, done.
remote: Counting objects: 100% (28/28), done.
remote: Compressing objects: 100% (18/18), done.
remote: Total 115 (delta 15), reused 18 (delta 9), pack-reused 87 (from 1)
Receiving objects: 100% (115/115), 27.57 KiB | 9.19 MiB/s, done.
Resolving deltas: 100% (55/55), done.
Starting install...
Logging all output to /tmp/install-kubernetes-Lw9gV5Dyaf/install.log
Checking Linux distribution
Disabling swap
Removing packages
Installing required packages
Installing Kubernetes packages
Configuring system
Configuring crictl
Configuring kubelet
Configuring containerd
Installing containerd
Starting services
Configuring control plane node...
Initialising the Kubernetes cluster via Kubeadm
Configuring kubeconfig for root and ubuntu users
Installing Calico CNI
==&gt; Installing Calico tigera-operator
==&gt; Installing Calico custom-resources
Waiting for nodes to be ready...
==&gt; Nodes are ready
Checking Kubernetes version...
Client version: v1.31.0
Server Version: v1.31.0
Requested KUBE_VERSION matches the server version.
Installing metrics server
Configuring as a single node cluster
Configuring as a single node cluster
Deploying test nginx pod
Waiting for all pods to be running...
Install complete!

### Command to add a worker node ###
sha256:1c8a9fc838dae5f9041b2bd37f253a96ed7629df2d1f2376eb57e9118887cb4d 
</pre>



<p>快速安装可以在一个节点上运行的k8s，控制平面和node组件都安装在一个节点上，可以用于短期测试，运行脚本后将自动完成所有配置，容器运行时采用containerd，网络插件是calico。</p>
