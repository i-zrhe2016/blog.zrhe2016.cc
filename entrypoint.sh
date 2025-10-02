#!/bin/sh

# 第一次启动时申请证书
if [ ! -f /etc/letsencrypt/live/blog.zrhe2016.cc/fullchain.pem ]; then
    certbot certonly --nginx \
        -d blog.zrhe2016.cc \
        --non-interactive --agree-tos \
        -m zrhe2016@gmail.com
fi

# 定时续期
(crontab -l ; echo "0 3 * * * certbot renew --quiet && nginx -s reload") | crontab -

# 启动 cron 和 nginx
crond
nginx -g "daemon off;"
