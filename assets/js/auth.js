const noxisClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// SIGNUP
const signupBtn = document.getElementById('signupBtn');
if (signupBtn) {
    signupBtn.addEventListener('click', async () => {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorMsg = document.getElementById('errorMsg');

        if (!email || !password) {
            errorMsg.textContent = 'Please fill in all fields.';
            return;
        }

        if (password.length < 8) {
            errorMsg.textContent = 'Password must be at least 8 characters.';
            return;
        }

        signupBtn.textContent = 'Creating account...';
        signupBtn.disabled = true;

        const { error } = await noxisClient.auth.signUp({ email, password });

        if (error) {
            errorMsg.textContent = error.message;
            signupBtn.textContent = 'Create account';
            signupBtn.disabled = false;
        } else {
            signupBtn.textContent = 'Check your email ✓';
            errorMsg.style.color = '#00d4d4';
            errorMsg.textContent = 'Confirmation email sent. Please verify your account.';
        }
    });
}

// LOGIN
const loginBtn = document.getElementById('loginBtn');
if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorMsg = document.getElementById('errorMsg');

        if (!email || !password) {
            errorMsg.textContent = 'Please fill in all fields.';
            return;
        }

        loginBtn.textContent = 'Logging in...';
        loginBtn.disabled = true;

        const { error } = await noxisClient.auth.signInWithPassword({ email, password });

        if (error) {
            errorMsg.textContent = error.message;
            loginBtn.textContent = 'Log in';
            loginBtn.disabled = false;
        } else {
            window.location.href = 'dashboard.html';
        }
    });
}

// Password toggle
const eyeToggle = document.getElementById('eyeToggle');
if (eyeToggle) {
    eyeToggle.addEventListener('click', () => {
        const passwordInput = document.getElementById('password');
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            eyeToggle.textContent = '🙈';
        } else {
            passwordInput.type = 'password';
            eyeToggle.textContent = '👁';
        }
    });
}