// CloudFront Function (cloudfront-js-2.0), viewer-response on c/*.json.
// Copies the viewer's country/region onto the response so the SDK can pick GDPR / CCPA / DPDPA
// without the config object itself varying by country (one cached object per site).
// Requires CloudFront-Viewer-Country(-Region) to be forwarded via the origin request policy.
function handler(event) {
  var req = event.request.headers;
  var res = event.response;
  var country = req["cloudfront-viewer-country"] ? req["cloudfront-viewer-country"].value : "XX";
  var region = req["cloudfront-viewer-country-region"] ? req["cloudfront-viewer-country-region"].value : "";
  res.headers["x-plain-country"] = { value: country };
  res.headers["x-plain-region"] = { value: region };
  res.headers["access-control-allow-origin"] = { value: "*" };
  res.headers["access-control-expose-headers"] = { value: "x-plain-country, x-plain-region" };
  return res;
}
