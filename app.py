import os
import requests

from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# Mengaktifkan CORS untuk semua endpoint API
CORS(app, resources={
    r"/*": {
        "origins": "*"
    }
})

APIFY_TOKEN = os.getenv("APIFY_TOKEN")
APIFY_RUN_ID = os.getenv("APIFY_RUN_ID")

APIFY_URL = (
    f"https://api.apify.com/v2/actor-runs/"
    f"{APIFY_RUN_ID}/dataset/items"
)


@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "status": "success",
        "message": "API Data Yonif Jawa Tengah",
        "endpoint": "/api/batalyon"
    })


@app.route("/api/batalyon", methods=["GET"])
def get_batalyon():
    if not APIFY_TOKEN or not APIFY_RUN_ID:
        return jsonify({
            "status": "error",
            "message": "Token atau Run ID Apify belum diatur"
        }), 500

    try:
        response = requests.get(
            APIFY_URL,
            params={
                "token": APIFY_TOKEN,
                "format": "json",
                "clean": "true"
            },
            timeout=30
        )

        response.raise_for_status()
        data = response.json()

        if not isinstance(data, list):
            return jsonify({
                "status": "error",
                "message": "Format data Apify bukan daftar JSON",
                "data": data
            }), 502

        hasil = []

        for item in data:
            teks = " ".join(
                str(value)
                for value in item.values()
                if value is not None
            ).lower()

            if (
                ("yonif" in teks or "batalyon infanteri" in teks)
                and (
                    "jawa tengah" in teks
                    or "jateng" in teks
                    or "jateng" in str(
                        item.get("province", "")
                    ).lower()
                )
            ):
                hasil.append(item)

        return jsonify({
            "status": "success",
            "provinsi": "Jawa Tengah",
            "total": len(hasil),
            "data": hasil
        })

    except requests.exceptions.Timeout:
        return jsonify({
            "status": "error",
            "message": "Permintaan ke Apify mengalami timeout"
        }), 504

    except requests.exceptions.RequestException as e:
        return jsonify({
            "status": "error",
            "message": "Gagal mengambil data dari Apify",
            "detail": str(e)
        }), 502

    except ValueError:
        return jsonify({
            "status": "error",
            "message": "Respons Apify bukan JSON yang valid"
        }), 502


if __name__ == "__main__":
    app.run(debug=True, port=5000)