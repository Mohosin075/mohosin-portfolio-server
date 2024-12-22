const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = 3000;

// middleware
require("dotenv").config();
app.use(cors());
app.use(express.json());

// Middleware to verify JWT
const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res
      .status(401)
      .send({ message: "Unauthorized access: No token provided" });
  }

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.JWT_ACCESS_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "Forbidden: Invalid token" });
    }
    req.user = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fudiykq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const beautyLuxeDB = client.db("beautyLuxe");
    await beautyLuxeDB.command({ ping: 1 });

    const userCollection = beautyLuxeDB.collection("users");

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    app.post("/jwt", (req, res) => {
      const email = req.body;
      if (!email) {
        res.send("email not found!");
      }
      const token = jwt.sign(email, process.env.JWT_ACCESS_SECRET, {
        expiresIn: "10d",
      });

      res.send({ token });
    });

    // get all user
    app.get("/users", verifyJWT, async (req, res) => {
      const users = await userCollection.find().toArray();

      res.send(users);
    });

    // get single user
    app.get("/user/:email", verifyJWT, async (req, res) => {
      const { email } = req?.params;
      const existUser = await userCollection.findOne({ email });
      if (!existUser) {
        res.send({ message: "User Does not exist!" });
        return;
      }

      res.send(existUser);
    });

    // post user
    app.post(`/user/:email`, async (req, res) => {
      const { email } = req?.params;
      const { userData } = req?.body;

      const existingUser = await userCollection.findOne({ email });
      if (existingUser) {
        res.send({ message: "This user Already exist!" });
        return;
      }
      const result = await userCollection.insertOne(userData);
      res.send(result);
    });

    // delete user
    app.delete(`/user/:id`, verifyJWT, async (req, res) => {
      const { id } = req?.params;

      const query = new ObjectId(id);

      const result = await userCollection.deleteOne({ _id: query });

      res.send(result);
    });

    // update user data
    app.patch(`/user/:id`, verifyJWT, async (req, res) => {
      const { id } = req?.params;
      const doc = req.body;

      const query = new ObjectId(id);

      const result = await userCollection.updateOne(
        { _id: query },
        { $set: doc },
        {
          upsert: true,
        }
      );

      res.send(result);
    });
  } catch (err) {
    console.log(err);
  }
}
run();

app.get("/", (req, res) => {
  res.send("server is  running...!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
