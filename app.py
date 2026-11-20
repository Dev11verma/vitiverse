from datetime import datetime
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
CORS(app)

# SQLite database configuration (creates vitiverse.db automatically—no MySQL needed)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///vitiverse.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)


# --- Database Models ---
class Story(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    body = db.Column(db.Text, nullable=False)
    is_anonymous = db.Column(db.Boolean, default=True)
    author = db.Column(db.String(100), default="Anonymous Member")
    hearts = db.Column(db.Integer, default=1)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "body": self.body,
            "is_anonymous": self.is_anonymous,
            "author": "Anonymous Member • Verified" if self.is_anonymous else self.author,
            "hearts": self.hearts,
            "created_at": self.created_at.strftime("%b %d, %I:%M %p"),
        }


class MoodEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    score = db.Column(db.Integer, nullable=False)
    note = db.Column(db.Text, default="")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "score": self.score,
            "note": self.note,
            "created_at": self.created_at.strftime("%b %d, %I:%M %p"),
        }


class PhototherapySession(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    session_number = db.Column(db.Integer, nullable=False)
    duration_sec = db.Column(db.Integer, default=45)
    dose_mj = db.Column(db.Integer, default=450)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "session_number": self.session_number,
            "duration_sec": self.duration_sec,
            "dose_mj": self.dose_mj,
            "created_at": self.created_at.strftime("%b %d, %I:%M %p"),
        }


# Create database tables automatically on startup
with app.app_context():
    db.create_all()


# --- Health Check Routes ---
@app.route("/")
def home():
    return jsonify({
        "message": "Welcome to Vitiverse Backend!",
        "status": "Backend & SQLite DB running successfully"
    })


@app.route("/api/health")
def health():
    return jsonify({"status": "OK", "project": "Vitiverse", "database": "SQLite"})


# --- Journey Wall API ---
@app.route("/api/stories", methods=["GET"])
def get_stories():
    stories = Story.query.order_by(Story.created_at.desc()).all()
    return jsonify([s.to_dict() for s in stories])


@app.route("/api/stories", methods=["POST"])
def create_story():
    data = request.get_json()
    new_story = Story(
        title=data.get("title", "").strip(),
        body=data.get("body", "").strip(),
        is_anonymous=bool(data.get("is_anonymous", True)),
        author=data.get("author", "Dev Verma • Community Member"),
    )
    db.session.add(new_story)
    db.session.commit()
    return jsonify(new_story.to_dict()), 201


# --- Mood Journal API ---
@app.route("/api/moods", methods=["POST"])
def create_mood():
    data = request.get_json()
    entry = MoodEntry(
        score=int(data.get("score", 4)),
        note=data.get("note", "").strip(),
    )
    db.session.add(entry)
    db.session.commit()
    return jsonify(entry.to_dict()), 201


# --- Phototherapy Tracker API ---
@app.route("/api/sessions", methods=["GET"])
def get_sessions():
    sessions = PhototherapySession.query.order_by(PhototherapySession.id.desc()).all()
    return jsonify([s.to_dict() for s in sessions])


@app.route("/api/sessions", methods=["POST"])
def add_session():
    count = PhototherapySession.query.count()
    next_num = 14 + count + 1
    new_session = PhototherapySession(session_number=next_num)
    db.session.add(new_session)
    db.session.commit()
    return jsonify(new_session.to_dict()), 201


if __name__ == "__main__":
    app.run(debug=True, port=5000)