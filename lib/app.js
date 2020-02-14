const debug = require('debug')('amqplib-express-example:app');
const bodyParser = require('body-parser')
const express = require('express');
const app = express();


module.exports = {
  initialise,
}

function initialise(ctx = {}) {
  debug('initialise');
  app.use(bodyParser.json());
  app.post('/api/user/forgot-password', ctx.middleware.forgotPassword);
  app.use((req, res) => {
    res.status(404).json({ message: 'not found' });
  })
  app.use((err, req, res, next) => {
    console.error(err);
    if (res.headersSent) return next(err)
    res.status(500).json({ message: err.message });
  });

  return new Promise((resolve, reject) => {
    const server = app.listen(3000, '0.0.0.0', err => {
      if (err) return reject(err);
      console.log('Server listening on http://0.0.0.0:3000');
      resolve({ server, ...ctx });
    });
  });
}
