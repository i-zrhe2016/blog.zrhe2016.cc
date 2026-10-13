---
title: "dynamic cpu for build image"
description: "The principle in your repo is not “continuously changing CPU shares during the build.” It is: Give BuildKit a fixed low CPU priority, then let the Linux schedul"
pubDatetime: 2026-09-05T05:25:00Z
tags: []
draft: false
---

The principle in your repo is **not “continuously changing CPU shares during the build.”** It is:

> **Give BuildKit a fixed low CPU priority, then let the Linux scheduler dynamically decide how much CPU it actually gets.**

Your script creates a dedicated BuildKit container:

```text
docker buildx create \
  --name "$BUILDER" \
  --driver docker-container \
  --driver-opt "cpu-shares=${CPU_SHARES}"

```

and defaults to:

```text
CPU_SHARES=256

```

Then all builds run through that builder.

```text
docker buildx build
        |
        v
BuildKit container
cpu-shares = 256
        |
        v
Linux cgroup
        |
        v
CPU scheduler

```

### Why CPU usage is dynamic

`cpu-shares=256` is only a **relative priority**.

When the machine is idle:

```text
CPU capacity
100% |####################|

Business   ##          10%
BuildKit   ################ 90%

```

BuildKit can still use almost all spare CPU.

When production gets busy:

```text
CPU capacity
100% |####################|

Business   ################ 80%
BuildKit   ####             20%

```

Because BuildKit has lower CPU weight, Linux gives CPU time to higher-priority workloads first.

So the “dynamic adjustment” is actually done here:

```text
             runnable processes
                    |
          +---------+---------+
          |                   |
      Business             BuildKit
    higher weight        lower weight
          |                   |
          +---------+---------+
                    |
             Linux scheduler
                    |
                    v
             dynamic CPU time

```

The important distinction is:

| Setting | Dynamic? |
| --- | --- |
| `cpu-shares=256` | No, fixed |
| Actual BuildKit CPU usage | Yes |
| Who adjusts it | Linux scheduler |

So your design can be summarized as:

```text
Fixed CPU priority
        +
Dynamic CPU allocation

```

rather than:

```text
Monitor CPU
   |
change 256 -> 512 -> 128
   |
docker update

```

That second model would be **explicit dynamic control**. Your current repo uses the simpler and cleaner **scheduler-driven elastic CPU sharing**.
