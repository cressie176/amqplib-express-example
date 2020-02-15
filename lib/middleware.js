const debug = require('debug')('amqplib-express-example:middleware');

module.exports = {
  initialise
}

let broker;

function initialise(ctx = {}) {
  debug('initialise')
  broker = ctx.broker;
  const middleware = {
    forgotPassword
  }
  return { middleware, ...ctx }
}

function forgotPassword(req, res, next) {
  if (broker.isSaturated()) return res.status(503).json({ message: 'Broker is saturated' });
  if (broker.isInitialising()) return res.status(503).json({ message: 'Broker is initialising' });
  broker.publish('user-exchange', 'forgot_password', req.body)
    .then(messageId => res.status(202).json({ messageId }))
    .catch(next);
}
