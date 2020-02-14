const debug = require('debug')('amqplib-express-example:index');
const pWaterfall = require('p-waterfall');
const topology = require('./lib/topology');
const broker = require('./lib/broker');
const middleware = require('./lib/middleware');
const app = require('./lib/app');
const signalHandlers = require('./lib/signal-handlers');

pWaterfall([
  // Create the RabbitMQ topology as part of application start-up
  topology.initialise,

  // Intialise a recoverable connection to the broker
  broker.initialise,

  // Inject the broker into the middleware
  middleware.initialise,

  // Configure the routes and start the server
  app.initialise,

  // Register SIGINT and SIGTERM listens to stop the app gracefully
  signalHandlers.initialise,
])
.catch(err => {
  console.error(err);
  process.exit(1);
});
