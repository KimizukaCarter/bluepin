from flask import Flask, render_template, request, jsonify, send_from_directory, url_for
from werkzeug.utils import secure_filename
import os, json, time

app = Flask(__name__)

# === Paths ===
UPLOAD_FOLDER = os.path.join("static", "uploads")
DATA_FILE = "data.json"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# === Load/save comments persistently ===
def load_data():
    if not os.path.exists(DATA_FILE):
        return {}
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return {}

def save_data(data):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

db = load_data()  # { filename: { "title": str, "comments": [ {author,text,ts} ] } }

@app.route("/")
def index():
    # Halaman hanya render shell; data di-load via JS
    return render_template("index.html")

# List images
@app.route("/api/images")
def api_images():
    files = sorted([f for f in os.listdir(UPLOAD_FOLDER) if not f.startswith(".")])
    out = []
    for f in files:
        item = db.get(f, {"title": f, "comments": []})
        out.append({
            "filename": f,
            "title": item.get("title", f),
            "url": url_for("uploaded_file", filename=f),
            "comments": item.get("comments", [])
        })
    return jsonify(out)

# Upload image
@app.route("/api/upload", methods=["POST"])
def api_upload():
    if "file" not in request.files:
        return jsonify({"error": "No file"}), 400
    file = request.files["file"]
    title = request.form.get("title", "") or file.filename
    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400
    safe = secure_filename(file.filename)
    path = os.path.join(UPLOAD_FOLDER, safe)

    # Hindari overwrite (append timestamp kalau nama sama)
    base, ext = os.path.splitext(safe)
    while os.path.exists(path):
        safe = f"{base}_{int(time.time())}{ext}"
        path = os.path.join(UPLOAD_FOLDER, safe)

    file.save(path)
    if safe not in db:
        db[safe] = {"title": title, "comments": []}
        save_data(db)

    return jsonify({
        "filename": safe,
        "title": db[safe]["title"],
        "url": url_for("uploaded_file", filename=safe),
        "comments": db[safe]["comments"]
    })

# Add comment
@app.route("/api/comment", methods=["POST"])
def api_comment():
    data = request.get_json(force=True, silent=True) or {}
    filename = data.get("filename")
    author = (data.get("author") or "Anon").strip()[:40]
    text = (data.get("text") or "").strip()[:500]
    if not filename or not text:
        return jsonify({"error": "Invalid data"}), 400
    if filename not in db:
        # file belum terindex (jarang, tapi handle aja)
        db[filename] = {"title": filename, "comments": []}

    comment = {"author": author or "Anon", "text": text, "ts": int(time.time())}
    db[filename]["comments"].append(comment)
    save_data(db)
    return jsonify({"ok": True, "comments": db[filename]["comments"]})

# Serve uploaded files
@app.route("/uploads/<path:filename>")
def uploaded_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

if __name__ == "__main__":
    # Kalau port mau custom, ganti di sini
    app.run(debug=True)
