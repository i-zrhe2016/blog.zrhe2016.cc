---
title: "dd快速重装系统"
description: "快速重装 dd重装为ubuntu22.04 curl -O https://raw.githubusercontent.com/bin456789/reinstall/main/reinstall.sh || wget -O reinstall.sh https://raw.githubusercontent.com/"
pubDatetime: 2025-12-13T07:34:00Z
tags: []
draft: false
---

<h2 id="">快速重装</h2><h3 id="ddubuntu2204">dd重装为ubuntu22.04</h3>

<pre><span></span>curl -O https://raw.githubusercontent.com/bin456789/reinstall/main/reinstall.sh || wget -O reinstall.sh https://raw.githubusercontent.com/bin456789/reinstall/main/reinstall.sh &amp;&amp; chmod +x reinstall.sh &amp;&amp; ./reinstall.sh ubuntu22.04 --password 'FncPBRa9uu*LhA'
</pre>



<h3 id="ddrocky-8">dd重装为rocky 8</h3>

<pre><span></span>curl -O https://raw.githubusercontent.com/bin456789/reinstall/main/reinstall.sh || wget -O reinstall.sh https://raw.githubusercontent.com/bin456789/reinstall/main/reinstall.sh &amp;&amp; chmod +x reinstall.sh &amp;&amp; ./reinstall.sh rocky 8 --password 'FncPBRa9uu*LhA'
</pre>



<h3 id="ddcentos-8">dd重装为centos 8</h3>

<pre><span></span>curl -O https://raw.githubusercontent.com/bin456789/reinstall/main/reinstall.sh || wget -O reinstall.sh https://raw.githubusercontent.com/bin456789/reinstall/main/reinstall.sh &amp;&amp; chmod +x reinstall.sh &amp;&amp; ./reinstall.sh centos 8 --password 'FncPBRa9uu*LhA'
</pre>



<h3 id="ddalmalinux-8">dd重装为almalinux 8</h3>

<pre><span></span>curl -O https://raw.githubusercontent.com/bin456789/reinstall/main/reinstall.sh || wget -O reinstall.sh https://raw.githubusercontent.com/bin456789/reinstall/main/reinstall.sh &amp;&amp; chmod +x reinstall.sh &amp;&amp; ./reinstall.sh almalinux 8 --password 'FncPBRa9uu*LhA'
</pre>



<h3 id="ddanolis-8">dd重装为anolis 8</h3>

<pre><span></span>curl -O https://raw.githubusercontent.com/bin456789/reinstall/main/reinstall.sh || wget -O reinstall.sh https://raw.githubusercontent.com/bin456789/reinstall/main/reinstall.sh &amp;&amp; chmod +x reinstall.sh &amp;&amp; ./reinstall.sh anolis 8 --password 'FncPBRa9uu*LhA'
</pre>



<h3 id="usage">usage</h3>

<pre><span></span>Usage:  ./reinstall.sh anolis      7|8|23
                       opencloudos 8|9|23
                       rocky       8|9|10
                       oracle      8|9|10
                       almalinux   8|9|10
                       centos      9|10
                       fnos        1
                       nixos       25.11
                       fedora      42|43
                       debian      9|10|11|12|13
                       alpine      3.20|3.21|3.22|3.23
                       opensuse    15.6|16.0|tumbleweed
                       openeuler   20.03|22.03|24.03|25.09
                       ubuntu      16.04|18.04|20.04|22.04|24.04|25.10 [--minimal]
                       kali
                       arch
                       gentoo
                       aosc
                       redhat      --img="http://access.cdn.redhat.com/xxx.qcow2"
                       dd          --img="http://xxx.com/yyy.zzz" (raw image stores in raw/vhd/tar/gz/xz/zst)
                       windows     --image-name="windows xxx yyy" --lang=xx-yy
                       windows     --image-name="windows xxx yyy" --iso="http://xxx.com/xxx.iso"
                       netboot.xyz

       Options:        For Linux/Windows:
                       [--password  PASSWORD]
                       [--ssh-key   KEY]
                       [--ssh-port  PORT]
                       [--web-port  PORT]
                       [--frpc-toml PATH]

                       For Windows Only:
                       [--allow-ping]
                       [--rdp-port   PORT]
                       [--add-driver INF_OR_DIR]

Manual: https://github.com/bin456789/reinstall
</pre>



