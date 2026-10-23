import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const hex = process.env.ACCESS_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "ACCESS_ENCRYPTION_KEY ausente ou inválida (precisa ter 64 caracteres hex)."
    );
  }
  return Buffer.from(hex, "hex");
}

// Formato do texto cifrado: "enc:v1:<iv>:<tag>:<dados>" (tudo em hex)
const PREFIX = "enc:v1:";

export function encryptSecret(plain: string): string {
  if (!plain) return plain;
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return (
    PREFIX +
    iv.toString("hex") +
    ":" +
    tag.toString("hex") +
    ":" +
    encrypted.toString("hex")
  );
}

export function decryptSecret(value: string): string {
  if (!value || !value.startsWith(PREFIX)) return value; // texto antigo, não cifrado
  try {
    const key = getKey();
    const [, , ivHex, tagHex, dataHex] = value.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const data = Buffer.from(dataHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return "[erro ao descriptografar]";
  }
}
