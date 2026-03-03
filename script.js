const signUpButton = document.getElementById('signUp');
const signInButton = document.getElementById('signIn');
const container = document.getElementById('container');

signUpButton.addEventListener('click', () => {
	container.classList.add("right-panel-active");
});

signInButton.addEventListener('click', () => {
	container.classList.remove("right-panel-active");
});

// --- Authentication Logic ---

const signupBtn = document.getElementById('signupBtn');
const signinBtn = document.getElementById('signinBtn');

const signinEmail = document.getElementById('signinEmail');
const signinPassword = document.getElementById('signinPassword');
const forgotPasswordLink = document.getElementById('forgotPasswordLink');

// Disable Sign Up (or redirect to error)
if (signupBtn) {
	signupBtn.addEventListener('click', (e) => {
		e.preventDefault();
		alert("Registration is closed. Please use the Admin Login.");
	});
}

const GLOBAL_ID = "maniyadhruvik07@gmail.com";
const GLOBAL_PASS = "maniya@#07";

if (signinBtn) {
	signinBtn.addEventListener('click', (e) => {
		e.preventDefault();
		const email = signinEmail.value;
		const password = signinPassword.value;

		// Strict Single Admin Login
		if (email === GLOBAL_ID && password === GLOBAL_PASS) {
			// Set static admin user
			const adminUser = { name: "Admin", email: GLOBAL_ID };
			localStorage.setItem('currentUser', JSON.stringify(adminUser));

			// Redirect to role selection
			window.location.href = 'role-select.html';
		} else {
			alert("Invalid ID or Password. Contact Admin.");
		}
	});
}

// Fixed Forgot Password
if (forgotPasswordLink) {
	forgotPasswordLink.addEventListener('click', (e) => {
		e.preventDefault();
		const email = prompt("Enter Email:");
		if (email === GLOBAL_ID) {
			alert(`Password is: ${GLOBAL_PASS}`);
		} else {
			alert("Email not recognized.");
		}
	});
}
