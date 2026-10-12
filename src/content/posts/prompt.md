---
title: "编写Prompt的两个基本原则"
description: "本章主要阐述了提示词工程（Prompt Engineering）中至关重要的两大基本原则，并围绕这些原则介绍了一系列核心策略，旨在帮助开发者更有效地与大型语言模型（LLM）进行交互，以获得更准确、更可控的输出。 两大核心原则 1. 编写清晰、具体的指令 (Write Clear and Specific Instruc"
pubDatetime: 2025-06-27T16:46:00Z
tags: []
draft: false
---

<p>本章主要阐述了提示词工程（Prompt Engineering）中至关重要的两大基本原则，并围绕这些原则介绍了一系列核心策略，旨在帮助开发者更有效地与大型语言模型（LLM）进行交互，以获得更准确、更可控的输出。</p>
<hr/>
<h2 id="strongstrong"><strong>两大核心原则</strong></h2><h3 id="strong1-write-clear-and-specific-instructionsstrong"><strong>1. 编写清晰、具体的指令 (Write Clear and Specific Instructions)</strong></h3><ul>
<li><p>指令的清晰度和具体性是决定模型输出质量的关键。向模型发出的指令越明确、越没有歧义，模型就越有可能生成正确且相关的回应。</p>
</li>
<li><p>需要注意的是，“清晰”不等于“简短”。在某些情况下，为了提供充足的上下文和精确的指令，一个较长的、描述详尽的Prompt反而比一个简短模糊的Prompt更为有效。</p>
</li>
</ul>
<h3 id="strong2-give-the-model-time-to-thinkstrong"><strong>2. 给模型适当的“思考时间” (Give the Model Time to "Think")</strong></h3><ul>
<li><p>对于复杂的任务，直接要求模型一步到位地给出答案，会显著增加其出错的概率。更有效的方法是在提示中引导模型进行一系列的推理步骤。</p>
</li>
<li><p>通过将复杂任务分解为更小、更有序的子任务，可以让模型逐步“思考”，从而得出更可靠、更准确的最终结论。</p>
</li>
</ul>
<hr/>
<h2 id="strongstrong-1"><strong>原则一的相关策略：如何编写清晰具体的指令</strong></h2><ul>
<li><p><strong>使用分隔符标明不同部分</strong></p>
<blockquote>
<p>在Prompt中使用清晰的分隔符（如三个反引号 ```, XML标签 <code>&lt;tag&gt;</code>, 尖括号<code>&lt;&gt;</code>等）来区分指令、上下文、待处理文本等不同部分。这种结构化的方法能有效帮助模型理解各个部分的角色，防止它将指令内容与待分析的文本内容混淆。同时，这也是一种防御“提示注入”（Prompt Injection）攻击的有效手段。</p>
</blockquote>
</li>
<li><p><strong>要求结构化输出</strong></p>
<blockquote>
<p>指示模型按照特定的、预设的格式（如JSON、HTML等）来生成其输出。当需要将模型的输出用于后续的程序处理时，这一策略尤其重要。结构化的输出确保了数据的一致性和可解析性，便于自动化处理。</p>
</blockquote>
</li>
<li><p><strong>先让模型检查条件</strong></p>
<blockquote>
<p>在要求模型执行某个任务之前，可以先指令它检查输入是否满足某些特定的前提条件。根据检查结果，模型将决定是继续执行任务还是采取其他预设的行动。这种在Prompt中内置“if-else”逻辑的技巧，可以使模型能够根据不同的输入情况做出恰当的、差异化的响应。</p>
</blockquote>
</li>
<li><p><strong>提供示例（Few-Shot 提示）</strong></p>
<blockquote>
<p>在正式提出任务请求之前，先向模型提供一个或多个“输入-输出”的范例。通过模仿这些示例，模型能更好地理解任务的具体要求，特别是对于输出的格式、语气和风格。这种“少样本”提示（Few-shot Prompting）是引导模型产生特定风格回答的有效方法。</p>
</blockquote>
</li>
</ul>
<hr/>
<h2 id="strongstrong-2"><strong>原则二的相关策略：如何给予模型思考时间</strong></h2><ul>
<li><p><strong>链式思考提示 (Chain-of-Thought Prompting)</strong></p>
<blockquote>
<p>**针对复杂任务，不要期望模型一步完成，而应在Prompt中明确地将任务分解为一系列连续的步骤，并要求模型按顺序逐一执行。**通过给出清晰的步骤指令（例如，“第一步：... 第二步：... 第三步：...”），可以引导模型进行逐步推理（类似于“思维链”），从而显著降低在复杂逻辑推导中出现错误的可能性。</p>
</blockquote>
</li>
</ul>
<hr/>
<h2 id="strongstrong-3"><strong>总结</strong></h2><ul>
<li>这两大原则及其相关策略是提示词工程的基石，适用于任何需要使用大型语言模型完成任务的场景。无论是内容创作、问题解答、数据分析还是格式转换，遵循这些准则都能有效提升模型的表现，防止模型产生误解、输出无用或逻辑混乱的内容，为构建可靠的AI应用奠定坚实的<strong>提示设计思维</strong>。</li>
</ul>
