
CREATE DATABASE IF NOT EXISTS student_portal_security;
USE student_portal_security;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('student', 'admin') NOT NULL DEFAULT 'student',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    author_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    post_id INT NOT NULL,
    author_id INT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id),
    FOREIGN KEY (author_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS student_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    full_name VARCHAR(120) NOT NULL,
    department VARCHAR(100) NOT NULL DEFAULT 'Computer Science',
    bio TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

INSERT IGNORE INTO users
    (username, email, password_hash, role)
VALUES
    ('demo_student', 'student@example.com',
     '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
     'student'),
    ('demo_admin', 'admin@example.com',
     '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
     'admin');

INSERT INTO student_profiles (user_id, full_name, department, bio)
SELECT id, 'Demo Student', 'Computer Science',
       'Interested in web development and security.'
FROM users
WHERE username = 'demo_student'
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name);

INSERT INTO posts (title, content, author_id)
SELECT 'Welcome to the Student Portal',
       'Use this portal to explore posts and comments.',
       id
FROM users
WHERE username = 'demo_student'
AND NOT EXISTS (
    SELECT 1 FROM posts
    WHERE title = 'Welcome to the Student Portal'
);

INSERT INTO posts (title, content, author_id)
SELECT 'Web Security Lab',
       'Practice identifying vulnerabilities and understanding their defenses.',
       id
FROM users
WHERE username = 'demo_admin'
AND NOT EXISTS (
    SELECT 1 FROM posts
    WHERE title = 'Web Security Lab'
);

INSERT INTO comments (post_id, author_id, content)
SELECT p.id, u.id, 'Looking forward to learning web security!'
FROM posts p
JOIN users u ON u.username = 'demo_student'
WHERE p.title = 'Welcome to the Student Portal'
AND NOT EXISTS (
    SELECT 1 FROM comments c
    WHERE c.post_id = p.id AND c.author_id = u.id
);
