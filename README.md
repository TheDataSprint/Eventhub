# EventHub — Event Management System

Full-stack event management app built with **HTML/CSS/JS** on the frontend and **Node.js, Express, MongoDB (Mongoose), bcryptjs, and JWT** on the backend.

Users can browse and search events, register in one click, cancel registrations, and host their own events with live capacity tracking and an attendee list.

## Features

- Register / login with hashed passwords (bcrypt) and JWT sessions
- Discover events with search, category and upcoming/past filters
- One-click registration with **atomic capacity enforcement** (no overbooking, no duplicate sign-ups)
- Create, edit and delete your own events (organizer-only permissions)
- Organizer view of attendees (name, email, registration date)
- Dashboard with stats, fill-rate chart and your next event

## Folder Structure

```text
eventhub-app/
├── README.md
├── backend/
│   ├── config/
│   │   └── db.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── eventController.js
│   │   └── userController.js
│   ├── middleware/
│   │   └── authMiddleware.js
│   ├── models/
│   │   ├── Event.js
│   │   └── User.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── eventRoutes.js
│   │   └── userRoutes.js
│   ├── .env
│   ├── .env.example
│   ├── .gitignore
│   ├── package.json
│   └── server.js
└── frontend/
    ├── index.html
    ├── style.css
    └── script.js
```

## Setup & Run Instructions

1. **Start MongoDB** locally (`mongodb://127.0.0.1:27017`) or update `MONGO_URI` in `backend/.env` with your MongoDB Atlas URI.
2. **Install backend dependencies:**
   ```bash
   cd backend
   npm install
   ```
3. **Start the Express server:**
   ```bash
   npm start
   ```
4. **Open in Browser:**
   Go to **http://localhost:5000** — Express serves the frontend automatically.

> Change `JWT_SECRET` in `backend/.env` before deploying anywhere.

## API Routes

All `/api/events` and `/api/user` routes require `Authorization: Bearer <token>`.

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Register user (bcrypt hash + JWT) |
| `POST` | `/api/auth/login` | Public | Login user & return JWT |
| `GET` | `/api/user/profile` | JWT | Fetch logged-in user profile |
| `PUT` | `/api/user/profile` | JWT | Update name, email, phone, organization, bio |
| `GET` | `/api/events` | JWT | List events (`?search=&category=&scope=upcoming\|past\|all`) |
| `GET` | `/api/events/categories` | JWT | List event categories |
| `GET` | `/api/events/stats` | JWT | Dashboard stats for the logged-in user |
| `GET` | `/api/events/my/created` | JWT | Events you host |
| `GET` | `/api/events/my/registrations` | JWT | Events you registered for |
| `GET` | `/api/events/:id` | JWT | Single event |
| `POST` | `/api/events` | JWT | Create an event |
| `PUT` | `/api/events/:id` | JWT (organizer) | Update an event |
| `DELETE` | `/api/events/:id` | JWT (organizer) | Delete an event |
| `POST` | `/api/events/:id/register` | JWT | Register for an event (capacity-checked) |
| `DELETE` | `/api/events/:id/register` | JWT | Cancel your registration |

## Data Models

- **User** — name, email (unique), password (hashed), phone, organization, bio
- **Event** — title, description, category, date, time, venue, capacity, price, organizer, attendees[] (user, name, email, registeredAt)
