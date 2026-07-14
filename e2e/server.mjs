import http from "http";

const PORT = process.env.E2E_TEST_SERVER_PORT || 9876;

/**
 * Minimal HTTP server used by the Playwright E2E suite to verify that
 * FlexHeaders really modifies request and response headers through Chrome's
 * declarativeNetRequest API.
 */
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const { pathname } = url;

  if (pathname === "/health") {
    res.writeHead(200);
    res.end("ok");
    return;
  }

  // Echo the request headers back so tests can assert on request-header
  // modifications made by the extension.
  if (
    pathname === "/echo-request-headers" ||
    pathname === "/match" ||
    pathname === "/other" ||
    pathname === "/included" ||
    pathname === "/excluded"
  ) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(req.headers));
    return;
  }

  // Generic endpoint for response-header tests. The server sends the header
  // name/value specified in the query string; the extension is expected to
  // override or remove it.
  if (pathname === "/response-header") {
    const headerName = url.searchParams.get("header") || "X-Test-Response";
    const headerValue = url.searchParams.get("value") || "original";
    res.writeHead(200, {
      "Content-Type": "text/html",
      [headerName]: headerValue,
    });
    res.end("<html><body>response header test</body></html>");
    return;
  }

  if (pathname === "/no-response-header") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<html><body>no response header</body></html>");
    return;
  }

  res.writeHead(404);
  res.end("not found");
});

server.listen(PORT, () => {
  console.log(`E2E test server listening on http://localhost:${PORT}`);
});
