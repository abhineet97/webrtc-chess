# For deploying to now.sh. Not recommended for development purposes.
FROM golang:1.10.3-alpine 

RUN apk --update add git

WORKDIR /go/src/webrtc-chess

COPY dist .
COPY server .
COPY favicon.ico .

RUN go get -v -d golang.org/x/net/websocket && go install webrtc-chess

EXPOSE 8080

ENTRYPOINT webrtc-chess
