# MedAI-Connect PWA (Demo)

A **Progressive Web App (PWA)** prototype for demo purposes, allowing users to input symptoms via **text or voice**, simulate device readings, and receive **local triage guidance** with explanations.

> ⚠️ **Disclaimer:** This is a **prototype for educational/demo purposes only**. It is **not a medical device**. Always consult a certified healthcare professional for medical advice.

---

## Features

1. **Symptom Input**
   - Text-based input or voice input using the **Web Speech API** (fallback to text if unavailable).
   - Multi-language support: English (`en`), Hindi (`hi`), Tamil (`ta`).

2. **Simulated Device Data**
   - Randomized demo readings for:
     - SpO₂
     - Body temperature
     - Heart rate
   - Can be cleared anytime.

3. **Triage Engine**
   - Rule-based, local edge logic.
   - Determines urgency (`low`, `moderate`, `high`) based on symptom keywords and device readings.
   - Provides a plain-language explanation of the reasoning.
   - Estimates **confidence level** and possible conditions (demo-only).

4. **Session Management**
   - Local caching of up to **50 sessions** using `localStorage`.
   - Export sessions as JSON.
   - Delete individual or all sessions.

5. **PWA Ready**
   - Minimal service worker provided for offline caching.
   - Can be installed on devices as a PWA.

---

## Getting Started

### Prerequisites

- Node.js 18+ recommended
- npm or yarn
- Modern browser with Web Speech API support (Chrome, Edge, Firefox partial)

### Installation

1. Create a new React app (Vite or Create React App recommended):
   ```bash
   npm create vite@latest medai-connect
   cd medai-connect
   npm install
