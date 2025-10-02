FROM nginx:alpine

RUN apk add --no-cache bash curl

# 拷贝 Nginx 配置
COPY default.conf /etc/nginx/conf.d/default.conf

# 拷贝证书到容器
COPY fullchain.pem /etc/letsencrypt/live/blog.zrhe2016.cc/fullchain.pem
COPY privkey.pem /etc/letsencrypt/live/blog.zrhe2016.cc/privkey.pem

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
