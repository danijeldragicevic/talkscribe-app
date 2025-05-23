# Talkscribe — Text & Speech Converter
Talkscribe is a simple and accessible web application that converts text into speech and transcribes voice into text. It is designed for clarity and ease of use — suitable for people with limited mobility or assistive needs.

The app uses AI-powered services to generate speech and transcribe spoken audio.

## Features
- Text to Speech
- Speech to Text
- Multi-language support

## Supported languages
- English | French | German | Portuguese | Spanish | Swedish

## Technologies
- Vanilla HTML, CSS, and JavaScript
- REST API as backend service

## Setup & Usage
1. Clone the repository:
```commandline
git clone https://github.com/danijeldragicevic/talkscribe-app.git
cd talkscribe-app
```
2. Open `index.html` in your browser or host the files via any static file server (e.g. S3, Netlify).
3. Backend URL is configured inside `config.js`:
```commandline 
const CONFIG = {
    BASE_URL: "https://talkscribe.org/api"
};
```

## Backend Endpoints
The frontend calls these endpoints:

| Methods | Endpoint                         | Description                     |
|---------|----------------------------------|---------------------------------|
| POST    | /text-to-speech                  | Converts input text to speech   |
| POST    | /speech-to-text                  | Starts speech transcription job |
| GET     | /speech-to-text/status/{jobName} | Polls for transcription results |
| GET     | /languages                       | Lists supported languages       |

## Privacy & Security
No voice or text data is stored. <br>
All processing is temporary and cleared after each request.

## Contributing
Contributions are welcome! Feel free to submit a pull request or open an issue.

## License
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
