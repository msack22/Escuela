import net from "net";
import axios from "axios";
import { SocksProxyAgent } from "socks-proxy-agent";

const TOR_SOCKS_HOST = "127.0.0.1";
const TOR_SOCKS_PORT = 9050;
const TOR_CONTROL_HOST = "127.0.0.1";
const TOR_CONTROL_PORT = 9051;
const TOR_CONTROL_PASSWORD = process.env.TOR_CONTROL_PASSWORD ?? "";

/**
 * Sends SIGNAL NEWNYM to the Tor control port to rotate the exit IP.
 */
export function changeTorIp(): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = net.createConnection(TOR_CONTROL_PORT, TOR_CONTROL_HOST, () => {
      const auth = TOR_CONTROL_PASSWORD
        ? `AUTHENTICATE "${TOR_CONTROL_PASSWORD}"\r\n`
        : "AUTHENTICATE\r\n";
      client.write(auth);
    });

    let buffer = "";
    client.on("data", (chunk) => {
      buffer += chunk.toString();
      if (buffer.includes("250 OK\r\n") && !buffer.includes("SIGNAL")) {
        client.write("SIGNAL NEWNYM\r\n");
      } else if (buffer.split("250 OK").length >= 2) {
        client.write("QUIT\r\n");
        client.end();
        resolve();
      }
    });

    client.on("error", (err) => reject(new Error(`Tor control error: ${err.message}`)));
    client.setTimeout(5000, () => {
      client.destroy();
      reject(new Error("Tor control port connection timed out"));
    });
  });
}

/**
 * Returns the current public IP seen through the Tor SOCKS5 proxy.
 */
export async function getCurrentTorIp(): Promise<string> {
  const agent = new SocksProxyAgent(`socks5://${TOR_SOCKS_HOST}:${TOR_SOCKS_PORT}`);
  const res = await axios.get<string>("https://api.ipify.org", {
    httpAgent: agent,
    httpsAgent: agent,
    timeout: 10000,
  });
  return res.data;
}
