document.addEventListener("DOMContentLoaded", function () {
  const signinForm = document.getElementById("signin-form");
  const googleSignin = document.getElementById("google-signin");
  const appleSignin = document.getElementById("apple-signin");
  const signupLink = document.getElementById("signup-link");
  const logoLink = document.getElementById("logo-link"); // Added logo element

  // Prevent navigation when clicking the logo
  logoLink.addEventListener("click", function (event) {
    event.preventDefault(); // Stops redirection
  });

  // Redirect to Home Page ons Sign In
  signinForm.addEventListener("submit", function (event) {
    event.preventDefault(); // Prevents actual form submission
    window.location.href = "home.html";
  });

  googleSignin.addEventListener("click", function (event) {
    event.preventDefault();
    window.location.href = "https://accounts.google.com/signin"; // Google Sign-in Page
  });

  appleSignin.addEventListener("click", function (event) {
    event.preventDefault();
    window.location.href = "https://appleid.apple.com/sign-in"; // Apple Sign-in Page
  });

  // Redirect to Sign Up Page
  signupLink.addEventListener("click", function (event) {
    event.preventDefault();
    window.location.href = "/signup"; 
  });
});
