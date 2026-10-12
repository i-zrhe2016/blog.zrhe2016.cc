---
title: "dynamic cpu for build image"
description: "The principle in your repo is not “continuously changing CPU shares during the build.” It is: Give BuildKit a fixed low CPU priority, then let the Linux schedul"
pubDatetime: 2026-09-05T05:25:00Z
tags: []
draft: false
---

<p>The principle in your repo is <strong>not “continuously changing CPU shares during the build.”</strong> It is:</p>
<blockquote>
<p><strong>Give BuildKit a fixed low CPU priority, then let the Linux scheduler dynamically decide how much CPU it actually gets.</strong></p>
</blockquote>
<p>Your script creates a dedicated BuildKit container:</p>

<pre><span></span>docker<span class="w"> </span>buildx<span class="w"> </span>create<span class="w"> </span><span class="se">\</span>
<span class="w">  </span>--name<span class="w"> </span><span class="s2">"</span><span class="nv">$BUILDER</span><span class="s2">"</span><span class="w"> </span><span class="se">\</span>
<span class="w">  </span>--driver<span class="w"> </span>docker-container<span class="w"> </span><span class="se">\</span>
<span class="w">  </span>--driver-opt<span class="w"> </span><span class="s2">"cpu-shares=</span><span class="si">${</span><span class="nv">CPU_SHARES</span><span class="si">}</span><span class="s2">"</span>
</pre>



<p>and defaults to:</p>

<pre><span></span><span class="nv">CPU_SHARES</span><span class="o">=</span><span class="m">256</span>
</pre>



<p>Then all builds run through that builder.</p>

<pre><span></span>docker buildx build
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
</pre>



<h3 id="why-cpu-usage-is-dynamic">Why CPU usage is dynamic</h3><p><code>cpu-shares=256</code> is only a <strong>relative priority</strong>.</p>
<p>When the machine is idle:</p>

<pre><span></span>CPU capacity
100% |####################|

Business   ##          10%
BuildKit   ################ 90%
</pre>



<p>BuildKit can still use almost all spare CPU.</p>
<p>When production gets busy:</p>

<pre><span></span>CPU capacity
100% |####################|

Business   ################ 80%
BuildKit   ####             20%
</pre>



<p>Because BuildKit has lower CPU weight, Linux gives CPU time to higher-priority workloads first.</p>
<p>So the “dynamic adjustment” is actually done here:</p>

<pre><span></span>             runnable processes
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
</pre>



<p>The important distinction is:</p>
<table>
<thead>
<tr>
<th>Setting</th>
<th>Dynamic?</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>cpu-shares=256</code></td>
<td>No, fixed</td>
</tr>
<tr>
<td>Actual BuildKit CPU usage</td>
<td>Yes</td>
</tr>
<tr>
<td>Who adjusts it</td>
<td>Linux scheduler</td>
</tr>
</tbody>
</table>
<p>So your design can be summarized as:</p>

<pre><span></span>Fixed CPU priority
        +
Dynamic CPU allocation
</pre>



<p>rather than:</p>

<pre><span></span>Monitor CPU
   |
change 256 -&gt; 512 -&gt; 128
   |
docker update
</pre>



<p>That second model would be <strong>explicit dynamic control</strong>. Your current repo uses the simpler and cleaner <strong>scheduler-driven elastic CPU sharing</strong>.</p>
