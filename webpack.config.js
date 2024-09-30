const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './src/client/index.js',
  entry: {
    index: './src/client/index.js',
  },
  output: {
    path: path.resolve(__dirname, 'public'),
    filename: '[name].bundle.js',
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
            plugins: ['babel-plugin-transform-require']
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: 'src/client/index.html',  // 指定模版文件路径
      filename: 'index.html',  // 输出文件名
      chunks: ['index'],  // 指定该 HTML 文件需要包含的 chunk
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname),  // 这里假设你的源代码在src目录下
    },
  },
  devServer: {
    static: {
        directory: path.join(__dirname, 'public')
    },
    compress: true,
    port: 9000,
    proxy: [
        {
          context: ['/api'], // 你的 API 路径
          target: 'http://localhost:3000',
        },
        {
          context: ['/tms'], // 你的 API 路径
          target: 'http://localhost:3000',
        },
    ]
  },
};
