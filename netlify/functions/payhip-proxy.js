export async function handler(event, context) {

  const userHeaders = event.headers;

  const proxyHeaders = {
    "User-Agent": userHeaders["user-agent"],
    "Cookie": userHeaders["cookie"] || "",
    "Accept-Language": userHeaders["accept-language"],
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Referer": "https://payhip.com/"
  };

  try {
    const res = await fetch("https://payhip.com/WillieInspiredbeats", {
      headers: proxyHeaders
    });
    const html = await res.text();

    return {
      statusCode: res.status,
      headers: {
        "Content-Type": "text/html"
      },
      body: html
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: `Error al intentar contactar a Payhip: ${error.message}`
    };
  }
}