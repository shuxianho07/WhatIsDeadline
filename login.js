const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const forgotForm = document.getElementById('forgot-form');
const btnGuest = document.getElementById('btn-guest');
const showRegister = document.getElementById('show-register');
const showLogin = document.getElementById('show-login');
const showForgot = document.getElementById('show-forgot');
const showLoginFromForgot = document.getElementById('show-login-from-forgot');
const loginError = document.getElementById('login-error');
const regError = document.getElementById('reg-error');
const forgotError = document.getElementById('forgot-error');

let usersDB = JSON.parse(localStorage.getItem('prepmate_users')) || { admin: '123456' };

// Backwards compatibility: convert old string passwords to objects
let dbUpdated = false;
Object.keys(usersDB).forEach(key => {
    if (typeof usersDB[key] === 'string') {
        usersDB[key] = { pass: usersDB[key], email: '' };
        dbUpdated = true;
    }
});
if (dbUpdated) {
    localStorage.setItem('prepmate_users', JSON.stringify(usersDB));
}

function login(username, password) {
    if (!username) username = 'guest';

    if (username !== 'guest') {
        if (!usersDB[username]) {
            loginError.textContent = 'Account not found. Please register.';
            loginError.style.display = 'block';
            return;
        }
        if (usersDB[username].pass !== password) {
            loginError.textContent = 'Invalid password.';
            loginError.style.display = 'block';
            return;
        }
    }
    
    // Save session and redirect
    sessionStorage.setItem('currentUser', username);
    if (window.location.protocol === 'file:') {
        window.location.href = 'home.html';
    } else {
        window.location.href = 'home';
    }
}

// Toggles
if (showRegister) {
    showRegister.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.style.display = 'none';
        forgotForm.style.display = 'none';
        registerForm.style.display = 'block';
        loginError.style.display = 'none';
    });
}

if (showLogin) {
    showLogin.addEventListener('click', (e) => {
        e.preventDefault();
        registerForm.style.display = 'none';
        forgotForm.style.display = 'none';
        loginForm.style.display = 'block';
        regError.style.display = 'none';
    });
}

if (showForgot) {
    showForgot.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.style.display = 'none';
        registerForm.style.display = 'none';
        forgotForm.style.display = 'block';
        loginError.style.display = 'none';
    });
}

if (showLoginFromForgot) {
    showLoginFromForgot.addEventListener('click', (e) => {
        e.preventDefault();
        forgotForm.style.display = 'none';
        loginForm.style.display = 'block';
        forgotError.style.display = 'none';
    });
}

if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const user = document.getElementById('login-username').value.trim();
        const pass = document.getElementById('login-password').value;
        login(user, pass);
    });
}

if (btnGuest) {
    btnGuest.addEventListener('click', () => {
        login('guest', '');
    });
}

if (registerForm) {
    registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('reg-email').value.trim();
        const username = document.getElementById('reg-username').value.trim();
        const pass = document.getElementById('reg-password').value;
        
        if (!username || !pass || !email) {
            regError.textContent = 'All fields are required to register.';
            regError.style.display = 'block';
            return;
        }
        
        if (username.toLowerCase() === 'guest') {
            regError.textContent = 'Cannot register as guest.';
            regError.style.display = 'block';
            return;
        }
        
        if (usersDB[username]) {
            regError.textContent = 'Username already exists. Please login.';
            regError.style.display = 'block';
            return;
        }

        // 1 account per email limit
        const emailExists = Object.values(usersDB).some(user => user.email === email);
        if (emailExists) {
            regError.textContent = 'This email is already registered to an account.';
            regError.style.display = 'block';
            return;
        }
        
        // Rate Limiting: max 50 registries per IP (simulated locally) per 3.14 seconds
        let attempts = JSON.parse(localStorage.getItem('prepmate_reg_attempts')) || [];
        const now = Date.now();
        attempts = attempts.filter(time => now - time < 3140); // 3.14 seconds
        
        if (attempts.length >= 50) {
            regError.textContent = 'Rate limit exceeded: too many requests.';
            regError.style.display = 'block';
            return;
        }
        
        attempts.push(now);
        localStorage.setItem('prepmate_reg_attempts', JSON.stringify(attempts));
        
        usersDB[username] = { pass: pass, email: email };
        localStorage.setItem('prepmate_users', JSON.stringify(usersDB));
        login(username, pass);
    });
}

if (forgotForm) {
    forgotForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('forgot-email').value.trim();
        
        if (!email) {
            forgotError.textContent = 'Please enter an email.';
            forgotError.style.display = 'block';
            return;
        }

        // Find user by email
        let foundUsername = null;
        for (const [uname, udata] of Object.entries(usersDB)) {
            if (udata.email === email) {
                foundUsername = uname;
                break;
            }
        }

        if (!foundUsername) {
            // Not found -> redirect to register form
            forgotForm.style.display = 'none';
            registerForm.style.display = 'block';
            document.getElementById('reg-email').value = email;
            regError.textContent = 'Email not found. Please register an account.';
            regError.style.display = 'block';
            return;
        }

        // Found -> generate 7 char temp password
        const tempPass = Math.random().toString(36).substring(2, 9);
        
        // Save to DB
        usersDB[foundUsername].pass = tempPass;
        localStorage.setItem('prepmate_users', JSON.stringify(usersDB));

        // Mock sending email
        const emailBody = `
MOCK EMAIL INTERCEPTED
---------------------------------
To: ${email}
Subject: Your Temporary Password

Hi ${foundUsername},

You requested a password reset. Here is your temporary password:
${tempPass}

Please use it to log in and set a new password.
        `;
        alert(emailBody.trim());

        // Redirect to reset page
        if (window.location.protocol === 'file:') {
            window.location.href = 'reset.html';
        } else {
            window.location.href = 'reset'; // Extensionless for GH Pages
        }
    });
}
