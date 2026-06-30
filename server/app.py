import os
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, auth, firestore
import requests

app = Flask(__name__)
CORS(app, origins=["https://ejones35.github.io"])

SERVICE_ACCOUNT = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY")
FROM_EMAIL = os.environ.get("FROM_EMAIL", "fleet-command@ucn-terminal.app")

db = None
if SERVICE_ACCOUNT:
    try:
        cred = credentials.Certificate(json.loads(SERVICE_ACCOUNT))
        firebase_admin.initialize_app(cred, {"projectId": "ucn-terminal"})
        db = firestore.client()
    except Exception as e:
        print(f"Firebase init failed: {e}")

@app.route("/api/delete-user", methods=["POST"])
def delete_user():
    try:
        if db is None:
            return jsonify({"error": "Firebase not configured"}), 500

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing authorization"}), 401

        admin_token = auth_header.split("Bearer ")[1]
        admin_decoded = auth.verify_id_token(admin_token)
        admin_uid = admin_decoded["uid"]

        admin_doc = db.collection("users").document(admin_uid).get()
        if not admin_doc.exists:
            return jsonify({"error": "Admin record not found"}), 403

        admin_data = admin_doc.to_dict()
        admin_perms = admin_data.get("permissions", {}).get("admin")
        admin_role = admin_data.get("profile", {}).get("role")
        if not admin_perms and admin_role != "admin":
            return jsonify({"error": "Insufficient permissions"}), 403

        body = request.get_json()
        target_uid = body.get("uid")
        target_email = body.get("email")
        target_callsign = body.get("callsign", "Unknown")

        if not target_uid:
            return jsonify({"error": "Missing uid"}), 400

        try:
            auth.delete_user(target_uid)
        except firebase_admin.auth.UserNotFoundError:
            pass

        db.collection("users").document(target_uid).delete()

        if target_email and SENDGRID_API_KEY:
            send_notification(target_email, target_callsign)

        return jsonify({"success": True})

    except firebase_admin.auth.InvalidIdTokenError:
        return jsonify({"error": "Invalid token"}), 401
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def send_notification(to_email, callsign):
    subject = "UCN Terminal \u2014 Account Deleted"
    body = (
        f"Your UCN Terminal account ({callsign}) has been permanently deleted "
        "by Fleet Command.\n\n"
        "If you believe this was in error, please contact an administrator.\n\n"
        "\u2014 UCN Fleet Command"
    )

    try:
        requests.post(
            "https://api.sendgrid.com/v3/mail/send",
            headers={
                "Authorization": f"Bearer {SENDGRID_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "personalizations": [{"to": [{"email": to_email}]}],
                "from": {"email": FROM_EMAIL},
                "subject": subject,
                "content": [{"type": "text/plain", "value": body}],
            },
            timeout=10,
        )
    except Exception as e:
        print(f"Email send failed: {e}")


@app.route("/health")
def health():
    return jsonify({"status": "ok", "firebase": db is not None})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
