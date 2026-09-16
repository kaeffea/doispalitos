FROM nginx:1.25-alpine

# Remove a config padrão do Nginx e copia a nossa
RUN rm /etc/nginx/conf.d/default.conf
COPY default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
