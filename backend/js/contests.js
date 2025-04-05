document.addEventListener("DOMContentLoaded", function () {
  const contests = document.querySelectorAll(".contest-table tbody tr");

  contests.forEach((row) => {
      const countdownEl = row.querySelector(".countdown");
      const startTime = new Date(
          row.querySelector(".start-time").textContent
      ).getTime();
      const endTime = new Date(
          row.querySelector(".end-time").textContent
      ).getTime();
      const registerBtn = row.querySelector(".register-btn");

      function updateCountdown() {
          const now = new Date().getTime();
          let timeLeft;

          if (now < startTime) {
              timeLeft = startTime - now;
              registerBtn.textContent = "Register Now";
              registerBtn.disabled = false;
          } else if (now >= startTime && now <= endTime) {
              timeLeft = endTime - now;
              registerBtn.textContent = "Enter Contest";
              registerBtn.disabled = false;
          } else {
              timeLeft = 0;
              registerBtn.textContent = "Contest Ended";
              registerBtn.disabled = true;
          }

          if (timeLeft > 0) {
              const hours = Math.floor(
                  (timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
              );
              const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
              const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
              countdownEl.textContent = `${hours}h ${minutes}m ${seconds}s`;
          } else {
              countdownEl.textContent = "Ended";
          }
      }

      // Add click event for register button
      registerBtn.addEventListener("click", function () {
          // Get the contest ID from the data attribute
          const contestId = registerBtn.getAttribute("data-contest-id");
          if (contestId) {
              window.location.href = `/contest/${contestId}`;
          } else {
              // Fallback to name-based navigation if ID is not available
              const contestName = row.querySelector("td:first-child").textContent;
              window.location.href = `/contestpage/${encodeURIComponent(contestName)}`;
          }
      });

      setInterval(updateCountdown, 1000);
      updateCountdown();
  });
});
