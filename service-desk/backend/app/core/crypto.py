import os
from cryptography.fernet import Fernet

KEY_FILE = ".fernet.key"

def _get_cipher() -> Fernet:
    if os.path.exists(KEY_FILE):
        with open(KEY_FILE, "rb") as f:
            key = f.read().strip()
    else:
        key = Fernet.generate_key()
        with open(KEY_FILE, "wb") as f:
            f.write(key)
    return Fernet(key)

cipher = _get_cipher()

def encrypt_text(value: str | None) -> str | None:
    if not value:
        return value
    if value.startswith("gAAAAAB"):
        return value
    return cipher.encrypt(value.encode("utf-8")).decode("utf-8")

def decrypt_text(value: str | None) -> str | None:
    if not value:
        return value
    if not value.startswith("gAAAAAB"):
        return value
    try:
        return cipher.decrypt(value.encode("utf-8")).decode("utf-8")
    except Exception:
        return value
