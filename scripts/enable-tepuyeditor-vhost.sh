#!/bin/bash
# Enables the local Apache site for https://tepuyeditor.aca.
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "This step needs root to edit /etc/hosts, enable the site, and reload Apache." >&2
  exit 1
fi

hosts=/etc/hosts
if ! grep -qw 'tepuyeditor.aca' "$hosts"; then
  printf '\n127.0.0.1\ttepuyeditor.aca\n' >> "$hosts"
fi

ln -sfn ../sites-available/tepuyeditor.aca.conf /etc/apache2/sites-enabled/tepuyeditor.aca.conf
apache2ctl configtest
systemctl reload apache2
echo "https://tepuyeditor.aca is enabled"
