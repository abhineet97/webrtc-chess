# WebRTC-Chess

Chess moves travelling through WebRTC.

## Build Instructions

**Server**

Install [Go](https://golang.org/) and then:

```sh
# cd to the project directory
$ cd webrtc-chess

# Build server binary
$ go build
```

**Client**

Install [Node.js](https://nodejs.org/en/) and then:

```sh
# Install dependencies.
$ npm install

# Build
$ npm run build
```

Start the app:

```sh
$ ./webrtc-chess
```

and then navigate to [http://localhost:8080](http://localhost:8080).

## License

[MIT](/LICENSE.md)
