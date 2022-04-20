const express = require("express");
const app = express();
const PORT = 8082;
const cors = require("cors");
var amqp = require("amqplib/callback_api");
var _ = require('lodash');

app.use(express.json());
app.use(cors());

app.listen(PORT, () => console.log("Listening on " + PORT));

let connections = {
  1: [2, 3],
  2: [1, 3],
  3: [1, 3],
};

var thischannel;

amqp.connect("amqp://localhost", function (error0, connection) {
  if (error0) {
    throw error0;
  }
  connection.createChannel(function (error1, channel) {
    if (error1) {
      throw error1;
    }

    thischannel = channel;
  });
});

//Get all friends from a user
app.get("/friends/:id", (req, res) => {
  thischannel.assertQueue(
    "",
    {
      exclusive: true,
    },
    function (error2, q) {
      if (error2) {
        throw error2;
      }
      thischannel.sendToQueue("user_queue", Buffer.from("allusers"), {
        correlationId: "5",
        replyTo: q.queue,
      });

      thischannel.consume(
        q.queue,
        function (msg) {
          if (msg.properties.correlationId === "5") {
            var users = JSON.parse(msg.content);
            console.log(" [.] Got %s", users);

            if (!!connections[req.params.id]) {
              result = _.clone(connections[req.params.id]);
              
              for (i = 0; i < result.length; i++) {
                result[i] = users[result[i]];
              }

              res.status(200).send(result);
              return;
            } else {
              throw "The user with ID " + req.params.id + " does not exist.";
              return;
            }
          }
        },
        {
          noAck: true,
        }
      );
    }
  );
});

//Check if user has a specific friend
app.get("/friends/:id/:friendid", (req, res) => {
  if (!!connections[req.params.id]) {
    res
      .status(200)
      .send(connections[req.params.id].includes(parseInt(req.params.friendid)));
    return;
  } else {
    throw "The user with ID " + req.params.id + " does not exist.";
    return;
  }
});

app.delete("/friends/:id/:friendid", (req, res) => {
  if (!!connections[req.params.id]) {
    if (connections[req.params.id].includes(parseInt(req.params.friendid))) {
      connections[req.params.id].splice(
        connections[req.params.id].indexOf(parseInt(req.params.friendid)),
        1
      );
      res.status(200).send(connections[req.params.id]);
    } else {
      throw "The user does not have this person as friend.";
      return;
    }
  } else {
    throw "The user with ID " + req.params.id + " does not exist.";
    return;
  }
});

function requestUsers() {}

// channel.sendToQueue("user_queue", Buffer.from("allusers"), {
//     correlationId: correlationId,
//     replyTo: q.queue,
//   });

//   channel.consume(
//     q.queue,
//     function (msg) {
//       if (msg.properties.correlationId === correlationId) {
//         var users = JSON.parse(msg.content);
//         console.log(" [.] Got %s", users);
//         return users;
//       }
//     },
//     {
//       noAck: true,
//     }
//   );
