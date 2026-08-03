const { join } = require('path');

/**
 * Puppeteer configuration — stores Chrome inside the project directory
 * so it persists between Render builds and runtime containers.
 */
module.exports = {
  cacheDirectory: join(__dirname, '.puppeteer-cache'),
};
