FROM golang:1.10.3-alpine 

RUN apk --update add git

WORKDIR /go/src/webrtc-chess

COPY . .

RUN go get -v -d golang.org/x/net/websocket && go install webrtc-chess

CMD webrtc-chess
