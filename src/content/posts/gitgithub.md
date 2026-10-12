---
title: "配置git连接github"
description: "chmod 600 ./key eval \"$(ssh-agent -s)\" ssh-add ~/.ssh/key ssh -T git@github.com git config --global user.name \"zrhe2016\" git config --global user.email \"zrhe201"
pubDatetime: 2026-02-26T04:51:00Z
tags: []
draft: false
---

<pre><span></span>chmod 600 ./key
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/key
ssh -T git@github.com

git config --global user.name "zrhe2016"
git config --global user.email "zrhe2016@gmail.com"
</pre>



