/*
MedAI-Connect PWA (Single-file React component)
How to use:
- Create a React app (e.g., using Vite or create-react-app)
- Save this file as src/App.jsx
- Install dependencies: none required for core (uses browser Web Speech API)
- Run: npm run dev / npm start
- Service Worker: a minimal service worker snippet is included in comments below; register it in index.js for offline caching.
What this scaffold does:
- Text + Voice symptom input (Web Speech API if available; falls back to text)
- Simple rule-based triage engine (local edge logic) for demo purposes
- Plain-language explanation generator
- Simulated device readings (SpO2, temperature) that can be attached to the triage
- Local storage cache of sessions (IndexedDB would be ideal; localStorage used for simplicity)
- Export session JSON for demo sharing
Next steps you can ask me for:
- Add real STT/TTS integrations (Whisper/Google/Polly) — requires API keys
- Add backend (Node/FastAPI) with optional OpenAI/Infermedica triage
- Add BLE device integration (React Native or Web Bluetooth)
- Replace localStorage with IndexedDB and add service worker precaching for full PWA offline
*/
import React, { useEffect, useState, useRef } from "react";
export default function App() {
  const [language, setLanguage] = useState("en");
  const [inputText, setInputText] = useState("");
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [sessions, setSessions] = useState(() => {
    try {
      const raw = localStorage.getItem("medai_sessions");
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  });
  const [currentResult, setCurrentResult] = useState(null);
  const [deviceData, setDeviceData] = useState({ spo2: null, temp: null, hr: null });
  const recognitionRef = useRef(null);
  useEffect(() => {
    localStorage.setItem("medai_sessions", JSON.stringify(sessions));
  }, [sessions]);
  // Initialize Web Speech API (if available)
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      recognitionRef.current = null;
      return;
    }
    const recog = new SpeechRecognition();
    recog.lang = language;
    recog.interimResults = false;
    recog.maxAlternatives = 1;
    recog.onresult = (event) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      setInputText(text);
    };
    recog.onerror = (err) => console.warn("STT error", err);
    recog.onend = () => setIsListening(false);
    recognitionRef.current = recog;
    return () => {
      if (recognitionRef.current) recognitionRef.current.onresult = null;
    };
  }, [language]);
  function startListening() {
    if (!recognitionRef.current) return alert("Speech recognition not available in this browser.");
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (e) {
      console.warn(e);
    }
  }
  function stopListening() {
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
    setIsListening(false);
  }
  // Simple rule-based triage engine (MVP/demo)
  function triageEngine({ text, device }) {
    // Normalize text
    const t = (text || "").toLowerCase();
    const words = t.split(/[^a-zA-Z0-9]+/).filter(Boolean);
    // Basic symptom keywords and flags
    const flags = {
      fever: /fever|temperature|hot|chills/.test(t),
      cough: /cough|coughing/.test(t),
      breath: /breath|breathing|shortness|dyspnea|breathless/.test(t),
      chest: /chest|pressure|pain in chest/.test(t),
      vomit: /vomit|nausea|throw up/.test(t),
      dizzy: /dizzy|faint|lightheaded/.test(t),
      bleed: /bleed|blood/.test(t),
      rash: /rash|itch|red spot|spots/.test(t),
    };
    // Device warnings
    const dev = device || {};
    const devWarnings = [];
    if (dev.spo2 && dev.spo2 < 92) devWarnings.push("Low oxygen saturation (SpO2)");
    if (dev.temp && dev.temp >= 38.0) devWarnings.push("Fever: elevated body temperature");
    if (dev.hr && (dev.hr < 50 || dev.hr > 120)) devWarnings.push("Abnormal heart rate");
    // Basic triage logic
    let urgency = "low";
    let reasonParts = [];
    if (flags.chest || flags.breath || devWarnings.some(w => /oxygen|heart|breath/i.test(w))) {
      urgency = "high";
      reasonParts.push("Symptoms related to breathing or chest pain can be serious.");
    } else if (flags.fever && flags.cough) {
      urgency = "moderate";
      reasonParts.push("Fever with cough may need medical review within 24-48 hours.");
    } else if (flags.fever) {
      urgency = "low";
      reasonParts.push("Fever alone often needs home care and monitoring.");
    } else if (flags.rash && flags.fever) {
      urgency = "moderate";
      reasonParts.push("Fever with rash can be a sign of infection; consult if it worsens.");
    } else if (flags.vomit || flags.dizzy) {
      urgency = "moderate";
      reasonParts.push("Persistent vomiting or dizziness can cause dehydration and needs attention.");
    } else {
      reasonParts.push("Symptoms seem mild from the description.");
    }
    // Incorporate device warnings into reason & urgency
    if (devWarnings.length > 0) {
      reasonParts = reasonParts.concat(devWarnings.map(w => `Device reading: ${w}.`));
      if (devWarnings.some(w => /Low oxygen|Abnormal heart rate/i.test(w))) urgency = "high";
    }
    // Confidence heuristic
    let confidence = 0.6; // base
    const keywordCount = words.length;
    if (keywordCount > 6) confidence += 0.15;
    if (devWarnings.length > 0) confidence += 0.15;
    if (urgency === "high") confidence = Math.max(confidence, 0.8);
    confidence = Math.min(0.95, confidence);
    // Simple list of possible conditions (very high-level for demo only!)
    const possible = [];
    if (flags.fever && flags.cough) possible.push("Flu or respiratory infection");
    if (flags.cough && flags.breath) possible.push("Lower respiratory tract issue (e.g., pneumonia)");
    if (flags.rash) possible.push("Allergic reaction or skin infection");
    if (flags.vomit) possible.push("Gastroenteritis or food-related illness");
    if (possible.length === 0) possible.push("Common cold or minor viral illness");
    const explanation = reasonParts.join(" ");
    return {
      urgency,
      explanation,
      confidence: (confidence * 100).toFixed(0) + "%",
      possible,
      timestamp: new Date().toISOString(),
    };
  }
  function handleTriage() {
    const payload = { text: inputText || transcript, device: deviceData };
    const result = triageEngine(payload);
    setCurrentResult(result);
    const session = {
      id: `s_${Date.now()}`,
      input: payload,
      result,
    };
    setSessions(prev => [session, ...prev].slice(0, 50));
  }
  function simulateDevice() {
    // Random-ish simulated readings for demo
    const spo2 = Math.round(90 + Math.random() * 10); // 90-100
    const temp = +(36 + Math.random() * 3).toFixed(1); // 36-39
    const hr = Math.round(55 + Math.random() * 60); // 55-115
    const d = { spo2, temp, hr };
    setDeviceData(d);
  }
  function clearDevice() {
    setDeviceData({ spo2: null, temp: null, hr: null });
  }
  function exportSessions() {
    const blob = new Blob([JSON.stringify(sessions, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "medai_sessions.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  function deleteSession(id) {
    setSessions(prev => prev.filter(s => s.id !== id));
  }
  return (
    <div style={{ fontFamily: "system-ui, Arial", padding: 20, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 4 }}>MedAI Connect — Demo PWA</h1>
      <p style={{ color: "#555" }}>Prototype web app: voice/text symptom input • local triage • simulated device data • explanations</p>
      <section style={{ marginTop: 20, padding: 12, border: "1px solid #eee", borderRadius: 8 }}>
        <h2>1. Input</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ minWidth: 90 }}>Language</label>
          <select value={language} onChange={e => setLanguage(e.target.value)}>
            <option value="en">English</option>
            <option value="hi">Hindi (sample)</option>
            <option value="ta">Tamil (sample)</option>
          </select>
        </div>
        <div style={{ marginTop: 12 }}>
          <textarea
            placeholder="Describe your symptoms here (or use voice)"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            rows={4}
            style={{ width: "100%", padding: 8 }}
          />
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
          <button onClick={() => { if (isListening) stopListening(); else startListening(); }}>
            {isListening ? "Stop Listening" : "Start Voice Input"}
          </button>
          <button onClick={() => { setInputText(transcript); }}>Use Last Transcript</button>
          <button onClick={handleTriage}>Run Triage</button>
        </div>
        <div style={{ marginTop: 10 }}>
          <small style={{ color: "#666" }}>Transcript: {transcript || <em>none</em>}</small>
        </div>
      </section>
      <section style={{ marginTop: 20, padding: 12, border: "1px solid #eee", borderRadius: 8 }}>
        <h2>2. Simulated Device (optional)</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={simulateDevice}>Simulate Readings</button>
          <button onClick={clearDevice}>Clear</button>
        </div>
        <div style={{ marginTop: 8 }}>
          <div>SpO₂: {deviceData.spo2 ?? "—"}</div>
          <div>Temp: {deviceData.temp ? deviceData.temp + " °C" : "—"}</div>
          <div>HR: {deviceData.hr ?? "—"}</div>
        </div>
      </section>
      <section style={{ marginTop: 20, padding: 12, border: "1px solid #eee", borderRadius: 8 }}>
        <h2>3. Result</h2>
        {currentResult ? (
          <div>
            <div><strong>Urgency:</strong> {currentResult.urgency}</div>
            <div><strong>Confidence:</strong> {currentResult.confidence}</div>
            <div style={{ marginTop: 6 }}><strong>Why:</strong> {currentResult.explanation}</div>
            <div style={{ marginTop: 6 }}><strong>Possible:</strong>
              <ul>
                {currentResult.possible.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
            <div style={{ marginTop: 6 }}>
              <small style={{ color: "#666" }}>Timestamp: {currentResult.timestamp}</small>
            </div>
          </div>
        ) : (
          <div><em>No triage run yet.</em></div>
        )}
      </section>
      <section style={{ marginTop: 20, padding: 12, border: "1px solid #eee", borderRadius: 8 }}>
        <h2>4. Sessions (local cache)</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={exportSessions}>Export Sessions</button>
          <button onClick={() => { setSessions([]); localStorage.removeItem('medai_sessions'); }}>Clear Sessions</button>
        </div>
        <div style={{ marginTop: 12 }}>
          {sessions.length === 0 ? <div><em>No sessions saved.</em></div> : (
            <div>
              {sessions.map(s => (
                <div key={s.id} style={{ borderTop: "1px solid #f0f0f0", paddingTop: 8, marginTop: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div><strong>{s.id}</strong> — <small>{new Date(s.result.timestamp).toLocaleString()}</small></div>
                    <div><button onClick={() => deleteSession(s.id)}>Delete</button></div>
                  </div>
                  <div style={{ marginTop: 6 }}><strong>Input:</strong> {s.input.text || s.input.device ? JSON.stringify(s.input) : '—'}</div>
                  <div style={{ marginTop: 6 }}><strong>Urgency:</strong> {s.result.urgency} • <strong>Confidence:</strong> {s.result.confidence}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      <footer style={{ marginTop: 30, color: '#777' }}>
        <small>Prototype — not a medical device. For demo only. Always consult a certified healthcare professional.</small>
      </footer>
    </div>
  );
}
/*
Minimal service worker (save as public/sw.js and register in index.js):
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('medai-v1').then((cache) => cache.addAll(['/', '/index.html', '/favicon.ico']))
  );
});
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((resp) => resp || fetch(event.request))
  );
});
Register in index.js:
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(()=>console.log('SW registered'));
}
*/