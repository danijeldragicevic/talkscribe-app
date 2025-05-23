// === INIT ===
document.addEventListener("DOMContentLoaded", () => {
    const savedTab = localStorage.getItem("selectedTab") || "ttsTab";
    openTab(savedTab);
    loadLanguages();
    setupCharacterCounter();
});

// === UI FUNCTIONS ===

// Tab switching and remembering last selected
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

// Character counter for textarea
function setupCharacterCounter() {
    const textarea = document.getElementById("textInput");
    const charCount = document.getElementById("charCount");

    textarea.addEventListener("input", () => {
        const length = textarea.value.length;
        charCount.textContent = length;
        charCount.style.color = length > 450 ? 'red' : '';
    });
}

// Animate transcript typing effect
function animateText(el, text) {
    el.textContent = '';
    let i = 0;
    const timer = setInterval(() => {
        el.textContent += text.charAt(i++);
        if (i === text.length) clearInterval(timer);
    }, 25);
}

// === TEXT TO SPEECH ===
function sendTextToSpeech() {
    const text = document.getElementById("textInput").value.trim();
    const audioPlayer = document.getElementById("audioPlayer");
    const audioContainer = document.getElementById("audioContainer");

    if (!text) {
        alert("Please enter some text!");
        return;
    }

    fetch(`${CONFIG.BASE_URL}/text-to-speech`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
    })
    .then(res => res.ok ? res.blob() : Promise.reject(res))
    .then(blob => {
        audioPlayer.src = URL.createObjectURL(blob);
        audioContainer.style.display = "block";
        audioPlayer.play();
    })
    .catch(async err => {
        if (err instanceof Response && err.status === 429) {
            const message = await err.json();
            alert("You're sending too many requests. Please try again later.");
            console.warn("Rate limit:", message?.error);
        } else {
            console.error("TTS error:", err);
            audioPlayer.src = "error_message.mp3";
            audioContainer.style.display = "block";
            audioPlayer.play();
        }
    });
}

// === LANGUAGE LIST ===
function loadLanguages() {
    fetch(`${CONFIG.BASE_URL}/languages`)
        .then(res => {
            if (!res.ok) throw new Error("Failed to fetch languages");
            return res.json();
        })
        .then(languages => {
            const container = document.getElementById("languagesList");
            container.innerHTML = '';

            languages.forEach((lang, idx) => {
                container.innerHTML += lang.languageName;
                if (idx < languages.length - 1) {
                    container.innerHTML += " | ";
                }
            });
        })
        .catch(error => console.error("Error loading languages:", error));
}

// === RECORDING & TRANSCRIPTION ===
const recordButton = document.getElementById("recordButton");
const statusText = document.getElementById("recordingStatus");
const transcribingStatus = document.getElementById("transcribingStatus");
let mediaRecorder, recordedChunks = [];

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
            statusText.textContent = "";
            transcribingStatus.style.display = "block";
            sendRecordedBlob(new Blob(recordedChunks, { type: 'audio/webm' }));
        };

        mediaRecorder.start();
        setTimeout(() => {
            mediaRecorder.stop();
            stream.getTracks().forEach(track => track.stop());
        }, 10000);
    } catch (err) {
        console.error("Mic access error:", err);
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
        if (!data.jobName) throw new Error("No jobName returned.");
        setTimeout(() => pollTranscriptionStatus(data.jobName), 5000); // Delay before polling
    })
    .catch(async err => {
        transcribingStatus.style.display = "none";
        recordButton.disabled = false;

        if (err instanceof Response && err.status === 429) {
            const message = await err.json();
            alert("You're sending too many requests. Please slow down.");
            console.warn("Rate limit:", message?.error);
        } else {
            console.error("STT start error:", err);
            const errorBox = document.createElement("div");
            errorBox.classList.add("transcribed-output");
            errorBox.textContent = "An error occurred while starting transcription.";
            log.prepend(errorBox);
        }
    });
}

function pollTranscriptionStatus(jobName) {
    const log = document.getElementById("transcriptionLog");
    const intervals = [5000, 5000, 5000, 5000, 10000];
    let attempt = 0;

    const checkStatus = () => {
        fetch(`${CONFIG.BASE_URL}/speech-to-text/status/${jobName}`)
            .then(res => res.ok ? res.json() : Promise.reject(res))
            .then(data => {
                if (data.jobStatus === "COMPLETED" && data.transcript) {
                    const container = document.createElement("div");
                    container.classList.add("transcribed-output");

                    const meta = document.createElement("div");
                    meta.textContent = new Date().toLocaleTimeString();
                    meta.style.fontSize = "12px";
                    meta.style.color = "#888";
                    meta.style.marginBottom = "5px";

                    const content = document.createElement("div");
                    animateText(content, data.transcript);

                    container.appendChild(meta);
                    container.appendChild(content);
                    log.prepend(container);

                    transcribingStatus.style.display = "none";
                    recordButton.disabled = false;
                } else if (attempt < intervals.length) {
                    setTimeout(checkStatus, intervals[attempt++]);
                } else {
                    const timeoutBox = document.createElement("div");
                    timeoutBox.classList.add("transcribed-output");
                    timeoutBox.textContent = "The transcription is taking longer than expected. Please try again.";
                    log.prepend(timeoutBox);

                    transcribingStatus.style.display = "none";
                    recordButton.disabled = false;
                }
            })
            .catch(async err => {
                transcribingStatus.style.display = "none";
                recordButton.disabled = false;

                if (err instanceof Response && err.status === 429) {
                    const msg = await err.json();
                    alert("Too many requests. Please slow down.");
                    console.warn("Rate limit:", msg?.error);
                } else {
                    console.error("Polling error:", err);
                    const errorBox = document.createElement("div");
                    errorBox.classList.add("transcribed-output");
                    errorBox.textContent = "Error checking transcription job.";
                    log.prepend(errorBox);
                }
            });
    };

    checkStatus();
}
