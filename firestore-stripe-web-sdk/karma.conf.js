const karma = require("karma");
const webpackTestConfig = require("./webpack.test");

const config = {
  // files to load into karma
  files: ["test/**/*.ts", "src/**/*.ts"],

  // frameworks to use
  // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
  frameworks: ["mocha"],

  // Doing 65 seconds to allow for the 20 second firestore tests
  browserNoActivityTimeout: 65000,

  // preprocess matching files before serving them to the browser
  // available preprocessors:
  // https://npmjs.org/browse/keyword/karma-preprocessor
  preprocessors: {
    "**/*.ts": ["webpack", "sourcemap"],
  },

  mime: { "text/x-typescript": ["ts", "tsx"] },

  // test results reporter to use
  // possible values: 'dots', 'progress', 'coverage-istanbul'
  // available reporters: https://npmjs.org/browse/keyword/karma-reporter
  reporters: ["mocha"],

  // web server port
  port: 8089,

  // enable / disable colors in the output (reporters and logs)
  colors: true,

  // level of logging
  // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN
  // || config.LOG_INFO || config.LOG_DEBUG
  logLevel: karma.constants.LOG_INFO,

  // enable / disable watching file and executing tests whenever any file
  // changes
  autoWatch: false,

  // start these browsers
  // available browser launchers:
  // https://npmjs.org/browse/keyword/karma-launcher
  browsers: ["ChromeHeadless"],

  webpack: webpackTestConfig,

  webpackMiddleware: { quiet: true, stats: { colors: true } },

  singleRun: false,

  client: {
    mocha: {
      timeout: 5000,
    },
  },

  mochaReporter: {
    showDiff: true,
  },
};

module.exports = function (karmaConfig) {
  karmaConfig.set(config);
};
