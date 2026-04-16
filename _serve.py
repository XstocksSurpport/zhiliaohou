# -*- coding: utf-8 -*-
"""
Local static file server. Opens http://localhost:<port>/ (default port from open-site launcher).
Tries 0.0.0.0 then 127.0.0.1 for localhost compatibility.
"""
from __future__ import annotations

import errno
import http.client
import http.server
import os
import socketserver
import sys
import threading
import time
import webbrowser


def main() -> None:
    if len(sys.argv) < 3:
        print("Usage: python _serve.py <base_port> <site_root>", flush=True)
        raise SystemExit(2)

    base_port = int(sys.argv[1])
    root = os.path.abspath(sys.argv[2])
    if not os.path.isdir(root):
        print("Not a directory:", root, flush=True)
        raise SystemExit(1)

    os.chdir(root)
    handler = http.server.SimpleHTTPRequestHandler

    class ReuseTCPServer(socketserver.TCPServer):
        allow_reuse_address = True

    port_file = os.path.join(root, "_listening_port.txt")

    def cleanup_port_file() -> None:
        try:
            if os.path.isfile(port_file):
                os.remove(port_file)
        except OSError:
            pass

    last_err: OSError | None = None
    for delta in range(20):
        port = base_port + delta
        httpd: socketserver.TCPServer | None = None
        bind_name = ""

        # Prefer 0.0.0.0 first for localhost IPv4 loopback
        for bind_host in ("0.0.0.0", "127.0.0.1"):
            try:
                httpd = ReuseTCPServer((bind_host, port), handler)
                bind_name = bind_host
                break
            except OSError as e:
                last_err = e
                win = getattr(e, "winerror", None)
                in_use = win in (10048, 98) or e.errno == errno.EADDRINUSE
                if in_use and bind_host == "127.0.0.1":
                    httpd = None
                    break
                if in_use and bind_host == "0.0.0.0":
                    continue
                if not in_use:
                    print("Bind failed (%s:%s):" % (bind_host, port), e, flush=True)
                    raise SystemExit(1) from e

        if httpd is None:
            if last_err and getattr(last_err, "winerror", None) in (10048, 98):
                print("Port %s in use, trying next…" % port, flush=True)
            continue

        try:
            with open(port_file, "w", encoding="ascii", newline="\n") as f:
                f.write(str(port))
        except OSError as e:
            print("Warning: could not write _listening_port.txt:", e, flush=True)

        url = "http://localhost:%s/" % port

        def try_open_browser() -> None:
            for _ in range(120):
                try:
                    conn = http.client.HTTPConnection("127.0.0.1", port, timeout=1.0)
                    conn.request("GET", "/")
                    resp = conn.getresponse()
                    try:
                        resp.read()
                    finally:
                        conn.close()
                    break
                except OSError:
                    pass
                except Exception:
                    pass
                time.sleep(0.15)
            try:
                webbrowser.open(url, new=1)
                print("Opened browser:", url, flush=True)
            except Exception as ex:
                print("Paste this in your browser:", url, flush=True)
                print("(Auto-open failed:", ex, ")", flush=True)

        threading.Thread(target=try_open_browser, daemon=True).start()

        print("--- ORDI local server ---", flush=True)
        print("Root:", root, flush=True)
        print("Listening:", "%s:%s" % (bind_name, port), flush=True)
        print("Open:", url, flush=True)
        print("Keep this window open; Ctrl+C to stop.", flush=True)
        print("---------------------", flush=True)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.", flush=True)
        finally:
            try:
                httpd.shutdown()
            except OSError:
                pass
            try:
                httpd.server_close()
            except OSError:
                pass
            cleanup_port_file()
        return

    print("Could not bind on ports %s–%s." % (base_port, base_port + 19), flush=True)
    if last_err:
        print("Last error:", last_err, flush=True)
    raise SystemExit(1)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("Start failed:", repr(exc), flush=True)
        import traceback

        traceback.print_exc()
        raise SystemExit(1) from exc
