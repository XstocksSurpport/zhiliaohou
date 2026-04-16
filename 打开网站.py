# -*- coding: utf-8 -*-
"""Start server in this folder at http://localhost:3002/ (requires Python)."""
import os
import subprocess
import sys

ROOT = os.path.abspath(os.path.dirname(__file__))
os.chdir(ROOT)

def main() -> None:
    script = os.path.join(ROOT, "_serve.py")
    if not os.path.isfile(script):
        print("Missing _serve.py", file=sys.stderr)
        input("Press Enter to exit…")
        sys.exit(1)
    port = "3002"
    try:
        r = subprocess.run(
            [sys.executable, script, port, ROOT],
            cwd=ROOT,
        )
        raise SystemExit(r.returncode)
    except KeyboardInterrupt:
        pass
    except Exception as e:
        print("Start failed:", e, file=sys.stderr)
        input("Press Enter to exit…")
        raise SystemExit(1) from e


if __name__ == "__main__":
    main()
