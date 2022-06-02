const { MongoClient, ObjectId } = require("mongodb");
const express = require("express");
const app = express();
const PORT = 8082;
const cors = require("cors");
var amqp = require("amqplib/callback_api");
var _ = require("lodash");

app.use(express.json());
app.use(cors());

app.listen(PORT, () => console.log("Listening on " + PORT));

const uri =
  "mongodb+srv://admin:admin@friendbook.ac2qv.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri);
client.connect();

amqp.connect("amqp://rabbitmq:5672", function (error0, connection) {
  if (error0) {
    throw error0;
  }
  connection.createChannel(function (error1, channel) {
    if (error1) {
      throw error1;
    }

    channel.assertQueue("actions", {
      durable: false,
    });

    channel.consume(
      "actions",
      function (msg) {
        var operation = JSON.parse(msg.content);
        switch (operation.type) {
          case "create":
            client
              .db("friendbook-friends")
              .collection("friends")
              .insertOne({ _id: operation.id, friendlist: [] });
            break;
          case "update":
            client
              .db("friendbook-friends")
              .collection("friends")
              .updateOne(
                { _id: operation.id },
                { $set: { username: `${operation.name}` } }
              );
            break;
          case "delete":
            client
              .db("friendbook-friends")
              .collection("friends")
              .deleteOne({ _id: operation.id });

            client
              .db("friendbook-friends")
              .collection("friends")
              .updateMany({}, {$pull: {friendlist: operation.id}})

            break;
          default:
            break;
        }
      },
      {
        noAck: true,
      }
    );
  });
});

//Send friends list from id
app.get("/api/frnds/all/:id", (req, res) => {
  client
    .db("friendbook-friends")
    .collection("friends")
    .findOne({ _id: req.params.id })
    .then((ans) => res.status(200).send(ans.friendlist));
});

//Creates a new user friendlist with user id as param
app.post("/api/frnds/:id", (req, res) => {
  client
    .db("friendbook-friends")
    .collection("friends")
    .insertOne({ _id: req.params.id, username: req.body.name, friendlist: [] }) //to change
    .then((ans) => res.status(200).send(ans));
});

//adds friend (friendid) to list of friends from user (id)
app.post("/api/frnds/:id/:friendid", (req, res) => {
  client
    .db("friendbook-friends")
    .collection("friends")
    .updateOne(
      { _id: req.params.id },
      { $addToSet: { friendlist: req.params.friendid } }
    )
    .then((ans) => res.status(200).send(ans));
});

//remove friendid from user (id) list
app.delete("/api/frnds/:id/:friendid", (req, res) => {
  client
    .db("friendbook-friends")
    .collection("friends")
    .updateOne(
      { _id: req.params.id },
      { $pull: { friendlist: req.params.friendid } }
    )
    .then((ans) => res.status(200).send(ans));
});

//Checks if id is friends with friendid
app.get("/api/frnds/:id/:friendid", (req, res) => {
  if (!!connections[req.params.id]) {
    res
      .status(200)
      .send(connections[req.params.id].includes(parseInt(req.params.friendid)));
  } else {
    throw new Error("The user with ID " + req.params.id + " does not exist.");
  }
});
