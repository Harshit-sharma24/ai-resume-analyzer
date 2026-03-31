import { useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker?url";
import mammoth from "mammoth";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

function App() {
  const [file, setFile] = useState(null);
  const [aiResult, setAiResult] = useState("");
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => setFile(e.target.files[0]);

  // TEXT EXTRACT
  const extractText = async (file) => {
    if (file.type === "application/pdf") {
      const reader = new FileReader();
      return new Promise((resolve) => {
        reader.onload = async function () {
          const pdf = await pdfjsLib.getDocument(
            new Uint8Array(this.result)
          ).promise;

          let text = "";
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map((i) => i.str).join(" ") + " ";
          }
          resolve(text);
        };
        reader.readAsArrayBuffer(file);
      });
    }

    if (file.type === "text/plain") return await file.text();

    if (file.type.includes("wordprocessingml")) {
      const buffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer: buffer });
      return result.value;
    }
  };

  // AI CALL
  const handleUpload = async () => {
    if (!file) return alert("Upload resume");

    setLoading(true);
    setAiResult("");

    let text = await extractText(file);

    const res = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          temperature: 0,
          messages: [
            { role: "system", content: "Resume analyzer" },
            {
              role: "user",
              content: `Analyze resume:

Strengths:
Weaknesses:
Suggestions:
ATS Score:

${text.slice(0, 1200)}`,
            },
          ],
        }),
      }
    );

    const data = await res.json();
    setAiResult(data.choices?.[0]?.message?.content || "");
    setLoading(false);
  };

  const getScore = () => {
    const m = aiResult.match(/ATS Score[:\s]*([0-9]+)/i);
    return m ? m[1] : "70";
  };

  // PARSER
  const parse = () => {
    let sec = { strengths: [], weaknesses: [], suggestions: [] };
    let current = "";

    aiResult.split("\n").forEach((l) => {
      let line = l.trim().replace(/\*\*/g, "");
      let lower = line.toLowerCase();

      if (lower.includes("strength")) current = "strengths";
      else if (lower.includes("weakness")) current = "weaknesses";
      else if (lower.includes("suggest")) current = "suggestions";
      else if (line && current) {
        sec[current].push(line);
      }
    });

    return sec;
  };

  const dataParsed = parse();

  const defaultSuggestions = [
    "Add 2-3 strong projects with measurable results",
    "Include metrics like % improvement or numbers",
    "Optimize keywords based on job role",
    "Improve formatting for ATS readability",
    "Add certifications or achievements section",
  ];

  const finalSuggestions =
    dataParsed.suggestions.length > 0
      ? dataParsed.suggestions
      : defaultSuggestions;

  return (
    <div style={styles.app}>
      <div style={styles.container}>

        {/* 🔥 LANDING */}
        {!aiResult && !loading && (
          <div style={styles.landing}>
            <div style={styles.heroCard}>
              <h1 style={styles.heroTitle}>AI Resume Analyzer 🚀</h1>

              <p style={styles.heroSub}>
                Get ATS Score, Strengths & Smart Suggestions instantly
              </p>

              <label style={styles.uploadBox}>
                📄 Upload Resume
                <input type="file" hidden onChange={handleFileChange} />
              </label>

              {file && <p style={styles.fileName}>{file.name}</p>}

              {/* ✅ GAP FIX */}
              <button style={styles.mainBtn} onClick={handleUpload}>
                Analyze Resume
              </button>
            </div>
          </div>
        )}

        {/* 🔥 RESULT (UNCHANGED) */}
        {(aiResult || loading) && (
          <>
            <h1 style={{ marginTop: 10 }}>Resume Analyzer 🚀</h1>

            {loading && <p>Analyzing...</p>}

            {aiResult && (
              
              <>
              
                <div style={styles.stats}>
                  <div style={styles.statCard}>
                    <h3>ATS Score</h3>
                    <p>{getScore()}%</p>
                  </div>

                  <div style={styles.statCard}>
                    <h3>Strengths</h3>
                    <p>{dataParsed.strengths.length}</p>
                  </div>

                  <div style={styles.statCard}>
                    <h3>Weakness</h3>
                    <p>{dataParsed.weaknesses.length}</p>
                  </div>
                </div>
                

                <div style={styles.flow}>
                  <div style={styles.card}>
                    <h3>💡 Strengths</h3>
                    {dataParsed.strengths.map((s, i) => (
                      <div key={i} style={styles.skillCard}>{s}</div>
                    ))}
                  </div>

                  <div style={styles.card}>
                    <h3>⚠ Weaknesses</h3>
                    {dataParsed.weaknesses.length > 0 ? (
                      dataParsed.weaknesses.map((s, i) => (
                        <div key={i} style={styles.missingCard}>{s}</div>
                      ))
                    ) : (
                      <div style={styles.successBox}>
                        ✅ No major gaps found
                      </div>
                    )}
                  </div>

                  <div style={styles.card}>
                    <h3>🚀 Suggestions</h3>

                    {finalSuggestions.map((s, i) => (
                      <div key={i} style={styles.suggestionCard}>{s}</div>
                    ))}

                    {/* ✅ ATS SCORE LINE ADDED */}
                    <div style={styles.atsLine}>
                      📊 ATS Score: {getScore()}%
                    </div>

                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// 🎨 STYLES
const styles = {
  app: {
    minHeight: "100vh",
    background: "linear-gradient(135deg,#fff7ed,#fdf2f8,#f3e8ff)",
    display: "flex",
    justifyContent: "center",
    padding: "20px",
  },

  container: {
    width: "100%",
    maxWidth: "1000px",
  },

  landing: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "95vh",
  },

  heroCard: {
    width: "100%",
    maxWidth: "710px",
    padding: "45px 35px",
    borderRadius: "32px",
    background: "#fff",
    textAlign: "center",
    boxShadow: "0 25px 60px rgba(0,0,0,0.08)",
  },

  heroTitle: {
    fontSize: "42px",
    fontWeight: "800",
    marginBottom: "40px",
    color: "#a16cfd",
  },

  heroSub: {
    marginBottom: "60px",
    color: "#495979",
  },

  uploadBox: {
    border: "4px dashed #d7b5fb",
    padding: "32px",
    borderRadius: "12px",
    cursor: "pointer",
    marginBottom: "30px",
  },

  fileName: {
    marginBottom: "10px",
  },

  mainBtn: {
    width: "100%",
    marginTop: "60px", // ✅ GAP FIX
    padding: "14px",
    borderRadius: "22px",
    border: "none",
    background: "linear-gradient(90deg,#fb7185,#a78bfa)",
    color: "#fff",
    fontWeight: "600",
    cursor: "pointer",
  },
  

  stats: {
    display: "flex",
    gap: "15px",
    marginTop: "20px",
  },

  statCard: {
    flex: 1,
    background: "#e8f1fb",
    padding: "25px",
    borderRadius: "12px",
    textAlign: "center",
    marginTop: "20px",
  },

  flow: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    marginTop: "20px",
  },

  card: {
    background: "#fff",
    padding: "18px",
    borderRadius: "14px",
    marginTop: "20px",
  },

  skillCard: {
    background: "#eef2ff",
    padding: "20px",
    borderRadius: "8px",
    marginTop: "6px",
     borderLeft: "4px solid #6366f1",
      fontSize: "18px",
  },

  missingCard: {
    background: "#fef2f2",
    padding: "20px",
    borderRadius: "8px",
    marginTop: "6px",
    borderLeft: "4px solid #f5abab",
     fontSize: "18px",
  },

  suggestionCard: {
    background: "#f0fdf4",
    padding: "20px",
    borderRadius: "8px",
    marginTop: "6px",
     borderLeft: "4px solid #71ea95",
      fontSize: "18px",
  },

  successBox: {
    padding: "10px",
    background: "#dcfce7",
    borderRadius: "18px",
    textAlign: "center",
  },

  atsLine: {
    marginTop: "15px",
    fontWeight: "600",
    color: "#4f46e5",
  },
};

export default App;