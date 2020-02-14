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

#### Testing automated recovery (1)
```
docker restart rabbitmq
```

#### Testing automated recovery (2)
```
docker kill rabbitmq
docker restart rabbitmq
```
