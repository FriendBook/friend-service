const express = require('express');
const app = express();
const PORT = 8082;
const cors = require('cors');
var amqp = require('amqplib/callback_api');

app.use(express.json());
app.use(cors());

app.listen(PORT, () => console.log('Listening on ' + PORT));

let connections = {
    1: [2,3,4,5,6,7,8,9],
    2: [1,4,5],
    3: [1,5,7]
};

//Get all friends from a user
app.get('/friends/:id', (req, res) => {
    if(!!connections[req.params.id]) {
        res.status(200).send(connections[req.params.id])
        return
    }
    else
    {
        throw 'The user with ID ' + req.params.id + ' does not exist.'
        return
    }
});

//Check if user has a specific friend
app.get('/friends/:id/:friendid', (req, res) => {
    if(!!connections[req.params.id]) {
        res.status(200).send(connections[req.params.id].includes(parseInt(req.params.friendid)))
        return
    }
    else
    {
        throw 'The user with ID ' + req.params.id + ' does not exist.'
        return
    }
});

app.delete('/friends/:id/:friendid', (req, res) => {
    if(!!connections[req.params.id]) {
        if(connections[req.params.id].includes(parseInt(req.params.friendid))) {
            connections[req.params.id].splice(connections[req.params.id].indexOf(parseInt(req.params.friendid)), 1)
            res.status(200).send(connections[req.params.id])
        }
        else
        {
            throw 'The user does not have this person as friend.'
            return
        }
    }
    else
    {
        throw 'The user with ID ' + req.params.id + ' does not exist.'
        return
    }
})

amqp.connect('amqp://localhost', function(error0, connection) {
    if (error0) {
        throw error0;
    }
    connection.createChannel(function(error1, channel) {
        if (error1) {
            throw error1;
        }

        var queue = 'hello';

        channel.assertQueue(queue, {
            durable: false
        });

        console.log(" [*] Waiting for messages in %s. To exit press CTRL+C", queue);

        channel.consume(queue, function(msg) {
            console.log(" [x] Received %s", JSON.parse(msg.content.toString()));
        }, {
            noAck: true
        });
    });
});