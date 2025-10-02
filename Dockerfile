FROM nginx:alpine

# 安装 certbot 和 bash
RUN apk add --no-cache certbot certbot-nginx bash curl

# 拷贝 Nginx 配置
COPY default.conf /etc/nginx/conf.d/default.conf

# 拷贝启动脚本
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80 443

CMD ["sleep 6666"]
