require("dotenv").config({
    path: require("path").join(__dirname, ".env"),
});

const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const bcrypt = require("bcryptjs");

const app = express();
const PORT = 3000;

// ================= MIDDLEWARE =================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// ================= USER SCHEMA =================

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    }
});

const User = mongoose.model("User", userSchema);

// ================= BLOG SCHEMA =================

const categories = [
    "Technology",
    "Education",
    "Programming",
    "Lifestyle",
    "Travel"
];

const blogSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    category: {
        type: String,
        enum: categories,
        default: "Technology"
    },
    author: {
        type: String,
        default: "Anonymous"
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Blog = mongoose.model("Blog", blogSchema);

// ================= REGISTER =================

app.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                message: "Name, email and password are required"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const existingUser = await User.findOne({
            email: normalizedEmail
        });

        if (existingUser) {
            return res.status(409).json({
                message: "Email already registered"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword
        });

        return res.status(201).json({
            message: "Registration successful",
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {
        console.error("Register error:", error.message);

        return res.status(500).json({
            message: "Registration failed"
        });
    }
});

// ================= LOGIN =================

app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required"
            });
        }

        const user = await User.findOne({
            email: email.trim().toLowerCase()
        });

        if (!user) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        let isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch && user.password === password) {
            user.password = await bcrypt.hash(password, 10);
            await user.save();
            isMatch = true;
        }

        if (!isMatch) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        return res.json({
            message: "Login successful",
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {
        console.error("Login error:", error.message);

        return res.status(500).json({
            message: "Login failed"
        });
    }
});

// ================= CREATE BLOG =================

app.post("/blogs", async (req, res) => {
    try {
        const { title, content, category, author } = req.body;

        if (
            typeof title !== "string" ||
            typeof content !== "string" ||
            !title.trim() ||
            !content.trim()
        ) {
            return res.status(400).json({
                message: "Title and content are required"
            });
        }

        const selectedCategory = category || "Technology";

        if (!categories.includes(selectedCategory)) {
            return res.status(400).json({
                message: "Invalid blog category"
            });
        }

        const blog = await Blog.create({
            title: title.trim(),
            content: content.trim(),
            category: selectedCategory,
            author: author || "Anonymous"
        });

        return res.status(201).json({
            message: "Blog created successfully",
            blog
        });

    } catch (error) {
        console.error("Create blog error:", error.message);

        return res.status(500).json({
            message: "Could not create blog"
        });
    }
});

// ================= GET ALL BLOGS / SEARCH / FILTER =================

app.get("/blogs", async (req, res) => {
    try {
        const { search, category } = req.query;

        const filter = {};

        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: "i" } },
                { content: { $regex: search, $options: "i" } }
            ];
        }

        if (category) {
            if (!categories.includes(category)) {
                return res.status(400).json({
                    message: "Invalid blog category"
                });
            }

            filter.category = category;
        }

        const blogs = await Blog.find(filter).sort({
            createdAt: -1
        });

        return res.json(blogs);

    } catch (error) {
        console.error("Get blogs error:", error.message);

        return res.status(500).json({
            message: "Could not fetch blogs"
        });
    }
});

// ================= GET SINGLE BLOG =================

app.get("/blogs/:id", async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                message: "Invalid blog ID"
            });
        }

        const blog = await Blog.findById(req.params.id);

        if (!blog) {
            return res.status(404).json({
                message: "Blog not found"
            });
        }

        return res.json(blog);

    } catch (error) {
        console.error("Get single blog error:", error.message);

        return res.status(500).json({
            message: "Could not fetch blog"
        });
    }
});

// ================= UPDATE BLOG =================

app.put("/blogs/:id", async (req, res) => {
    try {
        const { title, content, category, author } = req.body;

        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                message: "Invalid blog ID"
            });
        }

        if (
            typeof title !== "string" ||
            typeof content !== "string" ||
            !title.trim() ||
            !content.trim()
        ) {
            return res.status(400).json({
                message: "Title and content are required"
            });
        }

        const updateData = {
            title: title.trim(),
            content: content.trim()
        };

        if (category !== undefined) {
            if (!categories.includes(category)) {
                return res.status(400).json({
                    message: "Invalid blog category"
                });
            }

            updateData.category = category;
        }

        if (typeof author === "string") {
            updateData.author = author.trim();
        }

        const updatedBlog = await Blog.findByIdAndUpdate(
            req.params.id,
            updateData,
            {
                new: true,
                runValidators: true
            }
        );

        if (!updatedBlog) {
            return res.status(404).json({
                message: "Blog not found"
            });
        }

        return res.json({
            message: "Blog updated successfully",
            blog: updatedBlog
        });

    } catch (error) {
        console.error("Update blog error:", error.message);

        return res.status(500).json({
            message: "Could not update blog"
        });
    }
});

// ================= DELETE BLOG =================

app.delete("/blogs/:id", async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                message: "Invalid blog ID"
            });
        }

        const deletedBlog = await Blog.findByIdAndDelete(
            req.params.id
        );

        if (!deletedBlog) {
            return res.status(404).json({
                message: "Blog not found"
            });
        }

        return res.json({
            message: "Blog deleted successfully"
        });

    } catch (error) {
        console.error("Delete blog error:", error.message);

        return res.status(500).json({
            message: "Could not delete blog"
        });
    }
});

// ================= START SERVER =================

async function startServer() {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
        console.error("MONGODB_URI missing. Check the .env file.");
        process.exit(1);
    }

    try {
        await mongoose.connect(uri, {
            family: 4,
            dbName: "test"
        });

        console.log("MongoDB connected successfully");

        app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
        });

    } catch (error) {
        console.error("MongoDB connection failed:", error.message);
        process.exit(1);
    }
}

startServer();