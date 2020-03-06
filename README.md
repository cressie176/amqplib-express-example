# amqplib and express example
This application demonstrates how to use amqplib with express in response to [this](https://github.com/squaremo/amqp.node/issues/555) issue. Points of note are:

* Assertion of RabbitMQ topology on application start
* Automated recovery following connection or channel errors
* Detects and reports
    * saturated channels
    * unroutable messages
    * unacknowledged publishes
* Provides graceful startup and shutdown

There are several ways of using amqplib, each with different trade-offs. Alternative approaches might open/close a channel for each publish command, or maintain a pool of permanently open channels. Others may perfer performance over reliability and not use a confirm channel. The code would also have been more coherent if I had used async/await, but the original poster was experiences difficulty with promises, so I went with them instead.

#### Prerequisite
* Node 12

#### Starting the app
```
npm install
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
sleep 10
DEBUG='amqplib-express-example:*' node index.js
```

#### Exercising the app
```
curl -H "Content-Type: application/json" -X POST -d '{ "email": "foo@bar.com" }' http://localhost:3000/api/user/forgot-password
```
*Unless you create a queue and bind it to the `user-exchange` the application will report that messages are returned*

#### Testing automated recovery (connection close)
```
docker restart rabbitmq
```

#### Testing automated recovery (connection error)
```
docker kill rabbitmq
docker restart rabbitmq
```


#### Testing automated recovery (heartbeat timeout)
```
docker pause rabbitmq
sleep 5
docker unpause rabbitmq
```
