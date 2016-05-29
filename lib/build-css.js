var path = require("path");
var fs = require("fs");

var styleCSS = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');
var boardCSS = fs.readFileSync(path.join(__dirname, 'chessboard', 'chessboard.css'), 'utf8');

//http://stackoverflow.com/questions/28834835/readfile-in-base64-nodejs
var chessPiecesBase64 = new Buffer(
  fs.readFileSync(path.join(__dirname, 'chessboard', 'chesspieces.png'))
).toString('base64');

boardCSS = boardCSS.replace('chesspieces.png', 'data:image/png;base64,' + chessPiecesBase64);

var css = styleCSS + boardCSS;

fs.writeFileSync(path.join('..', 'bundle.css'), css, 'utf8');