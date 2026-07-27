# 🎓 Student Management System

A full-stack MERN (MongoDB, Express, React, Node.js) web application for student record directory management with JWT authentication, CSRF protection, and role-based access control.

---

## 🌟 Key Features

* 🔐 **Secure User Authentication**: JWT authentication with password hashing using `bcrypt`.
* 🛡️ **CSRF Protection**: Double-submit cookie security pattern (`XSRF-TOKEN`) for non-GET API requests.
* 🚦 **Targeted Rate Limiting**: Dedicated login rate limiting to prevent brute-force attacks while preserving session availability.
* 📋 **Complete Student CRUD**: Add, view, edit, and delete student records dynamically from the dashboard.
* 📱 **Responsive Design**: Mobile-first design adapting seamlessly from desktop monitors down to mobile viewports (320px+).
* ♿ **Accessibility (a11y)**: HTML5 landmark navigation (`<main>`), ARIA labels, focus states, and screen-reader accessible toggle buttons.

---

## 🛠️ Tech Stack

### Frontend
* **Core Library**: React 19
* **Router**: React Router 7
* **Build Tool**: Vite 8
* **Styling**: Vanilla CSS (CSS Grid, Flexbox, HSL tailoring, dynamic `100dvh` units)
* **Code Quality**: Oxlint

### Backend & Database
* **Runtime**: Node.js (v18+)
* **Framework**: Express.js 4
* **Database**: MongoDB with Mongoose ODM
* **Security & Middleware**: `jsonwebtoken`, `bcrypt`, `express-rate-limit`, `express-validator`, `helmet`, `cors`, `cookie-parser`, `xss-clean`

---

## 📂 Project Structure

```
Internship Final Project/
├── Backend/                      # Express.js REST API Server
│   ├── bin/www                   # HTTP server entry point (port 5000)
│   ├── app.js                    # Express app setup & middleware
│   ├── config/db.js              # MongoDB database connection
│   ├── middleware/
│   │   └── auth.js               # JWT verification middleware
│   ├── models/                   # Mongoose Schemas (Student, User)
│   ├── routes/                   # API Endpoints (/api/auth, /students)
│   ├── scripts/                  # DB user seeding & check utilities
│   └── .env.example              # Sample environment configuration
├── Frontend/                     # React 19 SPA (Vite)
│   ├── index.html                # Main HTML entry point
│   ├── vite.config.js            # Vite configuration
│   └── src/
│       ├── auth/                 # Auth context, useAuth hook, auth service
│       ├── components/           # Login, Dashboard, StudentCard, StudentForm
│       ├── services/             # studentService API client
│       └── main.jsx              # React app mount point
├── .gitignore                    # Repository-wide ignore rules
├── LICENSE                       # MIT License
└── README.md                     # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites
* **Node.js**: v18.0.0 or higher
* **npm**: v9.0.0 or higher
* **MongoDB**: Local MongoDB instance or MongoDB Atlas connection URI

---

### Setup & Installation

#### 1. Clone the Repository
```bash
git clone https://github.com/your-username/student-management-system.git
cd student-management-system
```

#### 2. Backend Setup
```bash
# Navigate to Backend directory
cd Backend

# Install dependencies
npm install

# Configure Environment Variables
cp .env.example .env
```

Edit `.env` and set your credentials:
```env
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/studentDB?retryWrites=true&w=majority
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=24h
FRONTEND_ORIGIN=http://localhost:5174
```

Start the Backend server:
```bash
npm start
```
The server will run at `http://localhost:5000`.

---

#### 3. Frontend Setup
Open a new terminal window:
```bash
# Navigate to Frontend directory
cd Frontend

# Install dependencies
npm install

# Start the Vite development server
npm run dev -- --port 5174
```
The application will be accessible at `http://localhost:5174`.

---

## 🧪 Testing & Validation

### Run Frontend Linter
```bash
cd Frontend
npm run lint
```

### Build Production Bundle
```bash
cd Frontend
npm run build
```

---

## 🔒 Security Practices

1. **HttpOnly Cookies**: Auth tokens (`auth-token`) are stored in `HttpOnly`, `SameSite=Lax` cookies to mitigate XSS attacks.
2. **CSRF Tokens**: Mutating requests (`POST`, `PUT`, `DELETE`) require a valid `X-XSRF-TOKEN` header matching the issued token.
3. **Protected API Routes**: All `/students` endpoints require authenticated session verification.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
