function geodeticToGrid(latitude, longitude) {
  const axis = 6378137.0; // GRS 80.
  const flattening = 1.0 / 298.257222101; // GRS 80.
  const centralMeridian = 15.00;
  const latOfOrigin = 0.0;
  const scale = 0.9996;
  const falseNorthing = 0.0;
  const falseEasting = 500000.0;

  const xy = new Array(2);

  if (centralMeridian == null) {
    return xy;
  }

  // Prepare ellipsoid-based stuff.
  const e2 = flattening * (2.0 - flattening);
  const n = flattening / (2.0 - flattening);
  const aRoof = axis / (1.0 + n) * (1.0 + n * n / 4.0 + n * n * n * n / 64.0);
  const A = e2;
  const B = (5.0 * e2 * e2 - e2 * e2 * e2) / 6.0;
  const C = (104.0 * e2 * e2 * e2 - 45.0 * e2 * e2 * e2 * e2) / 120.0;
  const D = (1237.0 * e2 * e2 * e2 * e2) / 1260.0;
  const beta1 = n / 2.0 - 2.0 * n * n / 3.0 + 5.0 * n * n * n / 16.0 + 41.0 * n * n * n * n / 180.0;
  const beta2 = 13.0 * n * n / 48.0 - 3.0 * n * n * n / 5.0 + 557.0 * n * n * n * n / 1440.0;
  const beta3 = 61.0 * n * n * n / 240.0 - 103.0 * n * n * n * n / 140.0;
  const beta4 = 49561.0 * n * n * n * n / 161280.0;

  // Convert.
  const degToRad = Math.PI / 180.0;
  const phi = latitude * degToRad;
  const lambda = longitude * degToRad;
  const lambdaZero = centralMeridian * degToRad;

  const phiStar = phi - Math.sin(phi) * Math.cos(phi) * (A +
    B * Math.pow(Math.sin(phi), 2) +
    C * Math.pow(Math.sin(phi), 4) +
    D * Math.pow(Math.sin(phi), 6));
    const deltaLambda = lambda - lambdaZero;
  const xiPrim = Math.atan(Math.tan(phiStar) / Math.cos(deltaLambda));
  const etaPrim = Math.atanh(Math.cos(phiStar) * Math.sin(deltaLambda));
  const x = scale * aRoof * (xiPrim +
    beta1 * Math.sin(2.0 * xiPrim) * Math.cosh(2.0 * etaPrim) +
    beta2 * Math.sin(4.0 * xiPrim) * Math.cosh(4.0 * etaPrim) +
    beta3 * Math.sin(6.0 * xiPrim) * Math.cosh(6.0 * etaPrim) +
    beta4 * Math.sin(8.0 * xiPrim) * Math.cosh(8.0 * etaPrim)) +
    falseNorthing;
  const y = scale * aRoof * (etaPrim +
    beta1 * Math.cos(2.0 * xiPrim) * Math.sinh(2.0 * etaPrim) +
    beta2 * Math.cos(4.0 * xiPrim) * Math.sinh(4.0 * etaPrim) +
    beta3 * Math.cos(6.0 * xiPrim) * Math.sinh(6.0 * etaPrim) +
    beta4 * Math.cos(8.0 * xiPrim) * Math.sinh(8.0 * etaPrim)) +
    falseEasting;

  xy[0] = Math.round(x * 1000.0) / 1000.0;
  xy[1] = Math.round(y * 1000.0) / 1000.0;

  return xy;
}

function offset([long, lat], dn = 10, de = 10) {
  // Earth???s radius, sphere.
  const R = 6378137

  // Coordinate offsets in radians
  const dLat = dn / R
  const dLon = de / (R * Math.cos(Math.PI * lat / 180))

  // OffsetPosition, decimal degrees
  const latO = lat + dLat * 180 / Math.PI;
  const lonO = long + dLon * 180 / Math.PI;

  return [lonO, latO];
}

/**
 * @param {number[]} coord
 * @param {{ radius: number, size: number }} options
 */
function getModern([lng, lat], options = { radius: 50, size: 512 }) {
  const { radius = '50', size = 512 } = options;
  const url = new URL('https://geolex.lantmateriet.se/karta/ortofoto/wms/v1.3');

  url.searchParams.set('LAYERS', 'Ortofoto_0.5');
  url.searchParams.set('EXCEPTIONS', 'application/vnd.ogc.se_xml');
  url.searchParams.set('FORMAT', 'image/png');
  url.searchParams.set('SERVICE', 'WMS');
  url.searchParams.set('STYLES', 'default');
  url.searchParams.set('TRANSPARENT', 'TRUE');
  url.searchParams.set('VERSION', '1.1.1');
  url.searchParams.set('REQUEST', 'GetMap');
  url.searchParams.set('SRS', 'EPSG:3006');

  url.searchParams.set('WIDTH', size);
  url.searchParams.set('HEIGHT', size);

  const rad = parseInt(radius, 10);

  const [longNW, latNW] = offset([lng, lat], -(rad), -(rad));
  const [longSE, latSE] = offset([lng, lat], rad, rad);

  const [xNW, yNW] = geodeticToGrid(latNW, longNW);
  const [xSE, ySE] = geodeticToGrid(latSE, longSE);

  const bbox = [yNW, xNW, ySE, xSE].join(',');

  url.searchParams.set('BBOX', bbox);

  return url.toString();
}

function getHistoric ([lng, lat], options = { radius: 50, year: 75, size: 512 }) {
  const { radius, year, size } = options;
  const API_KEY = Deno.env.get('API_KEY');
  const url = new URL(`https://api.lantmateriet.se/historiska-ortofoton/wms/v1/token/${API_KEY}/`);

  url.searchParams.set('SERVICE', 'WMS');
  url.searchParams.set('REQUEST', 'GetMap');
  url.searchParams.set('VERSION', '1.1.1');
  url.searchParams.set('FORMAT', 'image/jpeg');
  url.searchParams.set('WIDTH', '512');
  url.searchParams.set('HEIGHT', '512');
  url.searchParams.set('SRS', 'EPSG:4326');

  url.searchParams.set('WIDTH', size);
  url.searchParams.set('HEIGHT', size);

  if (year === 60) {
    url.searchParams.set('LAYERS', 'OI.Histortho_60');
  } else {
    url.searchParams.set('LAYERS', 'OI.Histortho_75');
  }

  const rad = parseInt(radius, 10);

  const [longNW, latNW] = offset([lng, lat], -rad, -rad);
  const [longSE, latSE] = offset([lng, lat], rad, rad);

  const bbox = [longNW, latNW, longSE, latSE].join(',');

  url.searchParams.set('BBOX', bbox);

  return url.toString();
}

function errorResponse (msg) {
  return new Response(msg, {
    status: 400,
  });
}

function handle (event) {
  const url = new URL(event.request.url);

  const lat = parseFloat(url.searchParams.get('lat'));

  if (Number.isNaN(lat)) {
   throw new ReferenceError('You did not provide a latitude value in the "lat" search parameter.');
  }

  const lng = parseFloat(url.searchParams.get('lng'));

  if (Number.isNaN(lng)) {
    throw new ReferenceError('You did not provide a longitude value in the "lat" search parameter.');
  }

  const size = url.searchParams.get('size') || '512';
  const radius = url.searchParams.get('radius') || '50';

  const type = url.searchParams.get('type');

  let requestUrl;

  switch (type) {
    case '75':
      requestUrl = getHistoric([lng, lat], { radius, year: 75, size });
      break;
    case '60':
      requestUrl = getHistoric([lng, lat], { radius, year: 60, size });
      break;
    case 'now':
      requestUrl = getModern([lng, lat], { radius, size });
      break;
    default:
      throw new ReferenceError('You did not provide a valid "type" search parameter. Available options are "60", "75" and "now".');
  }

  return fetch(requestUrl);
}

addEventListener('fetch', async event => {
  let response;

  try {
    const rawResponse = await handle(event);

    response = new Response(rawResponse.body, {
      headers: new Headers(rawResponse.headers)
    });

    if (event.request.url.includes('type=now')) {
      // Cache 1 month
      response.headers.set('Cache-Control', 'public, max-age=2592000');
    } else {
      // Cache 1 year ('max-recommended')
      response.headers.set('Cache-Control', 'public, max-age=31536000');
    }

    response.headers.delete('Expires');
    response.headers.delete('Pragma');
    response.headers.delete('set-cookie');

    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Request-Method', 'GET');
    response.headers.set('Vary', 'etag');
  } catch (e) {
    console.error(e);
    response = errorResponse(e.message);
  }

  event.respondWith(response);
});
