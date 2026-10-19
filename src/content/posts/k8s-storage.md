---
title: "k8s存储机制"
description: "面向应用开发者，理解 Volume、PV/PVC、StorageClass、访问模式与回收策略，并通过示例使用 Kubernetes 持久化存储。"
pubDatetime: 2026-10-19T00:00:00+08:00
tags:
  - kubernetes
  - storage
draft: false
---

Kubernetes（K8s）通过 Volume 向容器提供存储。应用通常只需声明需要多大空间、如何访问，再把它挂载到容器目录中。

理解存储的主线是：**用 PVC 申请存储，通过 Volume 把存储交给 Pod 中的容器使用。**

## 一、为什么需要 Volume？

容器自身的可写数据不应被当作持久化数据：容器被替换或重新创建后，这些数据可能丢失。Volume 将应用使用的数据与容器自身的文件系统分开，但能保留多久取决于卷的类型。

| 类型                    | 数据生命周期                                                   | 常见用途                           |
| ----------------------- | -------------------------------------------------------------- | ---------------------------------- |
| `emptyDir`              | 同一 Pod 内容器重启后仍保留；Pod 被删除或移出节点后清理        | 缓存、临时文件、容器间共享临时数据 |
| `configMap`、`secret`   | 内容来自对应的配置资源，不用于保存应用写入的数据               | 配置文件、凭证                     |
| `persistentVolumeClaim` | 数据可独立于 Pod 存在，最终取决于 PVC、PV 和存储资源的保留情况 | 数据库、需要长期保存的文件         |

因此，临时文件可以使用 `emptyDir`；需要在 Pod 重建后继续使用的数据，应选择持久化存储。

## 二、PV、PVC 与 StorageClass

这三个对象分别回答不同的问题：

| 对象                         | 含义                                               | 主要由谁关注                 |
| ---------------------------- | -------------------------------------------------- | ---------------------------- |
| PVC（PersistentVolumeClaim） | 存储申请单：需要多大容量、哪种访问模式和存储类别   | 应用开发者                   |
| PV（PersistentVolume）       | 可供分配的存储资源，记录容量、访问能力和回收策略等 | 集群管理员，或由系统自动管理 |
| StorageClass                 | 存储供给策略：使用哪类存储、如何创建和回收         | 集群管理员配置，开发者选择   |

PVC 属于命名空间，PV 和 StorageClass 属于集群。Pod 使用的 PVC 必须与 Pod 在同一命名空间；一个 PVC 与一个 PV 一对一绑定。

存储有两种供给方式：

- **静态供给**：管理员先准备存储和 PV，再由 PVC 匹配合适的 PV。
- **动态供给**：PVC 选择支持动态供给的 StorageClass，系统按需创建存储和 PV，再完成绑定。

CSI 驱动负责把 Kubernetes 的存储操作转换为具体存储系统能够执行的操作。

开发者通常不需要手动创建 PV，也不需要为每个应用新建 StorageClass；优先选择集群已经提供的存储类别。

## 三、Pod 如何使用存储？

```text
StorageClass（供给策略）
       │ 动态供给时使用
       ▼
PVC（申请） ──绑定── PV（存储资源）
       ▲
       │ volumes 引用 PVC
      Pod
       └── 容器通过 volumeMounts 挂载到 mountPath
```

Pod 配置中的三个字段各司其职：

- `spec.volumes`：声明 Pod 使用的卷，例如引用某个 PVC。
- 容器的 `volumeMounts`：通过卷名选择要挂载的卷。
- `mountPath`：容器内访问数据的目录，例如 `/data`。

`volumes[].name` 与 `volumeMounts[].name` 必须一致；`claimName` 对应 PVC 的名称。卷名只是 Pod 内部的关联名称，不必与 PVC 同名。

同一 Pod 内的多个容器可以挂载同一个卷。多个 Pod 能否同时使用一个 PVC，则取决于访问模式、存储能力及调度约束。

## 四、常用配置怎么选？

### 访问模式：谁可以使用这份存储？

| 模式                       | 含义            | 适用需求                            |
| -------------------------- | --------------- | ----------------------------------- |
| `ReadWriteOnce`（RWO）     | 单节点读写      | 常见的独立数据卷                    |
| `ReadOnlyMany`（ROX）      | 多节点只读      | 多个节点读取同一份数据              |
| `ReadWriteMany`（RWX）     | 多节点读写      | 跨节点共享文件                      |
| `ReadWriteOncePod`（RWOP） | 单 Pod 独占读写 | 要求整个集群中只有一个 Pod 使用该卷 |

**RWO 限制的是节点，不是 Pod 数量。** 同一节点上的多个 Pod 在存储和挂载条件允许时，可以使用同一个 RWO 卷。RWOP 需要支持该模式的 CSI 存储驱动。

并非每种存储都支持全部模式。RWX 也不会自动解决应用并发写入冲突，应用仍需处理锁或事务；访问模式不能替代文件权限和只读挂载设置。

### 延迟绑定：先考虑 Pod 要运行在哪里

StorageClass 的 `volumeBindingMode` 有两种常见值：

- `Immediate`：PVC 创建后就匹配或创建存储。
- `WaitForFirstConsumer`：出现使用 PVC 的 Pod 后，再结合调度条件选择或创建存储。

有节点或可用区限制的存储通常适合延迟绑定。因此，使用 `WaitForFirstConsumer` 时，**尚未创建 Pod 的 PVC 处于 Pending 可能是正常等待**。

### 回收策略：删除 PVC 会不会删数据？

| PV 回收策略 | PVC 删除并释放 PV 后的行为                       |
| ----------- | ------------------------------------------------ |
| `Retain`    | 保留存储资源和数据，需要管理员后续处理           |
| `Delete`    | 自动回收 PV 及其对应的存储资源，数据可能随之删除 |

动态创建的 PV 通常继承 StorageClass 的回收策略；StorageClass 未指定时默认是 `Delete`。重要数据应检查**实际 PV** 的策略，并做好备份。`Retain` 只控制回收行为，不等于备份或容灾。

删除 Pod 与删除 PVC 是不同操作。只要 PVC、PV 和实际数据仍保留，新 Pod 使用原 PVC 就可以继续访问数据。

## 五、StatefulSet 与持久化

StatefulSet 适合需要稳定身份的应用。通过 `volumeClaimTemplates`，它可以为每个 Pod 实例分别创建 PVC，例如 `db-0`、`db-1` 各自使用独立数据卷。

Pod 被重建时，可以重新使用与该实例关联的原 PVC。缩容或删除 StatefulSet 时，PVC 是否保留还需检查 `persistentVolumeClaimRetentionPolicy`；默认保留，但不能假设所有部署都使用默认设置。

StatefulSet 本身不提供数据库复制、故障切换或数据一致性，这些能力由应用或相应 Operator 实现。

需要快照时，可使用存储驱动支持的 VolumeSnapshot 功能，前提是集群已安装所需快照资源和控制器。快照可以用于恢复新 PVC，但不自动保证数据库事务一致性，也不能替代独立备份。

## 六、完整示例：申请存储并写入文件

**前提**：有可用的 Kubernetes 集群、`kubectl` 权限，以及支持动态供给、RWO 和文件系统卷的现有 StorageClass。节点还需能够获取示例使用的容器镜像。

先查看可用存储类别：

```sh
kubectl get storageclass
```

将下面 `storageClassName` 的 `your-storage-class` 替换为实际名称。所有命令在同一当前命名空间执行，并使用未被占用的示例资源名称。

将以下内容保存为 `storage-demo.yaml`：

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: demo-pvc
spec:
  storageClassName: your-storage-class
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
---
apiVersion: v1
kind: Pod
metadata:
  name: demo-pod
spec:
  containers:
    - name: app
      image: busybox:1.36
      command: ["sh", "-c", "sleep 3600"]
      volumeMounts:
        - name: data
          mountPath: /data
  volumes:
    - name: data
      persistentVolumeClaim:
        claimName: demo-pvc
```

创建资源并等待 Pod 就绪：

```sh
kubectl apply -f storage-demo.yaml
kubectl wait --for=condition=Ready pod/demo-pod --timeout=180s
kubectl get pvc demo-pvc
kubectl exec demo-pod -- sh -c 'echo hello > /data/test.txt'
kubectl exec demo-pod -- cat /data/test.txt
```

正常情况下 PVC 为 `Bound`，最后一条命令输出 `hello`。就绪等待超时并不意味着数据丢失，应结合下一节查看事件。

还可以只删除 Pod，再使用同一配置重建，验证文件仍在：

```sh
kubectl delete pod demo-pod
kubectl apply -f storage-demo.yaml
kubectl wait --for=condition=Ready pod/demo-pod --timeout=180s
kubectl exec demo-pod -- cat /data/test.txt
```

这里重建后的容器不会重新写入文件；再次读到 `hello` 表明使用了原 PVC 中的数据。

验证结束后，可以删除示例 Pod。**PVC 有意保留**：删除它可能触发 `Delete` 策略并清除数据，确认不再需要数据及实际回收策略后再处理。

## 七、常见问题怎么排查？

先看 PVC、Pod 状态及事件，再根据现象定位：

| 现象                                         | 优先检查                                                                                |
| -------------------------------------------- | --------------------------------------------------------------------------------------- |
| PVC 一直 `Pending`                           | StorageClass 名称、容量与访问模式；是否在等待首个 Pod；是否存在可匹配 PV 或动态供给失败 |
| Pod `Pending`                                | Pod 事件中是否有节点、可用区或存储位置约束冲突                                          |
| PVC 已 `Bound`，Pod 仍在 `ContainerCreating` | Pod 事件中的卷挂载错误；绑定成功不代表挂载成功                                          |
| `Multi-Attach` 错误                          | 原 Pod 是否仍在其他节点使用该卷，访问模式是否允许当前使用方式                           |
| `permission denied`                          | 应用 UID/GID、目录权限、只读设置，必要时检查 `securityContext.fsGroup` 及存储支持情况   |
| `no space left on device`                    | 卷容量与 inode 是否耗尽，存储类别是否支持扩容                                           |

基础命令：

```sh
kubectl get pvc
kubectl get pv
kubectl get storageclass
kubectl describe pvc demo-pvc
kubectl describe pod demo-pod
kubectl get events --sort-by=.lastTimestamp
```

如果容器能够运行，也可以查看卷的空间和 inode 使用量：

```sh
kubectl exec demo-pod -- df -h /data
kubectl exec demo-pod -- df -i /data
```

替换命令中的示例名称；跨命名空间排查时显式指定 `-n <namespace>`。PV、StorageClass 等集群资源可能需要额外查看权限。事件指向存储服务异常时，再交由管理员检查相应存储组件。

官方参考：[Volumes](https://kubernetes.io/docs/concepts/storage/volumes/)、[Persistent Volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)、[StorageClass](https://kubernetes.io/docs/concepts/storage/storage-classes/)、[StatefulSet](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/)。
