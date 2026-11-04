---
title: 写代码前，先搜 GitHub
description: GitPilfer 提倡先搜索和评估 GitHub 上的现有实现，再决定复用、修改还是从零编写。
pubDatetime: 2026-11-04T10:00:00Z
tags:
  - AI
  - GitHub
  - 开源
  - Skill
draft: false
---

使用 Claude Code、Codex 编程时，很多人习惯让 AI 从零实现功能。

但 GitHub 上可能早已有成熟的开源代码。直接复用，不仅能减少代码生成，还可能节省调试消耗的 Token。

## GitPilfer：先搜索，再写代码

[GitPilfer](https://github.com/pilgrimdelamare/GitPilfer) 是一个面向 AI 编程工具的 Skill。

核心原则：先搜索 GitHub，找到合适的实现就复用，找不到再自己写。

```plantuml 搜索、评估并复用现有实现的流程
@startuml
start
:提出开发需求;
:搜索现有项目和 GitHub;

if (找到合适的实现?) then (是)
  :检查许可证、维护情况和兼容性;
  if (符合要求?) then (是)
    :复用或修改已有代码;
  else (否)
    :自行实现;
  endif
else (否)
  :自行实现;
endif

:集成并测试;
stop
@enduml
```

## 为什么能节省 Token？

从零编写需要生成代码、探索实现方案，还可能反复调试。

复用成熟代码则把工作转向搜索、筛选和集成。

```plantuml 从零编写和复用成熟代码的 Token 消耗对比
@startuml
left to right direction
rectangle "Token 消耗" as T
rectangle "从零编写\n生成代码\n探索方案\n反复调试" as B
rectangle "复用成熟代码\n搜索与筛选\n阅读与集成\n测试验证" as R
T --> B
T --> R
@enduml
```

成熟代码通常处理过部分常见问题和边界情况，因此有机会减少重新实现和调试的成本。

但搜索和理解代码同样消耗 Token，复用并不保证每次都更省。

## 什么时候应该复用？

不是所有 GitHub 代码都值得采用。

需要考虑许可证、维护情况、安全性、兼容性和测试结果。如果功能非常简单，从零编写反而可能更划算。

推荐采用以下优先级：

```plantuml 直接复用、修改实现、从零编写的优先级
@startuml
left to right direction

rectangle "REUSE\n直接复用" as R
rectangle "ADAPT\n修改已有实现" as A
rectangle "BUILD\n从零编写" as B

R --> A : 无法直接复用
A --> B : 没有合适实现

@enduml
```

## 总结

GitPilfer 的价值在于改变 AI 的编程习惯：先找成熟实现，再决定要不要写新代码。

实际节省多少 Token，还需要根据任务测试验证。

AI 编程不只是让代码生成得更快，也要尽量减少不必要的重复开发。
