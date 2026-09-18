const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const btnGuest = document.getElementById('btn-guest');
const showRegister = document.getElementById('show-register');
const showLogin = document.getElementById('show-login');
const loginError = document.getElementById('login-error');
const regError = document.getElementById('reg-error');

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
        registerForm.style.display = 'block';
        loginError.style.display = 'none';
    });
}

if (showLogin) {
    showLogin.addEventListener('click', (e) => {
        e.preventDefault();
        registerForm.style.display = 'none';
        loginForm.style.display = 'block';
        regError.style.display = 'none';
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
        
        usersDB[username] = { pass: pass, email: email };
        localStorage.setItem('prepmate_users', JSON.stringify(usersDB));
        login(username, pass);
    });
}
