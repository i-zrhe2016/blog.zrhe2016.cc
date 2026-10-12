---
title: "install asciima and set alias"
description: "install curl https://raw.githubusercontent.com/i-zrhe2016/lp/refs/heads/main/lp.sh | sh usage usage: asciinema [-h] [--version] {rec,play,cat,upload,auth} ... R"
pubDatetime: 2025-12-13T03:05:00Z
tags: []
draft: false
---

<h2 id="install">install</h2>

<pre><span></span>curl https://raw.githubusercontent.com/i-zrhe2016/lp/refs/heads/main/lp.sh | sh
</pre>



<h2 id="usage">usage</h2>

<pre><span></span>usage: asciinema [-h] [--version] {rec,play,cat,upload,auth} ...

Record and share your terminal sessions, the right way.

positional arguments:
  {rec,play,cat,upload,auth}
    rec                 Record terminal session
    play                Replay terminal session
    cat                 Print full output of terminal session
    upload              Upload locally saved terminal session to asciinema.org
    auth                Manage recordings on asciinema.org account

options:
  -h, --help            show this help message and exit
  --version             show program's version number and exit

example usage:
  Record terminal and upload it to asciinema.org:
    asciinema rec
  Record terminal to local file:
    asciinema rec demo.cast
  Record terminal and upload it to asciinema.org, specifying title:
    asciinema rec -t "My git tutorial"
  Record terminal to local file, limiting idle time to max 2.5 sec:
    asciinema rec -i 2.5 demo.cast
  Replay terminal recording from local file:
    asciinema play demo.cast
  Replay terminal recording hosted on asciinema.org:
    asciinema play https://asciinema.org/a/difqlgx86ym6emrmd8u62yqu8
  Print full output of recorded session:
    asciinema cat demo.cast

For help on a specific command run:
  asciinema &lt;command&gt; -h
</pre>



