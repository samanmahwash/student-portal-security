# Student Portal Security Project

A Blue Team Web Security Project demonstrating common web application vulnerabilities and their defensive solutions using a student portal application.

## Project Overview

This project provides a local web application security lab for understanding how common web vulnerabilities work and how to prevent them. It includes vulnerable demonstrations and corresponding secure implementations for comparison.

## Technologies Used

- **Frontend:** React.js, Vite
- **Backend:** Node.js, Express.js
- **Database:** MySQL
- **Development Environment:** Windows

## Security Modules

### 1. Cross-Site Scripting (XSS)
Demonstrates reflected, stored, and DOM-based XSS concepts, with secure handling techniques to reduce the risk of script injection.

### 2. Cross-Site Request Forgery (CSRF)
Demonstrates how unauthorized state-changing requests can occur and how CSRF token validation and origin checking help defend against them.

### 3. SQL Injection
Compares vulnerable SQL query construction with parameterized queries. The lab includes easy, intermediate, and advanced demonstration stages covering query manipulation and database schema exploration.

## Project Structure

```text
student-portal-security/
├── client/                 # React frontend
├── server/                 # Express backend and API
│   └── seed-data.sql       # Demo database seed data
└── README.md
```

## Prerequisites

- Node.js and npm
- MySQL Server
- A modern web browser

## Setup Instructions

1. Clone or download this repository.
2. Create a MySQL database named `student_portal_security`.
3. Import `server/seed-data.sql` into the database.
4. Install backend dependencies from the `server` directory:

   ```bash
   npm install
   ```

5. Configure the database connection and other required settings using local environment variables.
6. Start the backend using the development script configured in `server/package.json`.
7. Install frontend dependencies from the `client` directory:

   ```bash
   npm install
   ```

8. Start the frontend using the development script configured in `client/package.json`.
9. Open the local URL displayed by Vite in your browser.

Check the configuration files for the required environment variable names and development ports.

## Security and Usage Notice

This project is intended for educational use in a controlled local environment. Vulnerable demonstrations are deliberately insecure and should only be used with the supplied demo data.

Do not expose vulnerable endpoints to the public internet or use them against systems without authorization. Use parameterized queries, appropriate input handling, CSRF protections, and secure configuration practices in real applications.

Never commit database passwords, API keys, session secrets, or `.env` files containing credentials to the repository.

## Learning Objectives

- Understand common web application vulnerabilities.
- Compare vulnerable and secure implementations.
- Observe how security controls affect attack outcomes.
- Practice basic defensive web application security techniques.
