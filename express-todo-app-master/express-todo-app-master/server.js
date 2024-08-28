const express = require("express");
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
require("dotenv").config();
const bcrypt = require("bcryptjs");
const session = require("express-session");
const mongoDbSession = require("connect-mongodb-session")(session);

const { userDataValidation, isEmailRgex, todoDataValidation } = require("./utils/authUtils");
const userModel = require("./models/userModel");
const todoModel = require("./models/todoModel");
const { isAuth } = require("./middlewares/authMiddleware");

const app = express();
const PORT = process.env.PORT;
const store = new mongoDbSession({
  uri: process.env.MONGO_URI,
  collection: "sessions",
});

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SECRET_KEY,
    resave: false,
    saveUninitialized: false,
    store,
  })
);

app.use(express.static("public"));

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("Mongodb connected");
  })
  .catch((err) => {
    console.log(err);
  });

app.get("/", (req, res) => {
  if (req.session.isAuth) return res.redirect("/dashboard");
  return res.redirect("/login");
});

app.get("/register", (req, res) => {
  return res.render("registerPage");
});

app.post("/register", async (req, res) => {
  const { name, email, username, password } = req.body;

  try {
    await userDataValidation({ name, email, username, password });
  } catch (error) {
    return res.status(400).json(error);
  }

  //email and username exist or noty

  const userEmailExist = await userModel.findOne({ email });

  if (userEmailExist) {
    return res.send({
      status: 400,
      message: "Email already exist",
    });
  }

  const userUsernameExist = await userModel.findOne({ username });

  if (userUsernameExist) {
    return res.send({
      status: 400,
      message: "Username already exist",
    });
  }

  //hashed the password
  const hashedPassword = await bcrypt.hash(password, parseInt(process.env.SALT));

  const userObj = new userModel({
    name,
    email,
    username,
    password: hashedPassword,
  });

  try {
    const userDb = await userObj.save();
    return res.redirect("/login");
  } catch (error) {
    return res.send({
      status: 500,
      message: "Internal server error",
      error: error,
    });
  }
});

app.get("/login", (req, res) => {
  if (req.session.isAuth) return res.redirect("/dashboard");
  else return res.render("loginPage");
});

app.post("/login", async (req, res) => {
  console.log(req.body);
  const { loginId, password } = req.body;
  if (!loginId || !password) return res.status(400).json("Missing Credentials");

  try {
    let userDb;
    if (isEmailRgex({ email: loginId })) {
      userDb = await userModel.findOne({ email: loginId });
    } else {
      userDb = await userModel.findOne({ username: loginId });
    }

    if (!userDb) {
      return res.status(400).json("User not found");
    }

    // passwrord match
    const isMatch = await bcrypt.compare(password, userDb.password);
    if (!isMatch) return res.status(400).json("Password does not matched");

    req.session.isAuth = true; //storing the session in DB
    req.session.user = {
      userId: userDb._id,
      username: userDb.username,
      email: userDb.email,
    };
    console.log(req.session.id);
    return res.redirect("/dashboard");
  } catch (error) {
    return res.send({
      status: 500,
      message: "Internal server error",
      error: error,
    });
  }
});

app.get("/dashboard", isAuth, (req, res) => {
  return res.render("dashboard");
});

app.post("/logout", isAuth, (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json("Logout failed");
    else return res.redirect("/login");
  });
});

app.post("/logout_all", isAuth, async (req, res) => {
  const username = req.session.user.username;

  const sessionSchema = new Schema({ _id: String }, { strict: false });
  const sessionModel = mongoose.model("session", sessionSchema);

  try {
    const deleteSession = await sessionModel.deleteMany({
      "session.user.username": username,
    });
    return res.redirect("/login");
  } catch (error) {
    return res.send({
      status: 500,
      message: "Internal server error",
      error: error,
    });
  }
});

app.post("/create-item", isAuth, async (req, res) => {
  const todoText = req.body.todo;
  const username = req.session.user.username;

  try {
    await todoDataValidation({ todo: todoText });
  } catch (error) {
    return res.send({
      status: 400,
      message: error,
    });
  }

  const todoObj = new todoModel({
    todo: todoText,
    username,
  });

  try {
    const todoDb = await todoObj.save();
    return res.send({
      status: 201,
      message: "Todo created successfully",
      data: todoDb,
    });
  } catch (error) {
    return res.send({
      status: 500,
      message: "Internal server error",
      error: error,
    });
  }
});

app.post("/get-item", isAuth, async (req, res) => {
  const username = req.session.user.username;
  try {
    const todoDb = await todoModel.find({ username });

    if (todoDb.length === 0) {
      return res.send({
        status: 404,
        message: "No todo found",
      });
    }

    return res.send({
      status: 200,
      message: "Todo fetched successfully",
      data: todoDb,
    });
  } catch (error) {
    return res.send({
      status: 500,
      message: "Internal server error",
      error: error,
    });
  }
});

app.post("/update-item", isAuth, async (req, res) => {
  const { todoId, newData } = req.body;
  const username = req.session.user.username;

  try {
    const todoDb = await todoModel.findOne({ _id: todoId });
    console.log(todoDb);

    if (username !== todoDb.username)
      return res.send({
        status: 403,
        message: "You are not authorized to update this item",
      });

    try {
      await todoDataValidation({ todo: newData });
    } catch (error) {
      return res.send({
        status: 400,
        error,
      });
    }

    const previousTodo = await todoModel.findOneAndUpdate({ _id: todoId }, { todo: newData });

    return res.send({
      status: 200,
      message: "Update item Successfully",
      data: previousTodo,
    });
  } catch (error) {
    return res.send({
      status: 500,
      message: "Internal server error",
      error: error,
    });
  }
});

app.post("/delete-item", isAuth, async (req, res) => {
  const { todoId } = req.body;
  const username = req.session.user.username;

  try {
    const todoDb = await todoModel.findOne({ _id: todoId });

    if (username !== todoDb.username)
      return res.send({
        status: 403,
        message: "You are not authorized to delete this item",
      });

    const deletedTodo = await todoModel.findOneAndDelete({ _id: todoId });

    return res.send({
      status: 200,
      message: "Item deleted successfully",
      data: deletedTodo,
    });
  } catch (error) {
    return res.send({
      status: 500,
      message: "Internal server error",
      error: error,
    });
  }
});


app.listen(PORT, () => {
  console.log(`Server is running on :: -------------------------->>> http://localhost:${PORT}/`);
});
