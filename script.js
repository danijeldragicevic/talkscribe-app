// === INIT ===
document.addEventListener("DOMContentLoaded", () => {
    const savedTab = localStorage.getItem("selectedTab") || "ttsTab";
    openTab(savedTab);

    loadLanguages();
    setupCharacterCounter();
});

// === LANGUAGE LOADING ===
function loadLanguages() {
    fetch(`${CONFIG.BASE_URL}/languages`)
        .then(response => {
            if (!response.ok) throw new Error("Failed to fetch languages");
            return response.json();
        })
        .then(languages => {
            const languagesList = document.getElementById("languagesList");
            languagesList.innerHTML = '';

            languages.forEach((lang, index) => {
                const span = document.createElement("span");
                span.textContent = lang.languageName;
                languagesList.appendChild(span);

                if (index < languages.length - 1) {
                    const sep = document.createElement("span");
                    sep.textContent = " | ";
                    languagesList.appendChild(sep);
                }
            });
        })
        .catch(error => console.error("Error loading languages:", error));
}

// === CHARACTER COUNTER ===
function setupCharacterCounter() {
    const textarea = document.getElementById("textInput");
    const charCount = document.getElementById("charCount");

    textarea.addEventListener("input", () => {
        const length = textarea.value.length;
        charCount.textContent = length;
        charCount.style.color = length > 450 ? 'red' : '';
    });
}

// === TAB SWITCHING ===
function openTab(tabId) {
    const tabs = document.querySelectorAll('.tab-content');
    const buttons = document.querySelectorAll('.tab-button');

    tabs.forEach(tab => tab.classList.remove('active'));
    buttons.forEach(btn => btn.classList.remove('active'));

    document.getElementById(tabId).classList.add('active');

    const clicked = Array.from(buttons).find(btn => btn.getAttribute("onclick")?.includes(tabId));
    if (clicked) clicked.classList.add('active');

    localStorage.setItem("selectedTab", tabId);
}

// === TEXT TO SPEECH ===
function sendTextToSpeech() {
    const text = document.getElementById("textInput").value.trim();
    const audioPlayer = document.getElementById("audioPlayer");
    const audioContainer = document.getElementById("audioContainer");

    if (text === "") {
        alert("Please enter some text!");
        return;
    }

    fetch(`${CONFIG.BASE_URL}/text-to-speech`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text })
    })
        .then(res => res.ok ? res.blob() : Promise.reject(res))
        .then(blob => {
            const url = URL.createObjectURL(blob);
            audioPlayer.src = url;
            audioContainer.style.display = "block";
            audioPlayer.play();
        })
        .catch(err => {
            console.error("TTS error:", err);
            audioPlayer.src = "error_message.mp3";
            audioContainer.style.display = "block";
            audioPlayer.play();
        });
}

// === TEXT ANIMATION ===
function animateText(el, text) {
    el.textContent = '';
    let i = 0;
    const timer = setInterval(() => {
        el.textContent += text.charAt(i);
        i++;
        if (i === text.length) clearInterval(timer);
    }, 25);
}

// === MICROPHONE RECORDING FOR STT ===
const recordButton = document.getElementById("recordButton");
const statusText = document.getElementById("recordingStatus");
const transcribingStatus = document.getElementById("transcribingStatus");
let mediaRecorder;
let recordedChunks = [];

recordButton.addEventListener("click", async () => {
    recordedChunks = [];
    statusText.textContent = "Recording... (up to 10s)";
    recordButton.disabled = true;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.ondataavailable = event => {
            if (event.data.size > 0) recordedChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
            statusText.textContent = "Recording stopped. Sending to backend...";
            transcribingStatus.style.display = "block"; // ⏳ Show spinner
            sendRecordedBlob(new Blob(recordedChunks, { type: 'audio/webm' }));
        };

        mediaRecorder.start();

        setTimeout(() => {
            mediaRecorder.stop();
            stream.getTracks().forEach(track => track.stop());
        }, 10000);

    } catch (error) {
        console.error("Mic access error:", error);
        statusText.textContent = "Mic access denied or error occurred.";
        recordButton.disabled = false;
    }
});

function sendRecordedBlob(blob) {
    const log = document.getElementById("transcriptionLog");

    const formData = new FormData();
    formData.append("audioFile", blob, "recording.webm");

    fetch(`${CONFIG.BASE_URL}/speech-to-text`, {
        method: "POST",
        body: formData
    })
    .then(res => res.ok ? res.json() : Promise.reject(res))
    .then(data => {
        const container = document.createElement("div");
        container.classList.add("transcribed-output");

        const timestamp = new Date().toLocaleTimeString();
        const meta = document.createElement("div");
        meta.style.fontSize = "12px";
        meta.style.color = "#888";
        meta.style.marginBottom = "5px";
        meta.textContent = `${timestamp}`;

        const content = document.createElement("div");
        animateText(content, data.transcript);

        container.appendChild(meta);
        container.appendChild(content);
        log.prepend(container);
    })
    .catch(err => {
        console.error("STT error:", err);
        const errorBox = document.createElement("div");
        errorBox.classList.add("transcribed-output");
        errorBox.textContent = "An error occurred while converting the audio.";
        log.prepend(errorBox);
    })
    .finally(() => {
        statusText.textContent = "";
        transcribingStatus.style.display = "none"; // ✅ Hide spinner
        recordButton.disabled = false;
    });
}
