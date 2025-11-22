const adSlot = document.getElementById("ad-slot");
const adOverlay = document.getElementById("ad-overlay");

const adInventory = [
  {
    id: "ad_flashlearn",
    headline: "FlashLearn Pro - Master Any Chapter in 15 Minutes",
    body: "Premium flashcards, adaptive quizzes, and AI-generated summaries.",
    cta: "Try FlashLearn Pro",
  },
  {
    id: "ad_notebuilder",
    headline: "NoteBuilder - AI Notes for Busy Students",
    body: "Upload your syllabus and get exam-ready notes instantly.",
    cta: "Generate Notes",
  },
  {
    id: "ad_zenfocus",
    headline: "ZenFocus Timer",
    body: "64-minute pomodoro cycles with binaural study sounds.",
    cta: "Start Focus Session",
  },
];

let adIndex = 0;
let rotationInterval;

const renderAd = (ad) => {
  if (!adSlot) return;
  adSlot.innerHTML = `
    <div class="flex flex-col gap-2">
      <div class="text-sm font-semibold text-slate-100">${ad.headline}</div>
      <p class="text-xs text-slate-400">${ad.body}</p>
      <button
        class="inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-violet-600 hover:bg-violet-500 text-xs font-semibold transition"
      >
        ${ad.cta}
      </button>
    </div>
  `;
};

export const initAds = (shouldShow) => {
  if (!adOverlay) return;
  clearInterval(rotationInterval);

  if (!shouldShow) {
    adOverlay.classList.add("hidden");
    return;
  }

  adOverlay.classList.remove("hidden");
  renderAd(adInventory[adIndex]);
  rotationInterval = setInterval(() => {
    adIndex = (adIndex + 1) % adInventory.length;
    renderAd(adInventory[adIndex]);
  }, 15000);
};
