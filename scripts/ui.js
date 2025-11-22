const toastContainer = document.getElementById("toast-container");

export const showToast = (message, type = "info", timeout = 4000) => {
  if (!toastContainer) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type === "success" ? "toast-success" : ""} ${
    type === "error" ? "toast-error" : ""
  }`;
  toast.innerHTML = `
    <span class="h-2 w-2 rounded-full ${
      type === "success" ? "bg-emerald-400" : type === "error" ? "bg-rose-400" : "bg-sky-400"
    }"></span>
    <span>${message}</span>
  `;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), timeout);
};

export const toggleModal = (modalId, show) => {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.toggle("hidden", !show);
};

export const updateElement = (selector, updater) => {
  const el = typeof selector === "string" ? document.querySelector(selector) : selector;
  if (!el) return;
  updater(el);
};
