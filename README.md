# Blog Application

A full-stack Blog Application built using HTML, CSS, JavaScript, Node.js, Express.js and MongoDB.

## Features

- User Registration and Login
- Password Hashing using bcrypt
- JWT Authentication
- Secure User Dashboard
- Create, Read, Update and Delete Blogs
- Search Blogs by Title or Content
- Filter Blogs by Category
- View Individual Blog Details
- User Logout
- Responsive User Interface

## Technologies Used

- HTML
- CSS
- JavaScript
- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT
- bcryptjs

## Installation

1. Clone the repository.
2. Install dependencies:

   `npm install`

3. Create a `.env` file and add:

   `MONGODB_URI=your_mongodb_connection_string`

   `JWT_SECRET=your_secret_key`

4. Start the server:

   `node .\index.html\server.js`

5. Open in browser:

   `http://localhost:3000`

## Project Structure

- `index.html/` – Application files
- `index.html/server.js` – Backend server
- `index.html/css/style.css` – Stylesheet
- `package.json` – Project dependencies

## Security

Passwords are hashed using bcryptjs. JWT tokens are used to authenticate users and protect blog operations.

## Author

Nageshwari
## Live Demo

[Visit My Blog Application](https://blog-application-priyanga.onrender.com)

## Deployment

Deployed using Render.
