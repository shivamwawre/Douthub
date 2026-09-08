// Feature 7: Voice Assistance (STT & TTS)

class VoiceController {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.synth = typeof window !== "undefined" ? window.speechSynthesis : null;
    this.isSpeaking = false;
    this.initSpeechRecognition();
  }

  initSpeechRecognition() {
    if (typeof window === "undefined") return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = "en-US";
    }
  }

  startListening(onResult, onStatusChange, onError) {
    if (!this.recognition) {
      if (onError) onError("Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.");
      return;
    }

    try {
      this.recognition.onstart = () => {
        this.isListening = true;
        if (onStatusChange) onStatusChange(true);
      };

      this.recognition.onresult = (event) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (onResult) onResult(transcript);
      };

      this.recognition.onerror = (event) => {
        console.warn("Speech recognition error:", event.error);
        this.isListening = false;
        if (onStatusChange) onStatusChange(false);
        if (onError) onError(`Microphone note: ${event.error}`);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        if (onStatusChange) onStatusChange(false);
      };

      this.recognition.start();
    } catch (e) {
      console.warn("Failed to start voice recognition", e);
      this.isListening = false;
      if (onStatusChange) onStatusChange(false);
    }
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  speak(text, onStart, onEnd) {
    if (!this.synth) {
      alert("Text-to-speech is not supported on this browser.");
      return;
    }

    // Cancel any previous speech
    this.synth.cancel();

    // Clean markdown symbols for natural speech
    const cleanText = text
      .replace(/[#*`_~]/g, "")
      .replace(/\$[^$]+\$/g, "formula")
      .replace(/https?:\/\/\S+/g, "");

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      this.isSpeaking = true;
      if (onStart) onStart();
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      if (onEnd) onEnd();
    };

    utterance.onerror = (e) => {
      console.warn("Speech synthesis error", e);
      this.isSpeaking = false;
      if (onEnd) onEnd();
    };

    this.synth.speak(utterance);
  }

  stopSpeaking() {
    if (this.synth) {
      this.synth.cancel();
      this.isSpeaking = false;
    }
  }
}

export const voiceController = new VoiceController();
