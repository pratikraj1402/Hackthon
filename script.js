// ==========================================
// PHASE 1 - PATIENT REGISTRATION
// ==========================================
const registrationForm = document.getElementById("registrationForm");

if (registrationForm) {
    registrationForm.addEventListener("submit", function(event) {
        event.preventDefault();

        const patient = {
            name: document.getElementById("name").value,
            age: document.getElementById("age").value,
            gender: document.getElementById("gender").value,
            mobile: document.getElementById("mobile").value,
            abha: document.getElementById("abha").value,
            language: document.getElementById("language").value
        };

        localStorage.setItem("patientData", JSON.stringify(patient));
        window.location.href = "consent.html";
    });
}

// ==========================================
// PHASE 1 - CONSENT
// ==========================================
function submitConsent() {
    const consent = document.getElementById("consent");

    if (!consent.checked) {
        alert("Please give consent before continuing.");
        return;
    }

    localStorage.setItem("consent", "true");
    window.location.href = "history.html";
}

// ==========================================
// PHASE 2 - MEDICAL HISTORY
// ==========================================
const historyForm = document.getElementById("historyForm");

if (historyForm) {
    historyForm.addEventListener("submit", function(event) {
        event.preventDefault();

        const history = {
            problem: document.getElementById("problem").value,
            duration: document.getElementById("duration").value,
            severity: document.getElementById("severity").value,
            conditions: document.getElementById("conditions").value,
            medicines: document.getElementById("medicines").value,
            allergy: document.getElementById("allergy").value,
            prakriti: document.getElementById("prakriti").value,
            vikriti: document.getElementById("vikriti").value,
            agni: document.getElementById("agni").value,
            koshtha: document.getElementById("koshtha").value,
            ahara: document.getElementById("ahara").value,
            additional: document.getElementById("additional").value
        };

        localStorage.setItem("medicalHistory", JSON.stringify(history));
        alert("Medical history saved successfully!");
        window.location.href = "documents.html";
    });
}

// ==========================================
// PHASE 3 - OCR PARSING & MEDICAL EXTRACTION
// ==========================================
const documentForm = document.getElementById("documentForm");

if (documentForm) {
    documentForm.addEventListener("submit", async function(event) {
        event.preventDefault();

        const fileInput = document.getElementById("documentFile");
        const statusDiv = document.getElementById("ocrStatus");

        if (!fileInput.files || !fileInput.files[0]) {
            alert("Please select a document image file.");
            return;
        }

        const file = fileInput.files[0];
        statusDiv.innerHTML = "<em>Running in-browser OCR processing... Please wait...</em>";

        try {
            const worker = await Tesseract.createWorker('eng');
            const ret = await worker.recognize(file);
            await worker.terminate();

            const text = ret.data.text;
            document.getElementById("extractedText").value = text;

            const parsed = parseMedicalText(text);

            document.getElementById("extractedDiagnosis").value = parsed.diagnoses.join("\n") || "No diagnosis patterns detected.";
            document.getElementById("extractedMedicines").value = parsed.medicines.join("\n") || "No medicine patterns detected.";
            document.getElementById("extractedTestValues").value = parsed.testValues.join("\n") || "No lab test patterns detected.";

            statusDiv.innerHTML = "<strong style='color:#27ae60;'>OCR Processed Successfully! Review extracted items below.</strong>";
        } catch (err) {
            console.error(err);
            statusDiv.innerHTML = "<strong style='color:#c0392b;'>OCR processing failed. Please ensure file is a clear image.</strong>";
        }
    });
}

function parseMedicalText(rawText) {
    const lines = rawText.split('\n');
    const diagnoses = [];
    const medicines = [];
    const testValues = [];

    const medRegex = /(?:Tab|Cap|Syr|Inj|Tablet|Capsule)?\s*([A-Z][a-z0-9]+(?:\s+[A-Z][a-z0-9]+)?\s+\d+\s*(?:mg|g|ml|mcg))/gi;
    const testRegex = /([A-Za-z\s]+)\s*[:=]\s*(\d+(?:\.\d+)?)\s*(mg\/dL|g\/dL|mmol\/L|%|bpm|mmHg|\/cu mm)/gi;
    const diagKeywords = ["diagnosis", "impression", "diagnosed with", "condition", "fever", "diabetes", "hypertension", "infection"];

    let match;
    while ((match = medRegex.exec(rawText)) !== null) {
        medicines.push(match[0].trim());
    }

    while ((match = testRegex.exec(rawText)) !== null) {
        testValues.push(`${match[1].trim()}: ${match[2]} ${match[3]}`);
    }

    lines.forEach(line => {
        const lower = line.toLowerCase();
        if (diagKeywords.some(keyword => lower.includes(keyword))) {
            diagnoses.push(line.trim());
        }
    });

    return { diagnoses, medicines, testValues };
}

// ==========================================
// PHASE 3 - SAVE DOCUMENT & TIMELINE LOGIC
// ==========================================
function saveDocument() {
    const fileInput = document.getElementById("documentFile");
    const docType = document.getElementById("documentType").value;
    const fileName = fileInput.files[0] ? fileInput.files[0].name : "Uploaded Document";

    const diagnosis = document.getElementById("extractedDiagnosis").value;
    const medicines = document.getElementById("extractedMedicines").value;
    const testValues = document.getElementById("extractedTestValues").value;
    const rawText = document.getElementById("extractedText").value;

    const docRecord = {
        type: docType,
        fileName: fileName,
        diagnosis: diagnosis,
        medicines: medicines,
        testValues: testValues,
        extractedText: rawText
    };

    localStorage.setItem("documentData", JSON.stringify(docRecord));

    const existingTimeline = JSON.parse(localStorage.getItem("documentTimeline")) || [];
    existingTimeline.unshift({
        title: `${docType} - ${fileName}`,
        timestamp: new Date().toLocaleString(),
        details: diagnosis !== "No diagnosis patterns detected." && diagnosis ? diagnosis : `Document type: ${docType} uploaded.`
    });

    localStorage.setItem("documentTimeline", JSON.stringify(existingTimeline));

    alert("Document & Extracted Information Saved To Timeline!");
    renderTimeline("documentTimeline");
}

function renderTimeline(elementId) {
    const container = document.getElementById(elementId);
    if (!container) return;

    const timelineData = JSON.parse(localStorage.getItem("documentTimeline")) || [];
    if (timelineData.length === 0) {
        container.innerHTML = "<p>No timeline records created yet.</p>";
        return;
    }

    container.innerHTML = timelineData.map(item => `
        <div class="timeline-item">
            <div class="timeline-date">${item.timestamp}</div>
            <div class="timeline-content">
                <strong>${item.title}</strong>
                <p>${item.details}</p>
            </div>
        </div>
    `).join("");
}

// ==========================================
// PHASE 4 - ML CONNECTION & DOCTOR DASHBOARD
// ==========================================

// Replace this URL with your newly generated ngrok URL anytime you restart the Python server
const ML_API_URL = "https://delete-chubby-jaunt.ngrok-free.dev/generate_summary"; 

async function fetchAISummaryFromModel(patient, history, doc) {
    if (!patient && !history) return "Insufficient patient data.";

    const inputText = `Patient: ${patient?.name || 'Unknown'}, ${patient?.age || 'N/A'}, ${patient?.gender || 'Unknown'}. ` +
                      `Complaint: ${history?.problem || 'Unspecified'} for ${history?.duration || 'unspecified'}. ` +
                      `Severity: ${history?.severity || 'Not rated'}. ` +
                      `History: ${history?.conditions || 'None'}. ` +
                      `OCR Diagnoses: ${doc?.diagnosis || 'None'}. ` +
                      `OCR Meds: ${doc?.medicines || 'None'}. ` +
                      `OCR Tests: ${doc?.testValues || 'None'}.`;

    try {
        const response = await fetch(ML_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "ngrok-skip-browser-warning": "true" 
            },
            body: JSON.stringify({ input_text: inputText })
        });

        if (!response.ok) throw new Error("Network response failed");
        
        const data = await response.json();
        return data.ai_summary;
    } catch (error) {
        console.error("ML Model connection failed, falling back to basic summary:", error);
        return generateAISummaryText(patient, history, doc);
    }
}

async function loadDoctorDashboard() {
    const patient = JSON.parse(localStorage.getItem("patientData"));
    const history = JSON.parse(localStorage.getItem("medicalHistory"));
    const doc = JSON.parse(localStorage.getItem("documentData"));
    const approvalState = JSON.parse(localStorage.getItem("doctorApproval")) || { status: "Pending Review", doctorName: "", summaryText: "" };

    if (patient) {
        setText("docName", patient.name);
        setText("docAge", patient.age);
        setText("docGender", patient.gender);
        setText("docMobile", patient.mobile);
        setText("docAbha", patient.abha || "-");
        setText("docLanguage", patient.language);
    }

    if (history) {
        setText("docProblem", history.problem);
        setText("docDuration", history.duration);
        setText("docSeverity", history.severity);
        setText("docConditions", history.conditions || "-");
        setText("docMedicines", history.medicines || "-");
        setText("docAllergies", history.allergy || "-");
        setText("docPrakriti", history.prakriti || "-");
        setText("docVikriti", history.vikriti || "-");
        setText("docAgni", history.agni || "-");
        setText("docKoshtha", history.koshtha || "-");
        setText("docAhara", history.ahara || "-");
    }

    const reportsListContainer = document.getElementById("docReportsList");
    if (reportsListContainer && doc) {
        reportsListContainer.innerHTML = `
            <div class="report-box">
                <h4>${doc.type}: ${doc.fileName}</h4>
                <p><strong>Diagnoses Identified:</strong> ${doc.diagnosis || 'None'}</p>
                <p><strong>Prescription Findings:</strong> ${doc.medicines || 'None'}</p>
                <p><strong>Lab Results:</strong> ${doc.testValues || 'None'}</p>
            </div>
        `;
    }

    renderTimeline("docTimeline");

    const summaryTextArea = document.getElementById("aiSummaryText");
    if (summaryTextArea) {
        if (approvalState.summaryText) {
            summaryTextArea.value = approvalState.summaryText;
        } else {
            summaryTextArea.value = "Connecting to ML Model to generate clinical summary... Please wait.";
            summaryTextArea.value = await fetchAISummaryFromModel(patient, history, doc);
        }
    }

    const doctorInput = document.getElementById("doctorNameInput");
    if (doctorInput && approvalState.doctorName) {
        doctorInput.value = approvalState.doctorName;
    }

    updateApprovalUI(approvalState.status, approvalState.doctorName, approvalState.timestamp);
}

// Fallback logic if the Python ML server is offline
function generateAISummaryText(patient, history, doc) {
    if (!patient && !history) return "Insufficient patient data to generate clinical summary.";

    let summary = `CLINICAL SUMMARY & SYNTHESIS:\n`;
    summary += `------------------------------------\n`;
    summary += `Patient ${patient?.name || 'Unknown'}, ${patient?.age || 'N/A'} Y/O ${patient?.gender || ''}, presented with primary concern: '${history?.problem || 'Unspecified'}' (${history?.duration || 'unspecified duration'}, Severity: ${history?.severity || 'Not rated'}).\n\n`;

    summary += `HISTORICAL & AYURVEDIC MARKERS:\n`;
    summary += `- Past Conditions: ${history?.conditions || 'None reported'}\n`;
    summary += `- Current Medications: ${history?.medicines || 'None'}\n`;
    summary += `- Allergies: ${history?.allergy || 'No known allergies'}\n`;
    summary += `- Constitution: Prakriti (${history?.prakriti || 'N/A'}), Agni (${history?.agni || 'N/A'})\n\n`;

    summary += `DIAGNOSTIC OCR FINDINGS:\n`;
    if (doc) {
        summary += `- Record: ${doc.type}\n`;
        summary += `- Detected Diagnoses: ${doc.diagnosis || 'None'}\n`;
        summary += `- Detected Meds: ${doc.medicines || 'None'}\n`;
        summary += `- Lab Results: ${doc.testValues || 'None'}\n`;
    } else {
        summary += `- No uploaded reports available for analysis.\n`;
    }

    summary += `\nPHYSICIAN CLINICAL IMPRESSION:\n`;
    summary += `Patient intake complete. Validate listed allergies prior to issuing new orders.`;

    return summary;
}

async function regenerateAISummary() {
    const patient = JSON.parse(localStorage.getItem("patientData"));
    const history = JSON.parse(localStorage.getItem("medicalHistory"));
    const doc = JSON.parse(localStorage.getItem("documentData"));

    document.getElementById("aiSummaryText").value = "Re-synthesizing using ML Model... Please wait.";
    const newSummary = await fetchAISummaryFromModel(patient, history, doc);
    document.getElementById("aiSummaryText").value = newSummary;
    alert("AI Summary re-synthesized from ML Model!");
}

function saveDoctorEdits() {
    const summaryText = document.getElementById("aiSummaryText").value;
    const doctorName = document.getElementById("doctorNameInput").value;

    const existingState = JSON.parse(localStorage.getItem("doctorApproval")) || {};
    existingState.summaryText = summaryText;
    existingState.doctorName = doctorName;

    localStorage.setItem("doctorApproval", JSON.stringify(existingState));
    alert("Draft edits saved successfully.");
}

function approveRecord() {
    const doctorName = document.getElementById("doctorNameInput").value.trim();
    const summaryText = document.getElementById("aiSummaryText").value;

    if (!doctorName) {
        alert("Please enter Doctor Name / License ID before sign-off.");
        return;
    }

    const approvalState = {
        status: "Approved",
        doctorName: doctorName,
        summaryText: summaryText,
        timestamp: new Date().toLocaleString()
    };

    localStorage.setItem("doctorApproval", JSON.stringify(approvalState));
    updateApprovalUI("Approved", doctorName, approvalState.timestamp);
    alert(`Medical record officially approved and signed off by ${doctorName}!`);
}

function updateApprovalUI(status, doctorName, timestamp) {
    const badge = document.getElementById("approvalBadge");
    if (!badge) return;

    if (status === "Approved") {
        badge.className = "status-badge badge-approved";
        badge.textContent = `Approved by ${doctorName} on ${timestamp || 'Recent'}`;
    } else {
        badge.className = "status-badge badge-pending";
        badge.textContent = "Status: Pending Doctor Review";
    }
}

// ==========================================
// SUMMARY PAGE LOADER
// ==========================================
function loadSummary() {
    const patient = JSON.parse(localStorage.getItem("patientData"));
    const history = JSON.parse(localStorage.getItem("medicalHistory"));
    const doc = JSON.parse(localStorage.getItem("documentData"));

    if (patient) {
        setText("summaryName", patient.name);
        setText("summaryAge", patient.age);
        setText("summaryGender", patient.gender);
        setText("summaryMobile", patient.mobile);
        setText("summaryAbha", patient.abha || "-");
        setText("summaryLanguage", patient.language);
    }

    if (history) {
        setText("summaryProblem", history.problem);
        setText("summaryDuration", history.duration);
        setText("summarySeverity", history.severity);
        setText("summaryConditions", history.conditions || "-");
        setText("summaryMedicines", history.medicines || "-");
        setText("summaryAllergy", history.allergy || "-");
        setText("summaryPrakriti", history.prakriti || "-");
        setText("summaryVikriti", history.vikriti || "-");
        setText("summaryAgni", history.agni || "-");
        setText("summaryKoshtha", history.koshtha || "-");
        setText("summaryAhara", history.ahara || "-");
    }

    if (doc) {
        setText("summaryDiagnosis", doc.diagnosis || "-");
        setText("summaryExtractedMedicines", doc.medicines || "-");
        setText("summaryTestValues", doc.testValues || "-");
        setText("summaryExtractedText", doc.extractedText || "No extracted text available.");
    }

    renderTimeline("summaryTimeline");
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

function finishApplication() {
    alert("Thank you. Your information has been recorded.");
    localStorage.clear();
    window.location.href = "index.html";
}

// Automatic Initializations
if (document.getElementById("summaryName")) {
    loadSummary();
}

if (document.getElementById("documentTimeline")) {
    renderTimeline("documentTimeline");
}

if (document.getElementById("aiSummaryText")) {
    loadDoctorDashboard();
}