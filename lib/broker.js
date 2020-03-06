const debug = require('debug')('amqplib-express-example:broker');
const amqplib = require('amqplib');
const pWaterfall = require('p-waterfall');
const pSeries = require('p-series');
const pRetry = require('p-retry');
const uuid = require('uuid/v4');

module.exports = {
  initialise,
}

const state = { saturated: false, initialising: true };

function initialise(ctx = {}) {
  debug('initialise')
  const broker = {
    publish,
    isInitialising,
    isSaturated,
    destroy,
  };
  return pWaterfall([
    _connect,
    _createConfirmChannel,
    _stash,
    () => Promise.resolve({ broker, ...ctx })
  ]);
};

function destroy() {
  debug('destroy')
  return pSeries([
    _closeChannel,
    _closeConnection,
  ]);
}

function isInitialising() {
  return state.initialising;
}

function isSaturated() {
  return state.saturated;
}


function publish(exchange, routingKey, content) {
  debug('publish')
  const buffer = Buffer.from(JSON.stringify(content));
  const options = {
    messageId: uuid(),
    contentType: 'application/json',
    mandatory: true,
    persistent: true,
  }

  return pWaterfall([
    _getChannel,
    channel => {
      debug('Publishing %d bytes to %s[%s] with messageId: %s', buffer.length, exchange, routingKey, options.messageId);
      const onMessageReturned = _createOnMessageReturnedListener(channel, options.messageId);
      const timeout = _createTimeoutPromise(1000, options);
      return Promise.race([
        onMessageReturned.attach(),
        timeout.start(),
        _createPublishPromise(channel, exchange, routingKey, buffer, options),
      ])
      .finally(() => {
        timeout.cancel();
        onMessageReturned.detatch();
      });
    },
    () => Promise.resolve(options.messageId),
  ])
}

function _getChannel() {
  debug('_getChannel')
  return pRetry(() => new Promise((resolve, reject) => {
    return state.channel && !state.saturated
      ? resolve(state.channel)
      : reject(new Error('Channel unavailable'));
  }), {
    retries: 1000,
    onFailedAttempt: err => {
      debug(`Attempt ${err.attemptNumber}/1000 to a get channel failed with message: ${err.message}`);
    },
  });
}

function _createTimeoutPromise(timeout, options) {
  let ref;
  return {
    start: () => new Promise((resolve, reject) => {
      ref = setTimeout(() => {
        reject(new Error(`Message ${options.messageId} was not acknowledged in ${timeout}ms`));
      }, timeout).unref();
    }),
    cancel: () => clearTimeout(ref),
  }
}

function _createOnMessageReturnedListener(channel, messageId) {
  let listener;
  return {
    attach: () => new Promise((resolve, reject) => {
      debug(`Attaching return listener for message: ${messageId}`);
      listener = (message) => {
        if (message.properties.messageId !== messageId) return;
        debug(`Message ${messageId} was returned`);
        reject(new Error(`Message ${messageId} was returned`));
      }
      channel.on('return', listener);
    }),
    detatch: () => {
      debug(`Detaching return listener for message: ${messageId}`);
      channel.removeListener('return', listener);
    }
  }
}

function _createPublishPromise(channel, exchange, routingKey, buffer, options) {
  return new Promise((resolve, reject) => {
    const ok = channel.publish(exchange, routingKey, buffer, options, err => {
      if (err) return reject(err);
      debug(`Message: ${options.messageId} was acknowledged by the broker`);
      state.saturated = !ok;
      resolve();
    })
  })
}

function _connect(ctx) {
  debug('_connect');

  if (state.connection) return Promise.resolve({ ...state, ...ctx });

  return amqplib.connect('amqp://localhost?heartbeat=1')
    .then(connection => {
      connection.on('error', _onConnectionError);
      connection.on('close', _onConnectionClose);
      return { connection, ...ctx }
    });
}

function _createConfirmChannel(ctx) {
  debug('_createConfirmChannel');

  if (state.channel) return Promise.resolve({ ...state, ...ctx });

  return ctx.connection.createConfirmChannel()
    .then(channel => {
      channel.on('error', _onChannelError);
      channel.on('close', _onChannelClose);
      channel.on('drain', _onChannelDrain);
      return { channel, saturated: false, initialising: false, ...ctx }
    });
}

function _stash(ctx) {
  debug('_stash');
  Object.assign(state, ctx);
}

function _closeChannel() {
  debug('_closeChannel');

  if (!state.channel) return Promise.resolve();

  _removeChannelEventListeners(state.channel);

  const channel = state.channel;
  state.channel = null;
  return channel.close()
}

function _closeConnection() {
  debug('_closeConnection');

  if (!state.connection) return Promise.resolve();

  _removeConnectionEventListeners(state.connection);

  const connection = state.connection;
  state.connection = null;
  return connection.close()
}

function _onConnectionError(err) {
  debug('_onConnectionError: %o', err);
  _reinitialise();
}

function _onConnectionClose() {
  debug('_onConnectionClose');
  _reinitialise();
}

function _onChannelError(err) {
  debug('_onChannelError: %o', err);
  _reinitialise();
}

function _onChannelClose() {
  debug('_onChannelClose');
  _reinitialise();
}

function _onChannelDrain() {
  debug('_onChannelClose');
  state.saturated = false;
}

function _reinitialise() {
  debug('_reinitialise');
  _removeChannelEventListeners();
  _removeConnectionEventListeners();
  state.connection = null;
  state.channel = null;
  state.saturated = false;
  state.initialising = true;

  return pRetry(initialise, {
    retries: 1000,
    onFailedAttempt: err => {
      debug(`Attempt ${err.attemptNumber}/1000 to reinitialise failed with message: ${err.message}`);
    },
  });
}

function _removeChannelEventListeners() {
  debug('_removeChannelEventListeners')
  state.channel.removeListener('error', _onChannelError);
  state.channel.removeListener('close', _onChannelClose);
  state.channel.removeListener('drain', _onChannelDrain);
}

function _removeConnectionEventListeners() {
  debug('_removeConnectionEventListeners')
  state.connection.removeListener('error', _onConnectionError);
  state.connection.removeListener('close', _onConnectionClose);
}



