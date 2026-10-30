require("dotenv").config({
    path: require("path").join(__dirname, ".env")
});

const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------------- CATEGORIES ----------------

const categories = [
    "Technology",
    "Education",
    "Programming",
    "Lifestyle",
    "Travel"
];

// ---------------- USER SCHEMA ----------------

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    }
}, { timestamps: true });

const User = mongoose.model("User", userSchema);

// ---------------- BLOG SCHEMA ----------------

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
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Blog = mongoose.model("Blog", blogSchema);

// ---------------- JWT AUTHENTICATION ----------------

async function verifyToken(req, res, next) {

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            message: "Please login first"
        });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        const user = await User.findById(decoded.userId)
            .select("_id name email");

        if (!user) {
            return res.status(401).json({
                message: "User not found. Please login again."
            });
        }

        req.user = user;
        next();

    } catch (error) {
        return res.status(401).json({
            message: "Invalid or expired token"
        });
    }
}

// ---------------- REGISTER ----------------

app.post("/register", async (req, res) => {

    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                message: "All fields are required"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                message: "Password must contain at least 6 characters"
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

// ---------------- LOGIN ----------------

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

        let isMatch = await bcrypt.compare(
            password,
            user.password
        );

        // Support old accounts with plain-text passwords once.
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

        const token = jwt.sign(
            { userId: user._id.toString() },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        return res.json({
            message: "Login successful",
            token,
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

// ---------------- USER PROFILE ----------------

app.get("/profile", verifyToken, (req, res) => {

    res.json({
        user: {
            id: req.user._id,
            name: req.user.name,
            email: req.user.email
        }
    });
});

// ---------------- CREATE BLOG ----------------

app.post("/blogs", verifyToken, async (req, res) => {

    try {
        const { title, content, category } = req.body;

        if (
            typeof title !== "string" ||
            !title.trim() ||
            typeof content !== "string" ||
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
            author: req.user.name,
            userId: req.user._id
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

// ---------------- GET MY BLOGS / SEARCH / FILTER ----------------

app.get("/blogs", verifyToken, async (req, res) => {

    try {
        const { search, category } = req.query;

        const filter = {
            userId: req.user._id
        };

        if (search && search.trim()) {
            const safeSearch = search.trim().replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
            );

            filter.$or = [
                {
                    title: {
                        $regex: safeSearch,
                        $options: "i"
                    }
                },
                {
                    content: {
                        $regex: safeSearch,
                        $options: "i"
                    }
                }
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

// ---------------- GET SINGLE BLOG ----------------

app.get("/blogs/:id", verifyToken, async (req, res) => {

    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                message: "Invalid blog ID"
            });
        }

        const blog = await Blog.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

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

// ---------------- UPDATE BLOG ----------------

app.put("/blogs/:id", verifyToken, async (req, res) => {

    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                message: "Invalid blog ID"
            });
        }

        const { title, content, category } = req.body;

        if (
            typeof title !== "string" ||
            !title.trim() ||
            typeof content !== "string" ||
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

        const updatedBlog = await Blog.findOneAndUpdate(
            {
                _id: req.params.id,
                userId: req.user._id
            },
            updateData,
            {
                new: true,
                runValidators: true
            }
        );

        if (!updatedBlog) {
            return res.status(404).json({
                message: "Blog not found or you do not own this blog"
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

// ---------------- DELETE BLOG ----------------

app.delete("/blogs/:id", verifyToken, async (req, res) => {

    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                message: "Invalid blog ID"
            });
        }

        const deletedBlog = await Blog.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!deletedBlog) {
            return res.status(404).json({
                message: "Blog not found or you do not own this blog"
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

// ---------------- STATIC FILES ----------------

app.use(express.static(__dirname));

// ---------------- START SERVER ----------------

async function startServer() {

    if (!process.env.MONGODB_URI) {
        console.error("MONGODB_URI missing. Check your .env file.");
        process.exit(1);
    }

    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
        console.error("JWT_SECRET must contain at least 32 characters in .env.");
        process.exit(1);
    }

    try {
        await mongoose.connect(process.env.MONGODB_URI, {
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
