import { SecurityError } from "./errors";
import dns from "node:dns/promises";
import net from "node:net";

const PRIVATE_BLOCKS = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
];

const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0", "127.0.0.1", "::1"]);

export function isPrivateIp(ip: string): boolean {
  if (ip === "::1" || ip === "0:0:0:0:0:0:0:1") return true;
  if (!net.isIPv4(ip)) {
    // Treat unknown ipv6 as potentially private for safety in local dev
    return ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80");
  }
  return PRIVATE_BLOCKS.some((re) => re.test(ip));
}

export async function assertSafeUrl(rawUrl: string, allowedHosts: string[] = []): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SecurityError("URL inválida");
  }

  if (!/^https?:$/.test(url.protocol)) {
    throw new SecurityError("Solo se permiten URLs http/https");
  }

  const hostname = url.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new SecurityError(`Host bloqueado: ${hostname}`);
  }

  if (allowedHosts.length > 0) {
    const ok = allowedHosts.some(
      (h) => hostname === h.toLowerCase() || hostname.endsWith("." + h.toLowerCase())
    );
    if (!ok) {
      throw new SecurityError(`Host no permitido: ${hostname}. Permitidos: ${allowedHosts.join(", ")}`);
    }
  }

  // Resolve to IPs and check none is private
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new SecurityError(`IP privada bloqueada: ${hostname}`);
  } else {
    try {
      const addrs = await dns.lookup(hostname, { all: true });
      for (const a of addrs) {
        if (isPrivateIp(a.address)) {
          throw new SecurityError(`Host resuelve a IP privada: ${hostname} -> ${a.address}`);
        }
      }
    } catch (err) {
      if (err instanceof SecurityError) throw err;
      throw new SecurityError(`No se pudo resolver host: ${hostname}`);
    }
  }

  return url;
}

const SECRET_HEADER_KEYS = [/auth/i, /api[-_ ]?key/i, /token/i, /secret/i];

export function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers || {})) {
    if (SECRET_HEADER_KEYS.some((re) => re.test(k))) {
      out[k] = "[redacted]";
    } else {
      out[k] = v;
    }
  }
  return out;
}
