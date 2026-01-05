FROM node:18-alpine as builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

ARG VITE_BACKEND_PROTOCOL=http
ARG VITE_BACKEND_HOST=localhost
ARG VITE_BACKEND_PORT=3000

ENV VITE_BACKEND_PROTOCOL=${VITE_BACKEND_PROTOCOL}
ENV VITE_BACKEND_HOST=${VITE_BACKEND_HOST}
ENV VITE_BACKEND_PORT=${VITE_BACKEND_PORT}

RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
