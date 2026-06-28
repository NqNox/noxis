const noxisClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true
    }
});

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

        const confirmPassword = document.getElementById('confirmPassword').value;
        if (password !== confirmPassword) {
            errorMsg.textContent = 'Passwords do not match.';
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
            signupBtn.textContent = 'Redirecting...';
            errorMsg.style.color = '#00d4d4';
            errorMsg.textContent = '✓ Account created successfully!';
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
        }
    });
}

// LOGIN
const loginBtn = document.getElementById('loginBtn');
if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const remember = document.getElementById('remember').checked;
        const errorMsg = document.getElementById('errorMsg');

        if (!email || !password) {
            errorMsg.textContent = 'Please fill in all fields.';
            const emailInput = document.getElementById('email');
            const passwordInput = document.getElementById('password');
            if (!email) { emailInput.classList.add('input-error', 'shake'); setTimeout(() => emailInput.classList.remove('shake'), 400); }
            if (!password) { passwordInput.classList.add('input-error', 'shake'); setTimeout(() => passwordInput.classList.remove('shake'), 400); }
            return;
        }

        loginBtn.textContent = 'Logging in...';
        loginBtn.disabled = true;

        const { error } = await noxisClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            errorMsg.textContent = error.message;
            loginBtn.textContent = 'Log in';
            loginBtn.disabled = false;
        } else {
            window.location.href = '../pages/dashboard.html';
        }
    });
}

document.getElementById('email').addEventListener('input', () => {
    document.getElementById('email').classList.remove('input-error');
});
document.getElementById('password').addEventListener('input', () => {
    document.getElementById('password').classList.remove('input-error');
});

// Password toggle
const eyeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;

const eyeOffIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

const eyeToggle = document.getElementById('eyeToggle');
if (eyeToggle) {
    eyeToggle.innerHTML = eyeIcon;
    eyeToggle.addEventListener('click', () => {
        const passwordInput = document.getElementById('password');
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            eyeToggle.innerHTML = eyeOffIcon;
        } else {
            passwordInput.type = 'password';
            eyeToggle.innerHTML = eyeIcon;
        }
    });
}

const eyeToggle2 = document.getElementById('eyeToggle2');
if (eyeToggle2) {
    eyeToggle2.innerHTML = eyeIcon;
    eyeToggle2.addEventListener('click', () => {
        const confirmInput = document.getElementById('confirmPassword');
        if (confirmInput.type === 'password') {
            confirmInput.type = 'text';
            eyeToggle2.innerHTML = eyeOffIcon;
        } else {
            confirmInput.type = 'password';
            eyeToggle2.innerHTML = eyeIcon;
        }
    });
}   

const passwordInput = document.getElementById('password');
if (passwordInput) {
    passwordInput.addEventListener('input', () => {
        const val = passwordInput.value;
        const reqLength = document.getElementById('reqLength');
        const reqNumber = document.getElementById('reqNumber');
        const reqSpecial = document.getElementById('reqSpecial');

        if (!reqLength) return;

        if (val.length >= 8) {
            reqLength.textContent = '✓ 8+ chars';
            reqLength.classList.add('met');
        } else {
            reqLength.textContent = '✕ 8+ chars';
            reqLength.classList.remove('met');
        }

        if (/\d/.test(val)) {
            reqNumber.textContent = '✓ numbers';
            reqNumber.classList.add('met');
        } else {
            reqNumber.textContent = '✕ numbers';
            reqNumber.classList.remove('met');
        }

        if (/[!@#$%^&*(),.?":{}|<>]/.test(val)) {
            reqSpecial.textContent = '✓ special char';
            reqSpecial.classList.add('met');
        } else {
            reqSpecial.textContent = '✕ special char';
            reqSpecial.classList.remove('met');
        }
    });
}

const googleBtn = document.getElementById('googleBtn');
if (googleBtn) {
  googleBtn.addEventListener('click', async () => {
    const { error } = await noxisClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://noxis-ai.app/pages/dashboard.html'
      }
    });
    if (error) console.error(error.message);
  });
}

if (typeof lucide !== 'undefined') lucide.createIcons();