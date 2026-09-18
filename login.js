const loginForm = document.getElementById('login-form');
const btnGuest = document.getElementById('btn-guest');
const btnRegister = document.getElementById('btn-register');
const loginError = document.getElementById('login-error');

let usersDB = JSON.parse(localStorage.getItem('prepmate_users')) || { admin: '123456' };

function login(username, password) {
    if (!username) username = 'guest';

    if (username !== 'guest') {
        if (!usersDB[username]) {
            loginError.textContent = 'Account not found. Click Register.';
            loginError.style.display = 'block';
            return;
        }
        if (usersDB[username] !== password) {
            loginError.textContent = 'Invalid password.';
            loginError.style.display = 'block';
            return;
        }
    }
    
    // Save session and redirect
    sessionStorage.setItem('currentUser', username);
    window.location.href = 'home.html';
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

if (btnRegister) {
    btnRegister.addEventListener('click', () => {
        const username = document.getElementById('login-username').value.trim();
        const pass = document.getElementById('login-password').value;
        
        if (!username || !pass) {
            loginError.textContent = 'Username and password required to register.';
            loginError.style.display = 'block';
            return;
        }
        
        if (username.toLowerCase() === 'guest') {
            loginError.textContent = 'Cannot register as guest.';
            loginError.style.display = 'block';
            return;
        }
        
        if (usersDB[username]) {
            loginError.textContent = 'Username already exists. Please login.';
            loginError.style.display = 'block';
            return;
        }
        
        usersDB[username] = pass;
        localStorage.setItem('prepmate_users', JSON.stringify(usersDB));
        login(username, pass);
    });
}
