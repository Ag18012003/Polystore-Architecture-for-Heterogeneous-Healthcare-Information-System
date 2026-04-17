# 🏥 Polystore Architecture for Heterogeneous Healthcare Information System

A modern, scalable healthcare management platform built with React, Node.js, and MongoDB. Features include product management, doctor appointments, order tracking, and an admin dashboard.

## 📋 Table of Contents
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [API Routes](#api-routes)
- [Usage Guide](#usage-guide)
- [Troubleshooting](#troubleshooting)

## ✨ Features

### Frontend (Customer Portal)
- 🔐 Clerk Authentication
- 🏪 Product Catalog with Filtering
- 📦 Order Management & Tracking
- 👨‍⚕️ Doctor Appointments Booking
- 👤 User Profile Management
- ⭐ Product Reviews & Ratings
- 🛒 Shopping Cart Functionality

### Admin Dashboard
- 📊 Statistics & Analytics Dashboard
- 📦 Product Management (CRUD)
- 📋 Order Management & Status Updates
- 👥 User Management
- 💹 Sales Reports

### Backend API
- ✅ RESTful API with Express.js
- 🗄️ MongoDB Database
- 🔐 Clerk Authentication Integration
- 💳 Stripe Payment Integration
- 📸 Cloudinary Image Management
- 📧 User Webhooks

## 🛠️ Tech Stack

### Frontend
- React 19.x
- Vite (Build Tool)
- React Router v7
- Tailwind CSS v4
- Clerk (Authentication)
- Axios (HTTP Client)
- React Hot Toast (Notifications)
- Lucide React (Icons)

### Admin Dashboard
- React 19.x
- Vite
- Tailwind CSS
- Clerk Authentication
- React Router v7

### Backend
- Node.js
- Express.js
- MongoDB with Mongoose
- Clerk SDK
- Stripe
- Cloudinary
- Dotenv (Environment Variables)
- Multer (File Upload)
- Bcrypt (Password Hashing)

## 📋 Prerequisites

Make sure you have installed:
- Node.js (v18.0.0 or higher)
- npm or yarn
- MongoDB (local or MongoDB Atlas)
- Git

## 📁 Project Structure

```
Polystore-Architecture-for-Heterogeneous-Healthcare-Information-System/
├── backend/
│   ├── config/
│   │   └── db.js                    # MongoDB Connection
│   ├── models/
│   │   ├── User.js                  # User Schema
│   │   ├── Product.js               # Product Schema
│   │   ├── Order.js                 # Order Schema
│   │   └── Appointment.js           # Appointment Schema
│   ├── routes/
│   │   ├── auth.js                  # Authentication Routes
│   │   ├── products.js              # Product Routes
│   │   ├── orders.js                # Order Routes
│   │   └── appointments.js          # Appointment Routes
│   ├── .env                         # Environment Variables
│   ├── .gitignore
│   ├── index.js                     # Main Server File
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── Navbar.jsx           # Navigation Component
│   │   ├── pages/
│   │   │   ├── Home.jsx             # Home Page
│   │   │   ├── ProductDetail.jsx    # Product Detail Page
│   │   │   ├── OrdersPage.jsx       # Orders Page
│   │   │   ├── AppointmentsPage.jsx # Appointments Page
│   │   │   ├── ProfilePage.jsx      # User Profile Page
│   │   │   └── CartPage.jsx         # Shopping Cart Page
│   │   ├── services/
│   │   │   └── api.js               # API Service
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── .env
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── admin/
│   ├── src/
│   │   ├── components/
│   │   │   └── AdminLayout.jsx      # Admin Layout
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx        # Dashboard
│   │   │   ├── ProductsManagement.jsx
│   │   │   └── OrdersManagement.jsx
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── .env
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── README.md

```

## 🚀 Installation

### 1. Clone the Repository
```bash
git clone https://github.com/Ag18012003/Polystore-Architecture-for-Heterogeneous-Healthcare-Information-System.git
cd Polystore-Architecture-for-Heterogeneous-Healthcare-Information-System
```

### 2. Backend Setup
```bash
cd backend
npm install
```

### 3. Frontend Setup
```bash
cd frontend
npm install
```

### 4. Admin Dashboard Setup
```bash
cd admin
npm install
```

## ⚙️ Configuration

### Backend Configuration

Create `backend/.env` with the following variables:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname?appName=Cluster0

# Clerk Authentication
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

# Cloudinary (Image Storage)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Stripe (Payment Gateway)
STRIPE_SECRET_KEY=your_stripe_secret_key

# Frontend URL
FRONTEND_URL=http://localhost:5173
```

### Frontend Configuration

Create `frontend/.env` with:

```env
VITE_API_URL=http://localhost:5000/api
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
```

### Admin Configuration

Create `admin/.env` with:

```env
VITE_API_URL=http://localhost:5000/api
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
```

## ▶️ Running the Application

### Terminal 1 - Start Backend Server
```bash
cd backend
npm start
# Server runs on http://localhost:5000
```

### Terminal 2 - Start Frontend
```bash
cd frontend
npm run dev
# Frontend runs on http://localhost:5173
```

### Terminal 3 - Start Admin Dashboard
```bash
cd admin
npm run dev
# Admin dashboard runs on http://localhost:5174
```

## 📡 API Routes

### Authentication Routes (`/api/auth`)
- `POST /webhook` - Clerk webhook for user creation
- `GET /me/:clerkId` - Get current user profile
- `PUT /profile/:clerkId` - Update user profile

### Product Routes (`/api/products`)
- `GET /` - Get all products (with filtering)
- `GET /:id` - Get product details
- `POST /` - Create product (admin)
- `PUT /:id` - Update product (admin)
- `DELETE /:id` - Delete product (admin)
- `POST /:id/review` - Add product review

### Order Routes (`/api/orders`)
- `GET /user/:userId` - Get user orders
- `GET /:id` - Get order details
- `POST /` - Create order
- `PUT /:id` - Update order
- `PUT /:id/cancel` - Cancel order

### Appointment Routes (`/api/appointments`)
- `GET /doctors` - Get all doctors
- `GET /user/:userId` - Get user appointments
- `GET /doctor/:doctorId` - Get doctor appointments
- `POST /` - Create appointment
- `PUT /:id` - Update appointment
- `PUT /:id/cancel` - Cancel appointment

## 💡 Usage Guide

### For Customers
1. **Sign Up**: Use Clerk authentication to create account
2. **Browse Products**: Browse healthcare products by category
3. **Make Orders**: Add products to cart and checkout
4. **Book Appointments**: Select doctor and available time slot
5. **Track Orders**: Monitor order status in real-time
6. **Manage Profile**: Update personal and medical information

### For Admin
1. **Access Dashboard**: Navigate to admin dashboard
2. **Manage Products**: Add, edit, or delete products
3. **Track Orders**: Monitor and update order statuses
4. **View Analytics**: Check sales reports and statistics

## 🐛 Troubleshooting

### MongoDB Connection Error
- Verify MONGODB_URI in .env file
- Check if MongoDB Atlas cluster is running
- Ensure IP whitelist includes your machine

### Clerk Authentication Issues
- Verify CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY
- Check Clerk dashboard for webhook configuration
- Clear browser cache and cookies

### Frontend Not Loading
- Ensure backend server is running on port 5000
- Check VITE_API_URL in frontend .env
- Clear node_modules and reinstall: `npm install`

### Port Already in Use
```bash
# Kill process on port 5000
npx kill-port 5000

# Kill process on port 5173
npx kill-port 5173

# Kill process on port 5174
npx kill-port 5174
```

## 📞 Support

For issues or questions:
- Email: hexagonsservices@gmail.com
- Call: 8299431275

## 📄 License

This project is licensed under the ISC License.

## 👨‍💻 Authors

- AMAN GUPTA (@Ag18012003)

---

**Last Updated**: 2026-04-17 15:30:37
**Status**: ✅ Active Development