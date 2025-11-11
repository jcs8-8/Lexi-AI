class DocumentSummarizer {
  constructor() {
    this.currentFile = null;
    this.currentFileContent = null;
    this.initializeElements();
    this.setupEventListeners();
    this.loadSettings();
  }

  initializeElements() {
    this.elements = {
      aiProvider: document.getElementById("aiProvider"),
      apiKey: document.getElementById("apiKey"),
      summaryLength: document.getElementById("summaryLength"),
      uploadArea: document.getElementById("uploadArea"),
      fileInput: document.getElementById("fileInput"),
      fileInfo: document.getElementById("fileInfo"),
      fileName: document.getElementById("fileName"),
      fileSize: document.getElementById("fileSize"),
      removeFile: document.getElementById("removeFile"),
      summarizeBtn: document.getElementById("summarizeBtn"),
      btnText: document.querySelector(".btn-text"),
      btnLoader: document.querySelector(".btn-loader"),
      resultsSection: document.getElementById("resultsSection"),
      summaryContent: document.getElementById("summaryContent"),
      copyBtn: document.getElementById("copyBtn"),
      downloadBtn: document.getElementById("downloadBtn"),
      statusMessage: document.getElementById("statusMessage"),
    };
  }

  setupEventListeners() {
    // File upload events
    this.elements.uploadArea.addEventListener("click", () =>
      this.elements.fileInput.click()
    );
    this.elements.fileInput.addEventListener("change", (e) =>
      this.handleFileSelect(e.target.files[0])
    );

    // Drag and drop events
    this.elements.uploadArea.addEventListener("dragover", (e) =>
      this.handleDragOver(e)
    );
    this.elements.uploadArea.addEventListener("dragleave", (e) =>
      this.handleDragLeave(e)
    );
    this.elements.uploadArea.addEventListener("drop", (e) =>
      this.handleDrop(e)
    );

    // Remove file
    this.elements.removeFile.addEventListener("click", () => this.removeFile());

    // Summarize button
    this.elements.summarizeBtn.addEventListener("click", () =>
      this.summarizeDocument()
    );

    // Copy and download actions
    this.elements.copyBtn.addEventListener("click", () =>
      this.copyToClipboard()
    );
    this.elements.downloadBtn.addEventListener("click", () =>
      this.downloadSummary()
    );

    // Settings change
    this.elements.aiProvider.addEventListener("change", () =>
      this.saveSettings()
    );
    this.elements.apiKey.addEventListener("input", () => this.saveSettings());
    this.elements.summaryLength.addEventListener("change", () =>
      this.saveSettings()
    );
  }

  loadSettings() {
    const savedProvider = localStorage.getItem("aiProvider");
    const savedApiKey = localStorage.getItem("apiKey");
    const savedLength = localStorage.getItem("summaryLength");

    if (savedProvider) this.elements.aiProvider.value = savedProvider;
    if (savedApiKey) this.elements.apiKey.value = savedApiKey;
    if (savedLength) this.elements.summaryLength.value = savedLength;
  }

  saveSettings() {
    localStorage.setItem("aiProvider", this.elements.aiProvider.value);
    localStorage.setItem("apiKey", this.elements.apiKey.value);
    localStorage.setItem("summaryLength", this.elements.summaryLength.value);
    this.updateSummarizeButton();
  }

  handleDragOver(e) {
    e.preventDefault();
    this.elements.uploadArea.classList.add("dragover");
  }

  handleDragLeave(e) {
    e.preventDefault();
    this.elements.uploadArea.classList.remove("dragover");
  }

  handleDrop(e) {
    e.preventDefault();
    this.elements.uploadArea.classList.remove("dragover");
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      this.handleFileSelect(files[0]);
    }
  }

  async handleFileSelect(file) {
    if (!file) return;

    const validTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!validTypes.includes(file.type)) {
      this.showStatus("Please select a PDF or DOCX file.", "error");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      // 10MB limit
      this.showStatus("File size must be less than 10MB.", "error");
      return;
    }

    this.currentFile = file;
    this.showFileInfo(file);
    this.showStatus("Extracting text from document...", "info");

    try {
      if (file.type === "application/pdf") {
        this.currentFileContent = await this.extractTextFromPDF(file);
      } else if (
        file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        this.currentFileContent = await this.extractTextFromDOCX(file);
      }

      if (this.currentFileContent && this.currentFileContent.length > 50) {
        this.showStatus("Document loaded successfully!", "success");
        this.updateSummarizeButton();
      } else {
        this.showStatus(
          "Could not extract text from document. Please try another file.",
          "error"
        );
        this.removeFile();
      }
    } catch (error) {
      console.error("Error processing file:", error);
      this.showStatus("Error processing file. Please try again.", "error");
      this.removeFile();
    }
  }

  async extractTextFromPDF(file) {
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader();
      fileReader.onload = async function () {
        try {
          const typedarray = new Uint8Array(this.result);
          const pdf = await pdfjsLib.getDocument(typedarray).promise;
          let fullText = "";

          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
              .map((item) => item.str)
              .join(" ");
            fullText += pageText + "\n";
          }

          resolve(fullText.trim());
        } catch (error) {
          reject(error);
        }
      };
      fileReader.onerror = () => reject(new Error("Failed to read PDF file"));
      fileReader.readAsArrayBuffer(file);
    });
  }

  async extractTextFromDOCX(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = function (e) {
        mammoth
          .extractRawText({ arrayBuffer: e.target.result })
          .then((result) => resolve(result.value))
          .catch((error) => reject(error));
      };
      reader.onerror = () => reject(new Error("Failed to read DOCX file"));
      reader.readAsArrayBuffer(file);
    });
  }

  showFileInfo(file) {
    this.elements.fileName.textContent = file.name;
    this.elements.fileSize.textContent = this.formatFileSize(file.size);
    this.elements.fileInfo.style.display = "block";
    this.elements.uploadArea.style.display = "none";
  }

  removeFile() {
    this.currentFile = null;
    this.currentFileContent = null;
    this.elements.fileInfo.style.display = "none";
    this.elements.uploadArea.style.display = "block";
    this.elements.resultsSection.style.display = "none";
    this.updateSummarizeButton();
    this.hideStatus();
  }

  formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  updateSummarizeButton() {
    const hasFile = this.currentFile && this.currentFileContent;
    const hasApiKey = this.elements.apiKey.value.trim().length > 0;
    this.elements.summarizeBtn.disabled = !hasFile || !hasApiKey;
  }

  async summarizeDocument() {
    if (!this.currentFileContent || !this.elements.apiKey.value.trim()) {
      this.showStatus(
        "Please upload a document and enter your API key.",
        "error"
      );
      return;
    }

    this.setLoadingState(true);
    this.showStatus("Generating summary with AI...", "info");

    try {
      let summary;
      const provider = this.elements.aiProvider.value;
      const apiKey = this.elements.apiKey.value.trim();
      const length = this.elements.summaryLength.value;

      if (provider === "openai") {
        summary = await this.summarizeWithOpenAI(
          this.currentFileContent,
          apiKey,
          length
        );
      } else if (provider === "gemini") {
        summary = await this.summarizeWithGemini(
          this.currentFileContent,
          apiKey,
          length
        );
      }

      if (summary) {
        this.displaySummary(summary);
        this.showStatus("Summary generated successfully!", "success");
      } else {
        throw new Error("Failed to generate summary");
      }
    } catch (error) {
      console.error("Summarization error:", error);
      this.showStatus(`Error: ${error.message}`, "error");
    } finally {
      this.setLoadingState(false);
    }
  }

  async summarizeWithOpenAI(text, apiKey, length) {
    const lengthInstructions = {
      short: "in 2-3 sentences",
      medium: "in one paragraph (4-6 sentences)",
      long: "in 2-3 detailed paragraphs",
    };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "user",
            content: `Please summarize the following document ${lengthInstructions[length]}. Focus on the main points, key findings, and important conclusions:\n\n${text}`,
          },
        ],
        max_tokens: length === "short" ? 150 : length === "medium" ? 300 : 600,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.error?.message || `OpenAI API error: ${response.status}`
      );
    }

    const data = await response.json();
    return data.choices[0]?.message?.content?.trim();
  }

  async summarizeWithGemini(text, apiKey, length) {
    const lengthInstructions = {
      short: "in 2-3 sentences",
      medium: "in one paragraph (4-6 sentences)",
      long: "in 2-3 detailed paragraphs",
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Please summarize the following document ${lengthInstructions[length]}. Focus on the main points, key findings, and important conclusions:\n\n${text}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens:
              length === "short" ? 150 : length === "medium" ? 300 : 600,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.error?.message || `Gemini API error: ${response.status}`
      );
    }

    const data = await response.json();
    return data.candidates[0]?.content?.parts[0]?.text?.trim();
  }

  setLoadingState(loading) {
    if (loading) {
      this.elements.btnText.style.display = "none";
      this.elements.btnLoader.style.display = "inline";
      this.elements.summarizeBtn.disabled = true;
    } else {
      this.elements.btnText.style.display = "inline";
      this.elements.btnLoader.style.display = "none";
      this.updateSummarizeButton();
    }
  }

  displaySummary(summary) {
    this.elements.summaryContent.textContent = summary;
    this.elements.resultsSection.style.display = "block";

    // Smooth scroll to results
    setTimeout(() => {
      this.elements.resultsSection.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 300);
  }

  async copyToClipboard() {
    try {
      await navigator.clipboard.writeText(
        this.elements.summaryContent.textContent
      );
      this.showStatus("Summary copied to clipboard!", "success");
    } catch (error) {
      console.error("Copy failed:", error);
      this.showStatus("Failed to copy to clipboard.", "error");
    }
  }

  downloadSummary() {
    const summary = this.elements.summaryContent.textContent;
    const fileName = this.currentFile
      ? `${this.currentFile.name.split(".")[0]}_summary.txt`
      : "document_summary.txt";

    const blob = new Blob([summary], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showStatus("Summary downloaded successfully!", "success");
  }

  showStatus(message, type) {
    this.elements.statusMessage.textContent = message;
    this.elements.statusMessage.className = `status-message ${type}`;
    this.elements.statusMessage.style.display = "block";

    // Auto hide success and info messages after 5 seconds
    if (type === "success" || type === "info") {
      setTimeout(() => this.hideStatus(), 5000);
    }
  }

  hideStatus() {
    this.elements.statusMessage.style.display = "none";
  }
}

// Initialize the application when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  // Set PDF.js worker path
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  // Initialize the app
  new DocumentSummarizer();

  console.log("📄 DocuSummarize AI initialized successfully!");
});