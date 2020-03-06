const debug = require('debug')('amqplib-express-example:signal-handlers');
const pSeries = require('p-series');


module.exports = {
  initialise,
}

function initialise(ctx) {
  debug('initialise');
  return new Promise(resolve => {
    process.once('SIGINT', () => _shutdown(ctx));
    process.once('SIGTERM', () => _shutdown(ctx));
    resolve({ ...ctx });
  });
}

function _shutdown({ server, broker }) {
  debug('_shutdown');
  pSeries([
    () => _shutdownServer(server),
    () => _shutdownBroker(broker),
    () => process.exit(0),
  ]).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

// For how to do this gracefully see https://expressjs.com/en/advanced/healthcheck-graceful-shutdown.html
function _shutdownServer(server) {
  debug('_shutdownServer');
  return new Promise((resolve, reject) => {
    server.close(err => {
      if (err) return reject(err);
      resolve();
    });
  })
}

function _shutdownBroker(broker) {
  debug('_shutdownBroker');
  return broker.destroy();
}
