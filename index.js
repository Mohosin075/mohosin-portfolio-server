const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;

// middleware
require("dotenv").config();
app.use(
  cors({
    origin: "*",
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
    // await client.connect();
    const beautyLuxeDB = client.db("beautyLuxe");
    await beautyLuxeDB.command({ ping: 1 });

    const userCollection = beautyLuxeDB.collection("users");
    const productCollection = beautyLuxeDB.collection("products");
    const cardCollection = beautyLuxeDB.collection("cards");

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

    // add Product
    app.post("/product", verifyJWT, async (req, res) => {
      const products = req.body;
      const result = await productCollection.insertOne(products);
      res.send(result);
    });

    app.get("/products", async (req, res) => {
      const { title, category, sort = "asc", page = 1, limit = 12 } = req.query;

      try {
        const pageNumber = Math.max(Number(page), 1);
        const limitNumber = Math.max(Number(limit), 1);

        const sortOption = sort === "asc" ? 1 : -1;

        const query = {};
        if (title) {
          query.name = { $regex: title, $options: "i" };
        }
        if (category) {
          query.category = { $regex: category, $options: "i" };
        }

        const product = await productCollection
          .find(query)
          .skip((pageNumber - 1) * limitNumber)
          .limit(limitNumber)
          .sort({ price: sortOption })
          .toArray();

        const total = await productCollection.countDocuments(query);

        const allProducts = await productCollection.find({}).toArray();
        const categories = [
          ...new Set(allProducts.map((product) => product.category)),
        ];

        // Send the response
        res.status(200).send({ product, categories, total, page: pageNumber });
      } catch (error) {
        console.error("Error fetching products:", error.message);
        res.status(500).send({ error: "Failed to fetch products." });
      }
    });

    // delete user
    app.delete(`/product/:id`, verifyJWT, async (req, res) => {
      const { id } = req?.params;

      const query = new ObjectId(id);

      const result = await productCollection.deleteOne({ _id: query });

      res.send(result);
    });

    // get seller product
    app.get("/products/:email", verifyJWT, async (req, res) => {
      const { email } = req?.params;
      const existingUser = await userCollection.findOne({ email });
      if (!existingUser) {
        res.send({ message: "This user Does not exist!" });
        return;
      }
      const result = await productCollection
        .find({ sellerEmail: email })
        .toArray();
      res.send(result);
    });

    // update product data
    app.patch(`/product/:id`, verifyJWT, async (req, res) => {
      const { id } = req?.params;
      const doc = req.body;

      const query = new ObjectId(id);

      const result = await productCollection.updateOne(
        { _id: query },
        { $set: doc },
        {
          upsert: true,
        }
      );

      res.send(result);
    });

    // get single product data
    app.get(`/product/:id`, async (req, res) => {
      const { id } = req?.params;
      const doc = req.body;

      const query = new ObjectId(id);

      const result = await productCollection.findOne({ _id: query });

      res.send(result);
    });

    app.patch("/add-wishlist", async (req, res) => {
      const { userEmail, productId } = req.body;

      const result = await userCollection.updateOne(
        { email: userEmail },
        { $addToSet: { wishlist: new ObjectId(String(productId)) } },
        { upsert: true }
      );

      res.send(result);
    });

    // remove from wishlist
    app.patch("/remove-wishlist", async (req, res) => {
      const { userEmail, productId } = req.body;

      const isObjectIdStored = true;
      const productIdToRemove = isObjectIdStored
        ? new ObjectId(String(productId))
        : productId;

      const result = await userCollection.updateOne(
        { email: userEmail },
        { $pull: { wishlist: productIdToRemove } }
      );

      res.send(result);
    });

    app.get("/wishlist/:email", async (req, res) => {
      const { email } = req.params;
      const user = await userCollection.findOne({ email });

      if (!user) {
        res.send("User not found!");
      }

      const result = await productCollection
        .find({ _id: { $in: user?.wishlist || [] } })
        .toArray();

      res.send(result);
    });

    // post cart
    app.post("/card", async (req, res) => {
      const { email, productId, quantity } = req.body;

      if (!email || !productId || quantity < 1) {
        return res.status(400).json({ message: "Invalid input data" });
      }

      try {
        // Check if cart exists for the user
        const userCart = await cardCollection.findOne({ email });

        if (userCart) {
          const existingItemIndex = userCart.items.findIndex(
            (item) => item.productId === productId
          );

          if (existingItemIndex > -1) {
            // Update the quantity
            userCart.items[existingItemIndex].quantity += quantity;
          } else {
            // Add new product
            userCart.items.push({ productId, quantity });
          }

          // Update the cart in the database
          await cardCollection.updateOne(
            { email },
            { $set: { items: userCart.items } }
          );
        } else {
          // Create a new cart for the user
          await cardCollection.insertOne({
            email,
            items: [{ productId, quantity }],
          });
        }

        res
          .status(200)
          .json({ message: "Item added/updated in cart", insertedId: 1 });
      } catch (error) {
        console.error("Error adding item to cart:", error);
        res.status(500).json({ message: "Server error" });
      }
    });

    // app.get("/card/:email", async (req, res) => {
    //   const { email } = req.params;

    //   try {
    //     // Find the cart for the user
    //     const cart = await cardCollection.findOne({ email });

    //     if (!cart || !cart.items || cart.items.length === 0) {
    //       return res
    //         .status(404)
    //         .json({ message: "Cart is empty or not found" });
    //     }

    //     // Retrieve product details for all product IDs in the cart
    //     const productIds = cart.items.map((product) => product.productId);
    //     const products = await productCollection
    //       .find({ _id: { $in: productIds.map((id) => new ObjectId(id)) } })
    //       .toArray();

    //     // Combine cart quantities with product details
    //     const detailedCart = cart.items.map((item) => {
    //       const productDetails = products.find(
    //         (product) => product._id.toString() === item.productId
    //       );
    //       return {
    //         ...productDetails,
    //         quantity: item.quantity,
    //       };
    //     });

    //     res.status(200).json({ email: cart.email, items: detailedCart });
    //   } catch (error) {
    //     console.error("Error fetching cart:", error);
    //     res.status(500).json({ message: "Server error" });
    //   }
    // });



    app.get("/card/:email", async (req, res) => {
      const { email } = req.params;
    
      try {
        // Find the cart for the user
        const cart = await cardCollection.findOne({ email });
    
        if (!cart || !cart.items || cart.items.length === 0) {
          return res
            .status(404)
            .json({ message: "Cart is empty or not found" });
        }
    
        // Retrieve product details for all product IDs in the cart
        const productIds = cart.items.map((product) => product.productId);
        const products = await productCollection
          .find({ _id: { $in: productIds.map((id) => new ObjectId(id)) } })
          .toArray();
    
        // Calculate the total price
        let totalPrice = 0;
        const detailedCart = cart.items.map((item) => {
          const productDetails = products.find(
            (product) => product._id.toString() === item.productId
          );
          if (productDetails) {
            totalPrice += productDetails.price * item.quantity; // Calculate total price
          }
          return {
            ...productDetails,
            quantity: item.quantity,
          };
        });
    
        // Send the response with cart items and total price
        res.status(200).json({ email: cart.email, items: detailedCart, totalPrice });
      } catch (error) {
        console.error("Error fetching cart:", error);
        res.status(500).json({ message: "Server error" });
      }
    });

    app.delete("/card/:email/:productId", async (req, res) => {
      const { email, productId } = req.params;

      try {
        // Update the cart by removing the specified product
        const result = await cardCollection.updateOne(
          { email },
          { $pull: { items: { productId } } }
        );

        if (result.modifiedCount === 0) {
          return res.status(404).json({ message: "Item not found in cart" });
        }

        res.status(200).json({ message: "Item removed from cart" });
      } catch (error) {
        console.error("Error removing item from cart:", error);
        res.status(500).json({ message: "Server error" });
      }
    });

    app.patch("/card", async (req, res) => {
      const { email, productId, quantity } = req.body;

      if (quantity < 1) {
        return res.status(400).json({ message: "Quantity must be at least 1" });
      }

      try {
        // Find the cart by email
        const cart = await cardCollection.findOne({ email });

        if (!cart) {
          return res.status(404).json({ message: "Cart not found" });
        }

        // Find the product in the cart and update the quantity
        const updatedCart = await cardCollection.updateOne(
          { email, "items.productId": productId },
          {
            $set: { "items.$.quantity": quantity },
          }
        );

        if (updatedCart.matchedCount === 0) {
          return res.status(404).json({ message: "Product not found in cart" });
        }

        res.status(200).json({ message: "Cart updated successfully" });
      } catch (error) {
        console.error("Error updating cart:", error);
        res.status(500).json({ message: "Server error" });
      }
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
