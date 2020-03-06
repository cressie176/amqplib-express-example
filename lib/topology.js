const debug = require('debug')('amqplib-express-example:topology');
const amqplib = require('amqplib');
const pWaterfall = require('p-waterfall');

module.exports = {
  initialise,
}

function initialise(ctx = {}) {
  return pWaterfall([
    _connect,
    _createChannel,
    _assertExchange,
    _closeChannel,
    _closeConnection,
    () => Promise.resolve({ ...ctx }),
  ]);
}

function _connect(ctx) {
  debug('connect');
  return amqplib.connect('amqp://localhost')
    .then(connection => {
      connection.on('error', _onConnectionError);
      connection.on('close', _onConnectionClose);
      return { connection, ...ctx }
    });
}

function _createChannel(ctx) {
  debug('_createChannel');
  return ctx.connection.createChannel()
    .then(channel => {
      channel.on('error', _onChannelError);
      channel.on('close', _onChannelClose);
      return { channel, ...ctx }
    });
}

function _assertExchange(ctx) {
  debug('_assertExchange');
  return ctx.channel.assertExchange('user-exchange', 'topic')
    .then(() => ({ ...ctx }))

}

function _closeChannel(ctx) {
  debug('_closeChannel');
  const { channel, ...ctxWithoutChannel } = ctx;
  channel.removeListener('error', _onChannelError);
  channel.removeListener('close', _onChannelClose);
  return channel.close()
    .then(() => ({ ...ctxWithoutChannel }));
}

function _closeConnection(ctx) {
  debug('_closeConnection');
  const { connection, ...ctxWithoutConnection } = ctx;
  connection.removeListener('error', _onConnectionError);
  connection.removeListener('close', _onConnectionClose);
  return ctx.connection.close()
    .then(() => ({ ...ctxWithoutConnection }));
}


function _onConnectionError(err) {
  console.error(err);
  process.exit(1);
}

function _onConnectionClose() {
  console.warn('Connection closed');
  process.exit(2);
}

function _onChannelError(err) {
  console.error(err);
  process.exit(1);
}

function _onChannelClose() {
  console.warn('Connection closed');
  process.exit(2);
}

