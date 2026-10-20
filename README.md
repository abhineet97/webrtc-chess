# WebRTC Chess

Chess moves travelling through WebRTC.

## Build Instructions

Install [Node.js](https://nodejs.org/en/) and then:

```sh
# Install dependencies.
$ npm install

# Build
$ npm run build
```

Start the app:

```sh
$ npm start
```

and then navigate to [http://localhost:8080](http://localhost:8080).
The server serves the built client from `dist/` and relays WebRTC
offers and answers over WebSocket at `/ws`.

## License

[MIT](/LICENSE.md) © Abhineet Tamrakar
