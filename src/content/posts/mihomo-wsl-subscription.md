---
title: "mihomo-wsl-subscription"
description: "#!/usr/bin/env bash # WSL 2 Ubuntu: 独立 Mihomo TUN 安装器，不依赖 Windows Clash。 # 用法: sudo bash mihomo-wsl-subscription.sh [install|start|stop|restart|status|logs|chec"
pubDatetime: 2026-10-10T14:35:00Z
tags: []
draft: false
---

<pre><span></span>#!/usr/bin/env bash
# WSL 2 Ubuntu: 独立 Mihomo TUN 安装器，不依赖 Windows Clash。
# 用法: sudo bash mihomo-wsl-subscription.sh [install|start|stop|restart|status|logs|check]
# 默认使用 https://ghproxy.imciel.com/；可选 GH_MIRROR=direct 使用 GitHub 官方
set -Eeuo pipefail
umask 077

info() { printf '\033[1;34m[信息]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[提醒]\033[0m %s\n' "$*" &gt;&amp;2; }
die()  { printf '\033[1;31m[错误]\033[0m %s\n' "$*" &gt;&amp;2; exit 1; }
need_root() { [[ "$(id -u)" -eq 0 ]] || die '请用 sudo bash mihomo-wsl-subscription.sh 运行'; }

COMMAND="${1:-install}"
case "$COMMAND" in
  start|stop|restart|status|logs|check)
    case "$COMMAND" in
      start|restart|stop)
        need_root
        # systemd 的 ExecStartPre / ExecStopPost 自动切换 DNS。
        systemctl "$COMMAND" mihomo
        ;;
      status) systemctl status mihomo --no-pager || true ;;
      logs) journalctl -u mihomo -n 80 --no-pager ;;
      check)
        unset http_proxy https_proxy all_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY no_proxy NO_PROXY || true
        systemctl is-active --quiet mihomo || die 'Mihomo 服务未运行'
        ip link show mihomo-tun &gt;/dev/null 2&gt;&amp;1 || die 'TUN 网卡不存在'
        printf 'HTTP 代理出口：'
        curl --noproxy '' -4 -x http://127.0.0.1:7890 --connect-timeout 8 --max-time 25 -fsS https://api.ipify.org || die 'HTTP 代理联网失败'
        printf '\nTUN 透明代理出口：'
        curl --noproxy '*' -4 --connect-timeout 8 --max-time 25 -fsS https://api.ipify.org || die 'TUN 联网失败'
        printf '\n'
        ;;
    esac
    exit 0
    ;;
  install)
    need_root
    # 不使用 Windows Clash 或此前留在 Shell 中的 HTTP/SOCKS 环境代理。
    unset http_proxy https_proxy all_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY no_proxy NO_PROXY || true
    ;;
  *) die '用法: sudo bash mihomo-wsl-subscription.sh [install|start|stop|restart|status|logs|check]' ;;
esac

# 仅安装到 Ubuntu；适用于 WSL 2 Ubuntu 或原生 Ubuntu。
[[ -r /etc/os-release ]] || die '无法识别系统版本'
. /etc/os-release
[[ "${ID:-}" == ubuntu ]] || die "这是 Ubuntu 专用版，当前系统：${PRETTY_NAME:-unknown}"
IS_WSL=0
if grep -qiE 'microsoft|wsl' /proc/sys/kernel/osrelease 2&gt;/dev/null; then
  IS_WSL=1
fi

# 修改 wsl.conf 的现有分组，避免重复 [network]、[boot]。
ini_set() {
  python3 - "$1" "$2" "$3" &lt;&lt;'PY_INI'
from pathlib import Path
import re, sys
section, key, value = sys.argv[1:]
p = Path('/etc/wsl.conf')
s = p.read_text() if p.exists() else ''
m = re.search(r'(?im)^[ \t]*\[' + re.escape(section) + r'\][ \t]*$', s)
if m:
    end_match = re.search(r'(?m)^[ \t]*\[', s[m.end():])
    end = m.end() + end_match.start() if end_match else len(s)
    body = s[m.end():end]
    pat = re.compile(r'(?im)^[ \t]*' + re.escape(key) + r'[ \t]*=.*$')
    if pat.search(body):
        body = pat.sub(key + '=' + value, body)
    else:
        body = body.rstrip('\n') + '\n' + key + '=' + value + '\n'
    s = s[:m.end()] + body + s[end:]
else:
    s = s.rstrip() + f'\n\n[{section}]\n{key}={value}\n'
p.write_text(s)
PY_INI
}

if [[ ! -d /run/systemd/system ]]; then
  if [[ "$IS_WSL" == 1 ]]; then
    if [[ -f /etc/wsl.conf &amp;&amp; ! -f /etc/wsl.conf.before-mihomo ]]; then
      cp -a /etc/wsl.conf /etc/wsl.conf.before-mihomo
    fi
    command -v python3 &gt;/dev/null || die "请先安装 python3：sudo apt-get install -y python3"
    ini_set boot systemd true
    die $'已为 WSL Ubuntu 写入 [boot] systemd=true。请在 Windows PowerShell 执行：wsl --shutdown，然后重新进入 Ubuntu，再运行本脚本。'
  fi
  die '请先在 Ubuntu 启用 systemd，当前环境未检测到 systemd。'
fi

info "检测系统：${PRETTY_NAME}，WSL=${IS_WSL}；安装依赖..."
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  ca-certificates curl gzip python3 python3-yaml iproute2 iptables nftables kmod

if [[ ! -c /dev/net/tun ]]; then
  modprobe tun 2&gt;/dev/null || true
fi
[[ -c /dev/net/tun ]] || die '找不到 /dev/net/tun，请检查 WSL2 内核是否启用 TUN 设备'

case "$(dpkg --print-architecture)" in
  amd64) ARCH_TAG='linux-amd64-compatible' ;;
  arm64) ARCH_TAG='linux-arm64' ;;
  *) die "暂不支持该 CPU 架构：$(dpkg --print-architecture)" ;;
esac

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

# GitHub 访问优化：官方 API 用于获取可靠的资产哈希；如果无法连接 API，
# 回退到已从官方 GitHub Release 核对过的固定版本与 SHA256。
# Release 二进制优先通过可选国内镜像下载，且总是验证 SHA256。
PINNED_VERSION='v1.19.32'
case "$ARCH_TAG" in
  linux-amd64-compatible)
    PINNED_SHA256='ba3ce607747a07f948fc35780e108a4a7c7f552a38b9bd4d115f313ebcb89c20'
    ;;
  linux-arm64)
    PINNED_SHA256='9dd862e28b46ff7d775f169cceebc28deccaa0a9e804237d421cd2571e0caba0'
    ;;
esac

info '获取 Mihomo 官方最新稳定版 Release 信息（失败则使用预校验版本）...'
if curl --fail --silent --show-error --location --retry 1 \
    --connect-timeout 6 --max-time 18 \
    -H 'Accept: application/vnd.github+json' \
    'https://api.github.com/repos/MetaCubeX/mihomo/releases/latest' \
    -o "$TMP_DIR/release.json"; then
  if ! python3 - "$TMP_DIR/release.json" "$ARCH_TAG" &gt; "$TMP_DIR/asset.txt" &lt;&lt;'PY_RELEASE'
import json, sys
with open(sys.argv[1], encoding='utf-8') as f:
    data = json.load(f)
tag = sys.argv[2]
assets = data.get('assets', [])
matches = [a for a in assets if a.get('name', '').startswith('mihomo-' + tag + '-')
           and a.get('name', '').endswith('.gz')]
if len(matches) != 1:
    sys.exit('找不到唯一的 ' + tag + ' .gz 官方安装包')
asset = matches[0]
print(asset['browser_download_url'])
print(asset.get('digest') or '')
print(asset['name'])
PY_RELEASE
  then
    warn '官方 API 返回的数据无法解析，使用预校验版本'
    : &gt; "$TMP_DIR/asset.txt"
  fi
else
  warn 'GitHub API 暂时无法连接，使用预校验版本（无需连接 GitHub API）'
  : &gt; "$TMP_DIR/asset.txt"
fi

mapfile -t ASSET &lt; "$TMP_DIR/asset.txt"
ASSET_URL="${ASSET[0]:-}"
ASSET_DIGEST="${ASSET[1]:-}"
ASSET_NAME="${ASSET[2]:-}"
if [[ ! "$ASSET_DIGEST" =~ ^sha256:[a-fA-F0-9]{64}$ ]]; then
  if [[ -n "$ASSET_URL" ]]; then
    warn '官方 API 未提供有效 SHA256，回退到带固定 SHA256 的预校验版本'
  fi
  ASSET_NAME="mihomo-${ARCH_TAG}-${PINNED_VERSION}.gz"
  ASSET_URL="https://github.com/MetaCubeX/mihomo/releases/download/${PINNED_VERSION}/${ASSET_NAME}"
  ASSET_DIGEST="sha256:${PINNED_SHA256}"
fi
[[ "$ASSET_URL" == https://github.com/MetaCubeX/mihomo/releases/download/* ]] || die '资产链接不是官方 Mihomo Release，已拒绝下载'
EXPECTED_SHA256="${ASSET_DIGEST#sha256:}"

# 默认通过 ghproxy.imciel.com 下载；如果镜像完全不可用，再尝试 GitHub 官方。
# 如需自定义代理：sudo GH_MIRROR=https://镜像域名 bash mihomo-wsl-subscription.sh
# 如需绕过镜像：sudo GH_MIRROR=direct bash mihomo-wsl-subscription.sh
GH_MIRROR="${GH_MIRROR:-https://ghproxy.imciel.com}"
MIRRORS=()
if [[ "$GH_MIRROR" != 'direct' ]]; then
  [[ "$GH_MIRROR" == https://* ]] || die 'GH_MIRROR 必须以 https:// 开头，或设为 direct'
  MIRRORS+=("${GH_MIRROR%/}")
fi
MIRRORS+=('')  # Github 官方兜底

# 使用持久缓存保存未完成的文件，脚本退出后依然能够断点续传。
# 将预期 SHA256 写入缓存名，避免不同版本/内容的文件混淆。
CACHE_DIR='/var/cache/mihomo-installer'
install -d -m 0700 "$CACHE_DIR"
PART_FILE="${CACHE_DIR}/${ASSET_NAME}.${EXPECTED_SHA256}.part"

info "准备下载 ${ASSET_NAME}（ghproxy.imciel.com 优先、可断点续传、SHA256 校验）..."
DOWNLOAD_OK=0
if [[ -s "$PART_FILE" ]] &amp;&amp; printf '%s  %s\n' "$EXPECTED_SHA256" "$PART_FILE" | sha256sum --check --status; then
  info '安装包已完整缓存且 SHA256 校验通过，无需重复下载'
  DOWNLOAD_OK=1
else
  for MIRROR in "${MIRRORS[@]}"; do
    if [[ -n "$MIRROR" ]]; then
      URL="${MIRROR}/${ASSET_URL}"
      LABEL="$MIRROR"
    else
      URL="$ASSET_URL"
      LABEL='GitHub 官方'
    fi
    info "尝试下载：${LABEL}"
    # 网络失败时保留 .part：下一次尝试或再次运行脚本可继续下载。
    # 不设 90 秒总超时；仅在 120 秒持续低于 1 KiB/s 时重试。
    for ATTEMPT in 1 2 3 4; do
      info "下载尝试 ${ATTEMPT}/4；已缓存 $(stat -c %s "$PART_FILE" 2&gt;/dev/null || echo 0) 字节"
      if curl --fail --location --show-error --continue-at - \
          --connect-timeout 15 --max-time 0 \
          --speed-time 120 --speed-limit 1024 \
          --proto '=https' --proto-redir '=https' \
          "$URL" -o "$PART_FILE" 2&gt; &gt;(tee "$TMP_DIR/curl-error.log" &gt;&amp;2); then
        if printf '%s  %s\n' "$EXPECTED_SHA256" "$PART_FILE" | sha256sum --check --status; then
          DOWNLOAD_OK=1
          info "下载完成，SHA256 校验通过：${LABEL}"
          break
        fi
        warn "${LABEL} 返回的文件 SHA256 不匹配，删除损坏的缓存"
        rm -f "$PART_FILE"
      else
        cat "$TMP_DIR/curl-error.log" &gt;&amp;2
        # 部分国内镜像不支持 HTTP Range，无法续传时从头重新下载。
        if grep -Eiq 'range|resume|requested range|HTTP server does not seem to support' "$TMP_DIR/curl-error.log"; then
          warn '镜像不支持断点续传，清除部分文件，下次从头下载'
          rm -f "$PART_FILE"
        else
          warn "${LABEL} 下载中断，保留已下载内容"
        fi
      fi
      if [[ "$ATTEMPT" -lt 4 ]]; then sleep 3; fi
    done
    if [[ "$DOWNLOAD_OK" -eq 1 ]]; then break; fi
    warn "${LABEL} 下载未完成，尝试下一下载源"
  done
fi
[[ "$DOWNLOAD_OK" -eq 1 ]] || die '镜像及官方源下载失败；已保存部分文件，可再次运行本脚本继续下载'
# 仅使用通过 SHA256 验证的下载文件。
cp "$PART_FILE" "$TMP_DIR/mihomo.gz"

gzip -t "$TMP_DIR/mihomo.gz"
gzip -dc "$TMP_DIR/mihomo.gz" &gt; "$TMP_DIR/mihomo"
chmod +x "$TMP_DIR/mihomo"
install -m 0755 "$TMP_DIR/mihomo" /usr/local/bin/mihomo
mihomo -v

# 仅接受一个 Clash/Mihomo HTTPS 订阅，拒绝拼接链接和单节点链接。
SUB_URL="${SUB_URL:-}"
if [[ -z "$SUB_URL" ]]; then
  [[ -t 0 ]] || die '非交互运行请设置 SUB_URL'
  read -r -s -p '请输入 Clash/Mihomo 订阅地址：' SUB_URL
  printf '\n'
fi
printf '%s' "$SUB_URL" &gt; "$TMP_DIR/sub-url"
unset SUB_URL
python3 - "$TMP_DIR/sub-url" "$TMP_DIR/curl.conf" &lt;&lt;'PY_URL'
import sys, json
from pathlib import Path
from urllib.parse import urlsplit
raw=Path(sys.argv[1]).read_text().strip()
try:
    u=urlsplit(raw)
    if u.scheme!='https' or not u.hostname or u.username or u.password or u.fragment or any(c.isspace() for c in raw) or raw.count('://')!=1:
        raise ValueError()
except ValueError:
    sys.exit('订阅地址无效：请输入单个完整 HTTPS 链接，不要拼接多个链接')
Path(sys.argv[1]).write_text(raw)
Path(sys.argv[2]).write_text('url = '+json.dumps(raw)+'\n')
PY_URL
info '下载并检测订阅内容...'
if ! curl --config "$TMP_DIR/curl.conf" --fail --silent --location \
    --connect-timeout 10 --max-time 60 --max-filesize 10485760 \
    --proto '=https' --proto-redir '=https' \
    -A 'clash.meta' -D "$TMP_DIR/sub-headers" \
    -o "$TMP_DIR/subscription.yaml" 2&gt; "$TMP_DIR/sub-error"; then
  die '订阅下载失败：请核对地址、有效期和网络。现有配置未修改'
fi
python3 - "$TMP_DIR" &lt;&lt;'PY_SUB'
import sys, json, re
from pathlib import Path
from datetime import datetime, timezone
import yaml
p=Path(sys.argv[1])
try:
    raw=yaml.safe_load((p/'subscription.yaml').read_text(encoding='utf-8-sig'))
    if not isinstance(raw,dict) or not isinstance(raw.get('proxies'),list) or not raw['proxies']:
        sys.exit('订阅未提供有效 proxies 列表，请使用 Clash/Mihomo 格式订阅（不支持 Base64 节点列表）')
    nodes=raw['proxies']; names=set(); counts={}
    for n in nodes:
        if not isinstance(n,dict) or not all(n.get(k) for k in ('name','type','server','port')):
            sys.exit('订阅存在缺失 name/type/server/port 的节点')
        if not isinstance(n['name'],str) or n['name'] in names:
            sys.exit('订阅节点名称重复或无效')
        if not isinstance(n['port'],int) or isinstance(n['port'],bool) or not 1&lt;=n['port']&lt;=65535:
            sys.exit('订阅存在无效节点端口')
        if n.get('dialer-proxy'):
            sys.exit('订阅含链式代理引用，无法独立提取节点；请使用普通节点订阅')
        names.add(n['name']); typ=str(n['type']); counts[typ]=counts.get(typ,0)+1
    print('有效节点：'+str(len(nodes))+' 个')
    print('协议统计：'+', '.join(k+': '+str(v) for k,v in sorted(counts.items())))
    # 不打印节点名称、服务器或订阅 URL。
    headers=(p/'sub-headers').read_text(errors='replace')
    vals=re.findall(r'(?im)^subscription-userinfo:\s*([^\r\n]+)',headers)
    if vals:
        data=dict((k,int(v)) for k,v in re.findall(r'(upload|download|total|expire)\s*=\s*(\d+)',vals[-1]))
        if 'total' in data and 'upload' in data and 'download' in data:
            used=data['upload']+data['download']; total=data['total']
            print(f'订阅流量：已用 {used/1024**3:.2f} GiB，总量 {total/1024**3:.2f} GiB')
            if total&gt;0 and used&gt;=total:
                sys.exit('订阅流量已用尽，请更新订阅后重试')
        if data.get('expire',0)&gt;0:
            expiry=data['expire']
            print('订阅到期时间（UTC）：'+datetime.fromtimestamp(expiry,timezone.utc).strftime('%Y-%m-%d %H:%M:%S'))
            if expiry&lt;=datetime.now(timezone.utc).timestamp():
                sys.exit('订阅已过期')
    else:
        print('订阅未提供流量/到期响应头，仅检测节点内容')
    # 只保留节点，忽略订阅内置 DNS、规则、规则集和远程资源。
    (p/'subscription.yaml').write_text(json.dumps({'proxies':nodes},ensure_ascii=False,indent=2)+'\n')
    cfg={
      'mixed-port':7890,'socks-port':7891,'allow-lan':False,
      'bind-address':'127.0.0.1','mode':'rule','log-level':'info','ipv6':False,
      'proxy-providers':{'subscription':{'type':'http','url':(p/'sub-url').read_text(),
          'path':'./providers/subscription.yaml','interval':86400,
          'header':{'User-Agent':['clash.meta']},
          'health-check':{'enable':True,'url':'https://www.gstatic.com/generate_204','interval':300}}},
      'proxy-groups':[{'name':'WSL_AUTO','type':'url-test','use':['subscription'],
          'url':'https://www.gstatic.com/generate_204','interval':300}],
      'rules':['IP-CIDR,127.0.0.0/8,DIRECT,no-resolve','IP-CIDR,10.0.0.0/8,DIRECT,no-resolve',
               'IP-CIDR,172.16.0.0/12,DIRECT,no-resolve','IP-CIDR,192.168.0.0/16,DIRECT,no-resolve',
               'MATCH,WSL_AUTO'],
      'tun':{'enable':True,'device':'mihomo-tun','stack':'mixed','auto-route':True,
             'auto-redirect':True,'auto-detect-interface':True,'strict-route':True,
             'dns-hijack':['any:53','tcp://any:53']},
      'dns':{'enable':True,'listen':'127.0.0.1:53','ipv6':False,
             'enhanced-mode':'fake-ip','fake-ip-range':'198.18.0.1/16',
             'fake-ip-filter':['*.lan','*.local','localhost'],
             'default-nameserver':['223.5.5.5','1.1.1.1'],
             'proxy-server-nameserver':['223.5.5.5','1.1.1.1'],
             'nameserver':['https://1.1.1.1/dns-query#WSL_AUTO','https://8.8.8.8/dns-query#WSL_AUTO']}}
    (p/'config.yaml').write_text(json.dumps(cfg,ensure_ascii=False,indent=2)+'\n')
except SystemExit:
    raise
except Exception:
    sys.exit('订阅解析失败：请检查是否为有效的 Clash/Mihomo YAML 配置')
PY_SUB

info '检查订阅节点及候选配置...'
install -d -m 0700 "$TMP_DIR/test-config/providers"
install -m 0600 "$TMP_DIR/config.yaml" "$TMP_DIR/test-config/config.yaml"
install -m 0600 "$TMP_DIR/subscription.yaml" "$TMP_DIR/test-config/providers/subscription.yaml"
if ! mihomo -t -d "$TMP_DIR/test-config" &gt; "$TMP_DIR/config-test.log" 2&gt;&amp;1; then
  die 'Mihomo 配置检查失败：订阅节点参数错误或版本不支持。现有配置未修改'
fi
install -d -m 0700 /etc/mihomo/providers
BACKUP=''
if [[ -f /etc/mihomo/config.yaml ]]; then
  BACKUP="/etc/mihomo/config.yaml.bak.$(date +%Y%m%d-%H%M%S)"
  cp -p /etc/mihomo/config.yaml "$BACKUP"
fi
# 使用独立缓存文件，避免失败时覆盖原订阅缓存。
PROVIDER_FILE="providers/subscription.$(date +%s).yaml"
python3 - "$TMP_DIR/config.yaml" "$PROVIDER_FILE" &lt;&lt;'PY_CACHE'
import json,sys
from pathlib import Path
p=Path(sys.argv[1]); cfg=json.loads(p.read_text())
cfg['proxy-providers']['subscription']['path']='./'+sys.argv[2]
p.write_text(json.dumps(cfg,ensure_ascii=False,indent=2)+'\n')
PY_CACHE
install -m 0600 "$TMP_DIR/subscription.yaml" "/etc/mihomo/$PROVIDER_FILE"
install -m 0600 "$TMP_DIR/config.yaml" /etc/mihomo/config.yaml

info '创建 systemd 服务...'
# Ubuntu 的 resolv.conf 可能是符号链接：恢复时保留链接类型。
cat &gt; /usr/local/sbin/mihomo-wsl-dns &lt;&lt;'DNSHELPER'
#!/usr/bin/env bash
set -e
case "${1:-}" in
  up)
    rm -f /etc/resolv.conf
    printf 'nameserver 127.0.0.1\noptions timeout:2 attempts:2\n' &gt; /etc/resolv.conf
    ;;
  down)
    if [[ -e /etc/mihomo/resolv.conf.before-mihomo || -L /etc/mihomo/resolv.conf.before-mihomo ]]; then
      rm -f /etc/resolv.conf
      cp -a /etc/mihomo/resolv.conf.before-mihomo /etc/resolv.conf
    fi
    ;;
  *) exit 2 ;;
esac
DNSHELPER
chmod 0755 /usr/local/sbin/mihomo-wsl-dns

cat &gt; /etc/systemd/system/mihomo.service &lt;&lt;'UNIT'
[Unit]
Description=Mihomo TUN for WSL 2 Ubuntu
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
ExecStartPre=/usr/local/sbin/mihomo-wsl-dns up
ExecStart=/usr/local/bin/mihomo -d /etc/mihomo
ExecStopPost=/usr/local/sbin/mihomo-wsl-dns down
Restart=on-failure
RestartSec=5
LimitNOFILE=1048576

[Install]
WantedBy=multi-user.target
UNIT

# WSL 环境：禁用自动生成 resolv.conf，避免自动 DNS 隧道绕过本地 DNS。
# 原生 Ubuntu 不修改 /etc/wsl.conf。
info '备份 Ubuntu 的 DNS 配置...'
if [[ ! -e /etc/mihomo/resolv.conf.before-mihomo &amp;&amp; ! -L /etc/mihomo/resolv.conf.before-mihomo ]]; then
  if [[ -e /etc/resolv.conf || -L /etc/resolv.conf ]]; then
    cp -a /etc/resolv.conf /etc/mihomo/resolv.conf.before-mihomo
  fi
fi
if [[ "$IS_WSL" == 1 ]]; then
  if [[ -f /etc/wsl.conf &amp;&amp; ! -f /etc/wsl.conf.before-mihomo ]]; then
    cp -a /etc/wsl.conf /etc/wsl.conf.before-mihomo
  fi
  ini_set network generateResolvConf false
fi
systemctl daemon-reload
systemctl enable mihomo
if ! systemctl restart mihomo; then
  [[ -z "$BACKUP" ]] || cp -p "$BACKUP" /etc/mihomo/config.yaml
  systemctl stop mihomo || true
  [[ -z "$BACKUP" ]] || systemctl start mihomo || true
  die '服务启动失败，已尝试恢复原配置。使用 sudo journalctl -u mihomo -n 80 查看日志'
fi
sleep 2
if ! systemctl is-active --quiet mihomo; then
  systemctl stop mihomo || true
  if [[ -n "$BACKUP" ]]; then
    cp -p "$BACKUP" /etc/mihomo/config.yaml
    systemctl start mihomo || true
  fi
  die '服务启动后退出，已尝试恢复原配置和 DNS；请查看日志'
fi

info '服务已启动，验证实际联网...'
CHECK_OK=1
ip link show mihomo-tun &gt;/dev/null 2&gt;&amp;1 || CHECK_OK=0
HTTP_IP="$(curl --noproxy '' -4 -x http://127.0.0.1:7890 --connect-timeout 8 --max-time 25 -fsS https://api.ipify.org || true)"
TUN_IP="$(curl --noproxy '*' -4 --connect-timeout 8 --max-time 25 -fsS https://api.ipify.org || true)"
if [[ -n "$HTTP_IP" &amp;&amp; -n "$TUN_IP" &amp;&amp; "$CHECK_OK" == 1 ]]; then
  info "HTTP 出口：$HTTP_IP；TUN 出口：$TUN_IP，请核对是否属于订阅节点"
else
  warn '服务运行，但联网验证未通过，不能认定部署成功'
  warn '请运行 check，并检查订阅节点可用性和服务日志'
  CHECK_OK=0
fi
info '安装及配置写入完成。' 
printf '\n'
printf '查看状态：sudo bash %s status\n' "$0"
printf '查看日志：sudo bash %s logs\n' "$0"
printf '检查出口：bash %s check\n' "$0"
printf '停止并恢复旧 DNS：sudo bash %s stop\n' "$0"
printf '启动：sudo bash %s start\n' "$0"
if [[ "$IS_WSL" == 1 ]]; then
  warn 'Windows PowerShell 执行 wsl --shutdown，再 wsl -d Ubuntu 以应用 WSL DNS 配置。'
  warn '推荐 WSL 使用 NAT 模式，禁用 Windows 的 autoProxy，并清除旧的 HTTP_PROXY 变量。'
fi
warn '这不是防泄漏 Kill Switch：启动前或 TUN 故障时可能直连；节点域名的引导 DNS 也可能直连。'
warn '如果 .bashrc 内曾设 Windows Clash 的 http_proxy/https_proxy，请手动删除它们。'

[[ "${CHECK_OK:-1}" == 1 ]] || exit 1
</pre>



