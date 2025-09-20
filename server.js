const express = require('express');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(express.static('public')); 


const users = {
    'testuser': 'User123?'
};

// 用戶數據存儲（實際應用中應該使用數據庫）
const userDatabase = {
    'testuser': {
        username: 'testuser',
        email: 'test@example.com',
        password: 'User123?',
        createdAt: new Date()
    }
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

    // 檢查用戶是否存在且密碼正確
    const user = userDatabase[username];
    if (user && user.password === password) {
        // 登入成功
        userAttempts.attempts = 0;

        // 生成JWT token
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

// 註冊端點
app.post('/register', (req, res) => {
    const { username, email, password } = req.body;

    // 基本驗證
    if (!username || !email || !password) {
        return res.status(400).json({ message: '所有欄位都是必填的' });
    }

    // 檢查用戶名是否已存在
    if (userDatabase[username]) {
        return res.status(409).json({ message: '用戶名已存在' });
    }

    // 檢查郵箱是否已存在
    const existingUser = Object.values(userDatabase).find(user => user.email === email);
    if (existingUser) {
        return res.status(409).json({ message: '電子郵件已被使用' });
    }

    // 密碼強度驗證
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
    if (!passwordRegex.test(password)) {
        return res.status(400).json({ 
            message: '密碼必須包含至少8個字符，包括大寫字母、小寫字母、數字和特殊字符' 
        });
    }

    // 創建新用戶
    const newUser = {
        username,
        email,
        password, // 實際應用中應該加密
        createdAt: new Date()
    };

    // 保存到數據庫
    userDatabase[username] = newUser;
    users[username] = password; // 為了兼容現有的登入邏輯

    // 返回成功響應
    res.status(201).json({ 
        message: '註冊成功', 
        user: {
            username: newUser.username,
            email: newUser.email,
            createdAt: newUser.createdAt
        }
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
