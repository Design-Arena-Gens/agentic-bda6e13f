export const formatTimestamp = (timestamp) => {
  if (!timestamp) return "N/A";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
};

export const formatCurrency = (amountInPaise) => {
  const rupees = (amountInPaise ?? 0) / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(rupees);
};

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const randomId = (prefix = "id") => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

export const padTime = (seconds) => {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
};

export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const flattenFirestoreData = (snapshot) =>
  snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
