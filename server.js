const express = require('express');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(express.static('public')); 


const users = {
    'testuser': 'SecureTest2024!'
};

const loginAttempts = {};
const LOCK_TIME = 10 * 60 * 1000; 

app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!loginAttempts[username]) {
        loginAttempts[username] = { attempts: 0, lockUntil: 0 };
    }

    const userAttempts = loginAttempts[username];

  
    if (Date.now() < userAttempts.lockUntil) {
        return res.status(403).json({ message: 'Account is locked. Try again later.', attempts: userAttempts.attempts });
    }

    if (username === 'testuser' && password === 'SecureTest2024!') {
     
        userAttempts.attempts = 0;

      
        const token = jwt.sign({ username }, 'your_jwt_secret', { expiresIn: '1h' });

        
        res.status(200).json({ message: 'Login successful', token });
    } else {
        
        userAttempts.attempts += 1;

        if (userAttempts.attempts >= 3) {
            
            userAttempts.lockUntil = Date.now() + LOCK_TIME;
            return res.status(403).json({ message: 'Account is locked. Try again later.', attempts: userAttempts.attempts });
        }

        res.status(401).json({ message: 'Invalid username or password', attempts: userAttempts.attempts });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// 添加路由以处理成功登录后的跳转
app.get('/hello.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'hello.html'));
});

// Token驗證中間件
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    jwt.verify(token, 'your_jwt_secret', (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid or expired token.' });
        }
        req.user = user;
        next();
    });
};

// Token驗證端點
app.get('/verify-token', authenticateToken, (req, res) => {
    res.json({ 
        message: 'Token is valid', 
        username: req.user.username,
        iat: req.user.iat,
        exp: req.user.exp
    });
});

// Token刷新端點
app.post('/refresh-token', authenticateToken, (req, res) => {
    // 生成新的token
    const newToken = jwt.sign({ username: req.user.username }, 'your_jwt_secret', { expiresIn: '1h' });
    
    res.json({ 
        message: 'Token refreshed successfully', 
        token: newToken 
    });
});

// 受保護的路由示例
app.get('/protected', authenticateToken, (req, res) => {
    res.json({ 
        message: 'This is a protected route', 
        user: req.user.username 
    });
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
