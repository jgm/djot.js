const path = require('path');

module.exports = {
  mode: 'production',
  entry: './src/index.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: 'djot.js',
    path: path.resolve(__dirname, 'dist'),
    globalObject: 'this',
    library: {
      name: 'djot',
      type: 'umd'
    }
  },
  externals: {
    fs: 'commonjs fs', // Exclude the 'fs' module from the bundle
    // Add other Node.js built-in modules as needed
  },
};
