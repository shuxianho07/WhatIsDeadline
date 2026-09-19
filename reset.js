const resetForm = document.getElementById('reset-form');
const resetError = document.getElementById('reset-error');

let usersDB = JSON.parse(localStorage.getItem('prepmate_users')) || { admin: '123456' };

// Normalize DB for safety
Object.keys(usersDB).forEach(key => {
    if (typeof usersDB[key] === 'string') {
        usersDB[key] = { pass: usersDB[key], email: '' };
    }
});

if (resetForm) {
    resetForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('reset-username').value.trim();
        const tempPass = document.getElementById('reset-temp').value.trim();
        const newPass = document.getElementById('reset-new').value;

        if (!usersDB[username]) {
            resetError.textContent = 'Username not found.';
            resetError.style.display = 'block';
            return;
        }

        // Check if the temporary password matches the user's password
        // In our simple mock, the temp password replaced the old password in DB
        if (usersDB[username].pass !== tempPass) {
            resetError.textContent = 'Invalid temporary password.';
            resetError.style.display = 'block';
            return;
        }

        // Update with new password
        usersDB[username].pass = newPass;
        localStorage.setItem('prepmate_users', JSON.stringify(usersDB));
        
        alert("Password reset successfully! You can now log in.");
        
        // Redirect to login
        if (window.location.protocol === 'file:') {
            window.location.href = 'index.html';
        } else {
            window.location.href = './'; // Goes to root index
        }
    });
}
