# ПОЯСНЕНИЯ

## Использование Docker Desktop вместо Minikube

В рамках выполнения задания Minikube не использовался.
В качестве Kubernetes-кластера был выбран встроенный Kubernetes в Docker Desktop.

Причина выбора Docker Desktop:

- Kubernetes уже предустановлен и запущен в Docker Desktop
- Не требуется поднимать отдельную VM (как в Minikube)
- Упрощена локальная разработка и отладка
- Меньше конфликтов с kubeconfig и сетевыми настройками

### Переключаемся на docker-desktop и фиксируем контекст

```bash
kubectl config use-context docker-desktop
kubectl config current-context
# docker-desktop
kubectl get nodes
```

в Kubernetes от Docker Desktop Ingress Controller по умолчанию отсутствует.
Поэтому он был установлен вручную.

### Установка ingress-nginx Controller

Для поддержки ресурсов Ingress был установлен сторонний Ingress Controller — ingress-nginx:

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.13.2/deploy/static/provider/cloud/deploy.yaml
```

Ждём, пока поднимется контроллер:

```bash
kubectl rollout status deployment/ingress-nginx-controller -n ingress-nginx
kubectl get pods -n ingress-nginx
kubectl get svc  -n ingress-nginx
```

Должен быть ingress-nginx-controller в Running.

В результате:

- был создан namespace ingress-nginx
- запущен pod ingress-nginx-controller
- ingress-nginx начал обрабатывать ресурсы Ingress

Далее

```bash
helm install cinemaabyss .\src\kubernetes\helm --namespace cinemaabyss --create-namespace
```

Ждем пока все поднимется

```bash
kubectl get pod -n cinemaabyss
```

### Итог

- Kubernetes кластер: Docker Desktop
- Minikube: не использовался
- Ingress Controller: ingress-nginx (установлен вручную)
- Маршрутизация: через собственный Ingress ресурс
