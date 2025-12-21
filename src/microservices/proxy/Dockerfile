FROM kong:3.6

USER root

COPY kong.yml.template /etc/kong/kong.yml.template
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

USER kong
ENTRYPOINT ["/docker-entrypoint.sh"]
