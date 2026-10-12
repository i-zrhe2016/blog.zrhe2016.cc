---
title: "golang获取当前时间"
description: "获取当前时间并按指定格式显示 package main import ( \"fmt\" \"time\" ) func main() { fmt.Println(time.Now().Format(\"200601021504\")) fmt.Println(\"执行完毕，请按回车键退出...\") var input string"
pubDatetime: 2026-01-18T06:46:00Z
tags: []
draft: false
---

<p>获取当前时间并按指定格式显示</p>

<pre><span></span>package main

import (
	"fmt"
	"time"
)

func main() {
	fmt.Println(time.Now().Format("200601021504"))

	fmt.Println("执行完毕，请按回车键退出...")
	var input string
	fmt.Scanln(&amp;input) // 等待用户输入
}
</pre>



