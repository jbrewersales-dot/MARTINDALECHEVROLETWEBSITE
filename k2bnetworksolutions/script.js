// K2B Network Solutions site scripts

// Where demo requests get sent. Change this to your real inbox.
const CONTACT_EMAIL = "info@k2bnetworksolutions.com";

// Mobile menu
const toggle = document.querySelector(".nav-toggle");
const nav = document.getElementById("site-nav");
toggle.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  toggle.setAttribute("aria-expanded", open);
});
nav.querySelectorAll("a").forEach((link) =>
  link.addEventListener("click", () => {
    nav.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  })
);

// Footer year
document.getElementById("year").textContent = new Date().getFullYear();

// Demo request form: opens the visitor's email app with the request filled in
const form = document.getElementById("demo-form");
const note = document.getElementById("form-note");

form.addEventListener("submit", (e) => {
  e.preventDefault();
  let valid = true;
  form.querySelectorAll("[required]").forEach((field) => {
    const bad = !field.value.trim() || (field.type === "email" && !field.checkValidity());
    field.classList.toggle("invalid", bad);
    if (bad) valid = false;
  });

  if (!valid) {
    note.textContent = "Please fill in your name, business and a valid email.";
    note.className = "form-note err";
    return;
  }

  const d = Object.fromEntries(new FormData(form));
  const subject = `Demo request: ${d.product} - ${d.business}`;
  const body = [
    `Name: ${d.name}`,
    `Business: ${d.business}`,
    `Email: ${d.email}`,
    `Phone: ${d.phone || "-"}`,
    `Interested in: ${d.product}`,
    "",
    d.message || "",
  ].join("\n");

  window.location.href =
    `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  note.textContent = "Thanks! Your email app should open with your request ready to send.";
  note.className = "form-note ok";
});
