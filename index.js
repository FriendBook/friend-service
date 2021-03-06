const { MongoClient } = require("mongodb");
const express = require("express");
const app = express();
const PORT = 8082;
const cors = require("cors");
const amqp = require("amqplib/callback_api");
const jwt = require("jsonwebtoken");
const session = require("express-session");
const Keycloak = require("keycloak-connect");

app.use(express.json());
app.use(cors());

const kcConfig = {
  clientId: "react-auth",
  bearerOnly: true,
  serverUrl: "http://localhost:8080/auth/",
  realm: "Friendbook",
  realmPublicKey:
    "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAi60VZKmGbOEmHJgV2nTylCNjzyLa1DRKDChAoPgWGbURzer1Ba8mivPOlxP2+wr+w/cNcagz4n+N3+03kMa7XEPhzh5C6rMQh38Dw9S43QRF3hbv88sqaweG0KvD5NOrlYLJmJ6RGb2fH6dC0IQ4JkBhtQ6Wa3kt0Omum8f7aLR5BmmEkK77/ebFtoUNPVASP9Y8LR0fO8TjcZwf6OGShI6BOYAtHdErg6lPPIzR2EYg0JR8wCT96zQv0DV9OCyaDqRXaEb2G8fatNxGOWNBG7xTxUgidNxM/BAD22DqTYXm56JF4DchSPU63Mqd3z7wsUG9KjfQSEVgPbsGhEU4cQIDAQAB",
};

const memoryStore = new session.MemoryStore();
const keycloak = new Keycloak({ store: memoryStore }, kcConfig);

app.listen(PORT, () => console.log("Listening on " + PORT));

let secret = [
  "-----BEGIN PUBLIC KEY-----",
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAi60VZKmGbOEmHJgV2nTylCNjzyLa1DRKDChAoPgWGbURzer1Ba8mivPOlxP2+wr+w/cNcagz4n+N3+03kMa7XEPhzh5C6rMQh38Dw9S43QRF3hbv88sqaweG0KvD5NOrlYLJmJ6RGb2fH6dC0IQ4JkBhtQ6Wa3kt0Omum8f7aLR5BmmEkK77/ebFtoUNPVASP9Y8LR0fO8TjcZwf6OGShI6BOYAtHdErg6lPPIzR2EYg0JR8wCT96zQv0DV9OCyaDqRXaEb2G8fatNxGOWNBG7xTxUgidNxM/BAD22DqTYXm56JF4DchSPU63Mqd3z7wsUG9KjfQSEVgPbsGhEU4cQIDAQAB",
  "-----END PUBLIC KEY-----",
].join("\n");

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

    channel.assertQueue("friends", {
      durable: false,
    });

    channel.consume(
      "friends",
      function (msg) {
        const operation = JSON.parse(msg.content);
        switch (operation.type) {
          case "create":
            client.db("friendbook-friends").collection("friends").insertOne({
              _id: operation.id,
              username: operation.name,
              friendlist: [],
            });
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
              .updateMany({}, { $pull: { friendlist: operation.id } });

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

//Send full friend list from id
app.get("/api/frnds/:id", (req, res) => {
  jwt.verify(
    req.headers.authorization.replace("Bearer ", ""),
    secret,
    { algorithms: ["RS256"] },
    function (err) {
      if (err) {
        throw err;
      }
      client
        .db("friendbook-friends")
        .collection("friends")
        .findOne({ _id: req.params.id })
        .then((result) =>
          client
            .db("friendbook-friends")
            .collection("friends")
            .find({
              _id: { $in: result.friendlist },
            })
            .toArray(function (err, docs) {
              if (err) throw err;
              const aux = [];
              docs.forEach((element) => {
                aux.push(element.username);
              });

              res.status(200).send(aux);
            })
        );
    }
  );
});

//Checks if id is friends with friendid
app.get("/api/frnds/:id/:friendid", keycloak.protect(), (req, res) => {
  client
    .db("friendbook-friends")
    .collection("friends")
    .findOne({ _id: req.params.id })
    .then((ans) =>
      res.status(200).send(ans.friendlist.includes(req.params.friendid))
    );
});

//adds friend (friendid) to list of friends from user (id)
app.post("/api/frnds/:id/:friendid", keycloak.protect(), (req, res) => {
  client
    .db("friendbook-friends")
    .collection("friends")
    .updateOne(
      { _id: req.params.id },
      { $addToSet: { friendlist: req.params.friendid } }
    )
    .then((ans) => res.status(200).send(ans));
});

// //Creates a new user friendlist with user id as param
// app.post("/api/frnds/:id", (req, res) => {
//   jwt.verify(
//     req.headers.authorization.replace("Bearer ", ""),
//     secret,
//     { algorithms: ["RS256"] },
//     function (err) {
//       if (err) {
//         throw err;
//       }
//       client
//         .db("friendbook-friends")
//         .collection("friends")
//         .insertOne({
//           _id: req.params.id.toString(),
//           username: req.body.name.toString(),
//           friendlist: [],
//         })
//         .then((ans) => res.status(200).send(ans));
//     }
//   );
// });

// //remove friendid from user (id) list
// app.delete("/api/frnds/:id/:friendid", (req, res) => {
//   client
//     .db("friendbook-friends")
//     .collection("friends")
//     .updateOne(
//       { _id: req.params.id },
//       { $pull: { friendlist: req.params.friendid } }
//     )
//     .then((ans) => res.status(200).send(ans));
// });
