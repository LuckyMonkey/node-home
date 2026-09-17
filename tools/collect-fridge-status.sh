#!/usr/bin/env bash
# Collect real fridge telemetry -> status.json
#
# Health is measured FUNCTIONALLY (does the service actually answer?) rather than
# by asking Docker for container state. A running container that stopped serving
# is a failure; this catches that. It also needs no docker-group privilege.
#
# Usage: tools/collect-fridge-status.sh > status.json
set -u

FRIDGE_SSH="${FRIDGE_SSH:-fridge@fridge.local}"
FRIDGE_IP="${FRIDGE_IP:-192.168.1.98}"

# --- host facts over ssh (all read-only, no sudo) ---
RAW=$(ssh -o BatchMode=yes -o ConnectTimeout=10 "$FRIDGE_SSH" '
  printf "HOST=%s\n"   "$(hostname)"
  printf "UPTIME=%s\n" "$(uptime -p | sed "s/^up //")"
  printf "KERNEL=%s\n" "$(uname -r)"
  printf "OS=%s\n"     "$(. /etc/os-release; echo "$PRETTY_NAME")"
  printf "LOAD=%s\n"   "$(cut -d" " -f1-3 /proc/loadavg)"
  printf "MEM=%s\n"    "$(free -m | awk "/Mem:/{printf \"%d/%d\", \$3, \$2}")"
  df -B1 --output=target,size,used / /srv/data /srv/backup /boot 2>/dev/null \
    | tail -n +2 | while read -r t s u; do printf "DISK=%s|%s|%s\n" "$t" "$s" "$u"; done
  printf "TRACKER=%s\n"    "$(systemctl is-active fridge-tracker 2>/dev/null)"
  printf "PHOTOS=%s\n"     "$(find /srv/backup/photos -type f 2>/dev/null | wc -l)"
  printf "HOLDS=%s\n"      "$(apt-mark showhold 2>/dev/null | wc -l)"
  printf "UPGRADABLE=%s\n" "$(apt list --upgradable 2>/dev/null | tail -n +2 | wc -l)"
' 2>/dev/null)

# --- functional service probes from the network side ---
probe() { # name test_cmd
  if eval "$2" >/dev/null 2>&1; then echo "PROBE=$1|up"; else echo "PROBE=$1|down"; fi
}
PROBES=$(
  probe dns-pihole   "dig +short +time=3 +tries=1 @$FRIDGE_IP google.com"
  probe dns-blocking "[ \"\$(dig +short +time=3 +tries=1 @$FRIDGE_IP doubleclick.net)\" = '0.0.0.0' ]"
  probe caddy-http   "curl -sf -o /dev/null --max-time 5 http://$FRIDGE_IP/"
  probe rocketchat   "curl -sf -o /dev/null --max-time 6 http://$FRIDGE_IP:3000/"
  probe tracker      "curl -sf -o /dev/null --max-time 5 http://$FRIDGE_IP:6969/stats"
  probe ssh          "ssh -o BatchMode=yes -o ConnectTimeout=6 $FRIDGE_SSH true"
)
TSTATS=$(curl -s --max-time 5 "http://$FRIDGE_IP:6969/stats" 2>/dev/null \
         | grep -oE '[0-9]+ torrents' | grep -oE '^[0-9]+' | head -1)

python3 - "$RAW
$PROBES
TORRENTS=${TSTATS:-0}" <<'PY'
import json, sys, datetime
raw = sys.argv[1] if len(sys.argv) > 1 else ""
d = {"generated": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
     "host": {}, "disks": [], "services": [], "backup": {}, "packages": {}, "tracker": {}}
for line in raw.splitlines():
    line = line.strip()
    if "=" not in line: continue
    k, v = line.split("=", 1)
    if   k == "HOST":   d["host"]["name"] = v
    elif k == "UPTIME": d["host"]["uptime"] = v
    elif k == "KERNEL": d["host"]["kernel"] = v
    elif k == "OS":     d["host"]["os"] = v
    elif k == "LOAD":   d["host"]["load"] = v
    elif k == "MEM" and "/" in v:
        u, t = v.split("/"); d["host"]["memory"] = {"usedMb": int(u), "totalMb": int(t)}
    elif k == "DISK":
        t, s, u = v.split("|"); s, u = int(s), int(u)
        d["disks"].append({"mount": t, "totalBytes": s, "usedBytes": u,
                           "percent": round(u/s*100, 1) if s else 0})
    elif k == "PROBE":
        n, st = v.split("|"); d["services"].append({"name": n, "status": st})
    elif k == "TRACKER":  d["tracker"]["service"] = v
    elif k == "TORRENTS": d["tracker"]["torrents"] = int(v) if v.isdigit() else 0
    elif k == "PHOTOS":
        d["backup"]["photographsFiles"] = int(v) if v.isdigit() else 0
    elif k == "HOLDS":       d["packages"]["held"] = int(v) if v.isdigit() else 0
    elif k == "UPGRADABLE":  d["packages"]["upgradable"] = int(v) if v.isdigit() else 0
d["backup"]["photographsTotal"] = 35119
d["backup"]["source"] = "One Touch/Photos/Photographs"
d["backup"]["target"] = "fridge:/srv/backup/photos"
print(json.dumps(d, indent=2))
PY
