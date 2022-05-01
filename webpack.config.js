const path = require('path');
const webpack = require('webpack');

const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

const OUTPUT_DIR = path.resolve(__dirname, 'dist');

const config = {
  mode: 'development',
  entry: './app/main.js',
  output: {
    path: OUTPUT_DIR,
    filename: '[name].[contenthash].js',
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: [
          'style-loader',
          'css-loader',
        ],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './app/index.html',
    }),
    new CopyPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'app', 'static'),
          to: OUTPUT_DIR,
        },
      ],
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser',
    }) 
  ],
};

module.exports = (env, argv) => {
  if (argv.mode === 'development') {
    config.devtool = 'inline-source-map';
  } else if (argv.mode === 'production') {
    config.mode = 'production';
  }

  return config;
};
