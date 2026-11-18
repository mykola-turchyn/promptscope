export function setCookieHeaders(response: Response): Headers {
  const headers = new Headers();
  for (const cookie of response.headers.getSetCookie()) headers.append('set-cookie', cookie);

  return headers;
}
