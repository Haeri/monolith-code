#!/usr/bin/env bash
# Creates the self-signed certificate used to sign the macOS app.
#
# macOS auto-updates (Squirrel.Mac) only install an update that is signed with
# the same certificate as the running app. A self-signed certificate is enough
# for that check; it does not remove the Gatekeeper warning on first install.
#
# Run this ONCE and keep the output safe: if the certificate is lost or
# replaced, every macOS user has to download the next version manually.
#
# Usage: scripts/create-mac-signing-cert.sh [--replace] [output-dir]
#   --replace  create a new certificate even though build/mac-signing-cert.pem
#              exists (only when the old one is lost, leaked or expired)
set -euo pipefail

REPLACE=false
if [ "${1:-}" = "--replace" ]; then
  REPLACE=true
  shift
fi

OUT_DIR="${1:-$HOME/monolith-code-signing}"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PUBLIC_CERT="$REPO_DIR/build/mac-signing-cert.pem"
NAME="monolith code"

if [ -e "$PUBLIC_CERT" ] && [ "$REPLACE" = false ]; then
  echo "A signing certificate already exists ($PUBLIC_CERT)." >&2
  echo "Replacing it means every macOS user has to download the next version manually," >&2
  echo "and the MAC_CSC_LINK / MAC_CSC_KEY_PASSWORD secrets must be updated." >&2
  echo "Run with --replace only if the old certificate is lost, leaked or expired." >&2
  exit 1
fi

if [ -e "$OUT_DIR" ]; then
  echo "Refusing to overwrite existing $OUT_DIR" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
chmod 700 "$OUT_DIR"
umask 077

cat > "$OUT_DIR/openssl.cnf" <<EOF
[req]
distinguished_name = dn
x509_extensions = ext
prompt = no

[dn]
CN = $NAME
O = Haeri

[ext]
basicConstraints = critical, CA:false
keyUsage = critical, digitalSignature
extendedKeyUsage = critical, codeSigning
subjectKeyIdentifier = hash
EOF

openssl rand -base64 32 | tr -d '\n' > "$OUT_DIR/password.txt"

# 20 years, so the certificate never has to be replaced
openssl req -x509 -newkey rsa:3072 -nodes -days 7300 \
  -config "$OUT_DIR/openssl.cnf" \
  -keyout "$OUT_DIR/key.pem" -out "$OUT_DIR/cert.pem" 2>/dev/null

# macOS' keychain cannot import the newer PKCS#12 encryption that OpenSSL 3 uses by default
openssl pkcs12 -export -name "$NAME" \
  -inkey "$OUT_DIR/key.pem" -in "$OUT_DIR/cert.pem" \
  -certpbe PBE-SHA1-3DES -keypbe PBE-SHA1-3DES -macalg sha1 \
  -passout file:"$OUT_DIR/password.txt" -out "$OUT_DIR/signing.p12"

openssl base64 -A -in "$OUT_DIR/signing.p12" -out "$OUT_DIR/signing.p12.base64"

# The key now lives (encrypted) inside signing.p12 only
rm "$OUT_DIR/key.pem" "$OUT_DIR/openssl.cnf"

cp "$OUT_DIR/cert.pem" "$PUBLIC_CERT"

cat <<EOF
Created in $OUT_DIR:
  signing.p12          certificate + private key (encrypted)
  password.txt         password for signing.p12
  signing.p12.base64   signing.p12 encoded for the GitHub secret
  cert.pem             public certificate (also copied to build/mac-signing-cert.pem)

Next, store the secrets on GitHub (values are read from the files, never printed):
  gh secret set MAC_CSC_LINK --repo Haeri/monolith-code < "$OUT_DIR/signing.p12.base64"
  gh secret set MAC_CSC_KEY_PASSWORD --repo Haeri/monolith-code < "$OUT_DIR/password.txt"

Then back up signing.p12 and password.txt somewhere safe outside this computer
(e.g. a password manager). Commit build/mac-signing-cert.pem; it is public.
EOF
