---
title: GPU 运维岗位核心关键词汇总
pubDatetime: 2026-11-18T00:00:00Z
description: 汇总 GPU 基础设施运维、集群管理和 AI 推理平台运维的核心技术关键词。
tags: [GPU, 运维, AI Infra]
draft: false
---

本文整理 GPU 运维岗位的核心关键词，以 GPU 硬件、驱动软件栈、集群管理、资源调度、监控排障和自动化运维为线索，重点关注 GPU 基础设施相关技术。

## 一、GPU 专项关键词

| 分类 | 核心关键词 |
| --- | --- |
| GPU 硬件架构 | GPU Architecture、SM、HBM、VRAM、PCIe、NVLink、NVSwitch、SXM |
| NVIDIA 软件栈 | NVIDIA Driver、CUDA、CUDA Toolkit、CUDA Runtime、Fabric Manager |
| GPU 管理工具 | nvidia-smi、NVML、DCGM、DCGM Exporter、NVSM |
| GPU 容器化 | NVIDIA Container Toolkit、NVIDIA Container Runtime、NVIDIA Device Plugin、GPU Operator |
| GPU 资源调度 | Kubernetes GPU Scheduling、Volcano、Kueue、Slurm、HAMi |
| GPU 资源共享 | MIG、MPS、vGPU、Time-Slicing、GPU Passthrough |
| GPU 高速互联 | NVLink、NVSwitch、InfiniBand、RoCE、RDMA、GPUDirect RDMA |
| GPU 分布式通信 | NCCL、NCCL Tests、AllReduce、AllGather、Broadcast |
| GPU 性能分析 | Nsight Systems、Nsight Compute、GPU Utilization、Memory Bandwidth、PCIe Throughput |
| GPU 故障排查 | Xid Errors、ECC Errors、OOM、GPU Reset、Thermal Throttling、Driver Compatibility |
| GPU 集群管理 | NVIDIA GPU Operator、Network Operator、Node Feature Discovery、GPU Feature Discovery |
| GPU 资源优化 | GPU Utilization、GPU Fragmentation、Bin Packing、GPU Oversubscription、Capacity Planning |

## 二、基础设施运维关键词

| 分类 | 核心关键词 |
| --- | --- |
| CI/CD | Jenkins、GitLab CI、GitHub Actions、Argo CD、GitOps |
| 可靠性工程 | SRE、SLA、SLO、SLI、Incident Response、RCA |
| 容量与成本 | Capacity Planning、Resource Quota、FinOps、Cost Optimization |

## 三、AI 推理平台运维关键词

这一部分偏向 AI Infra / 推理平台 SRE，不属于所有 GPU 集群运维岗位的必备技能。

| 分类 | 核心关键词 |
| --- | --- |
| 推理引擎 | vLLM、SGLang、TensorRT-LLM、Triton Inference Server |
| 模型部署 | Model Serving、Inference Server、OpenAI-compatible API |
| 分布式推理 | Tensor Parallelism、Pipeline Parallelism、Ray Serve |
| 推理性能 | TTFT、TPOT、Throughput、Latency、Batching |
| 显存管理 | KV Cache、PagedAttention、Quantization、OOM |
| 流量治理 | Nginx、Envoy、APISIX、Load Balancing、Rate Limiting |
| 服务稳定性 | Autoscaling、HPA、KEDA、Health Check、Rolling Update |
