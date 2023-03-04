FROM node:16-alpine AS frontend

ENV CI=true
ARG PORT=8080
ENV PORT=${PORT}

WORKDIR /code

COPY package*.json /code/

RUN npm ci

COPY . /code

RUN npm run build

FROM golang:1.20-alpine AS backend

WORKDIR /code

COPY go.mod go.sum ./
RUN go mod download

COPY server.go server.go
RUN go build -o bin/server server.go

COPY --from=frontend /code/dist /code/dist

CMD ["/code/bin/server"]
