const express = require("express");
const app = express();
const PORT = 8082;
const cors = require("cors");
var amqp = require("amqplib/callback_api");
var _ = require("lodash");

app.use(express.json());
app.use(cors());

app.listen(PORT, () => console.log("Listening on " + PORT));

let connections = {
  1: [2, 3],
  2: [1, 3],
  3: [1, 2],
};

//Get all friends from a user
app.get("/api/frnds/:id", (req, res) => {
  amqp.connect("amqp://rabbitmq:5672", function (error0, connection) {
    if (error0) {
      throw error0;
    }
    connection.createChannel(function (error1, channel) {
      if (error1) {
        throw error1;
      }

      var queue = "users";

      channel.assertQueue(queue, {
        durable: false,
      });

      console.log(
        " [*] Waiting for messages in %s. To exit press CTRL+C",
        queue
      );

      channel.consume(
        queue,
        function (msg) {
          var users = JSON.parse(msg.content);
          console.log(" [.] Got %s", users);

          if (!!connections[req.params.id]) {
            var result = _.clone(connections[req.params.id]);
            for (let i = 0; i < result.length; i++) {
              result[i] = users[result[i]];
            }
            console.log(result)
            res.status(200).send(result);
            channel.close();
          } else {
            throw new Error("The user with ID " + req.params.id + " does not exist.");
          }
        },
        {
          noAck: true,
        }
      );
    });
  });
});

//Check if user has a specific friend
app.get("/api/frnds/:id/:friendid", (req, res) => {
  if (!!connections[req.params.id]) {
    res
      .status(200)
      .send(connections[req.params.id].includes(parseInt(req.params.friendid)));
  } else {
    throw new Error("The user with ID " + req.params.id + " does not exist.");
  }
});

app.delete("/api/frnds/:id/:friendid", (req, res) => {
  if (!!connections[req.params.id]) {
    if (connections[req.params.id].includes(parseInt(req.params.friendid))) {
      connections[req.params.id].splice(
        connections[req.params.id].indexOf(parseInt(req.params.friendid)),
        1
      );
      res.status(200).send(connections[req.params.id]);
    } else {
      throw new Error("The user does not have this person as friend.");
    }
  } else {
    throw new Error("The user with ID " + req.params.id + " does not exist.");
  }
});
